"""Business Intelligence Dashboard — combined financial, coaching, and retention KPIs."""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.auth import get_current_admin
from app.models import (
    Member, MemberMembership, Invoice, Payment, GymSession, SessionBooking,
    AttendanceRecord, WorkoutSession, MemberCheckIn, ReadinessScore,
    CoachTask, WorkoutGroup, MemberWorkoutGroupAssignment, MemberRetentionScore,
    ProgressEntry, Assessment,
)

router = APIRouter(prefix="/api/bi", tags=["business-intelligence"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _today():
    return datetime.now(timezone.utc).date()


@router.get("/dashboard")
def bi_dashboard(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    today      = _today()
    month_start = today.replace(day=1)
    prev_month  = (month_start - timedelta(days=1)).replace(day=1)
    week_start  = today - timedelta(days=today.weekday())
    days_30     = today - timedelta(days=30)
    days_90     = today - timedelta(days=90)

    # ── Revenue ───────────────────────────────────────────────────────
    rev_month = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.payment_date >= month_start
    ).scalar() or 0

    rev_prev = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.payment_date >= prev_month,
        Payment.payment_date < month_start,
    ).scalar() or 0

    outstanding = db.query(func.coalesce(func.sum(Invoice.balance_due), 0)).filter(
        Invoice.invoice_status.in_(["Sent", "Overdue", "Partially Paid"])
    ).scalar() or 0

    overdue_invoices = db.query(func.count(Invoice.id)).filter(
        Invoice.invoice_status == "Overdue"
    ).scalar() or 0

    # Revenue by month (last 6 months)
    rev_trend = []
    for i in range(5, -1, -1):
        ms = (today.replace(day=1) - timedelta(days=i * 28)).replace(day=1)
        me = (ms + timedelta(days=32)).replace(day=1)
        rv = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
            Payment.payment_date >= ms,
            Payment.payment_date < me,
        ).scalar() or 0
        rev_trend.append({"month": ms.strftime("%b %Y"), "revenue": round(float(rv), 2)})

    # ── Membership ────────────────────────────────────────────────────
    total_members   = db.query(func.count(Member.id)).scalar() or 0
    active_members  = db.query(func.count(MemberMembership.id)).filter(
        MemberMembership.membership_status == "Active"
    ).scalar() or 0
    paused_members  = db.query(func.count(MemberMembership.id)).filter(
        MemberMembership.membership_status == "Paused"
    ).scalar() or 0
    cancelled_members = db.query(func.count(MemberMembership.id)).filter(
        MemberMembership.membership_status == "Cancelled"
    ).scalar() or 0

    new_this_month = db.query(func.count(Member.id)).filter(
        Member.created_at >= month_start
    ).scalar() or 0

    # ── Attendance ────────────────────────────────────────────────────
    att_records_30 = db.query(AttendanceRecord).join(
        GymSession, GymSession.id == AttendanceRecord.session_id
    ).filter(GymSession.session_date >= days_30).all()

    total_att   = len(att_records_30)
    attended    = sum(1 for a in att_records_30 if a.attendance_status == "Attended")
    no_shows    = sum(1 for a in att_records_30 if a.attendance_status == "No-Show")
    att_rate    = round(attended / max(total_att, 1) * 100, 1)
    noshow_rate = round(no_shows / max(total_att, 1) * 100, 1)

    # Attendance trend (last 6 weeks)
    att_trend = []
    for i in range(5, -1, -1):
        ws = week_start - timedelta(weeks=i)
        we = ws + timedelta(days=6)
        recs = db.query(AttendanceRecord).join(
            GymSession, GymSession.id == AttendanceRecord.session_id
        ).filter(GymSession.session_date >= ws, GymSession.session_date <= we).all()
        total_w = len(recs)
        att_w   = sum(1 for r in recs if r.attendance_status == "Attended")
        att_trend.append({
            "week": ws.strftime("W%V %b"),
            "attended": att_w,
            "no_shows": total_w - att_w,
            "rate": round(att_w / max(total_w, 1) * 100, 1),
        })

    # ── Workout adherence ─────────────────────────────────────────────
    w_sessions_30 = db.query(WorkoutSession).filter(
        WorkoutSession.session_date >= days_30
    ).all()
    avg_completion = round(
        sum(s.completion_percentage or 0 for s in w_sessions_30) / max(len(w_sessions_30), 1), 1
    ) if w_sessions_30 else 0

    # ── Readiness ─────────────────────────────────────────────────────
    readiness_30 = db.query(ReadinessScore).filter(
        ReadinessScore.created_at >= days_30
    ).all()
    avg_readiness = round(
        sum(r.score for r in readiness_30) / max(len(readiness_30), 1), 1
    ) if readiness_30 else 0
    readiness_dist = {}
    for r in readiness_30:
        readiness_dist[r.category] = readiness_dist.get(r.category, 0) + 1

    # ── Retention ────────────────────────────────────────────────────
    all_scores = db.query(MemberRetentionScore).order_by(
        MemberRetentionScore.created_at.desc()
    ).all()
    seen, latest_scores = set(), []
    for s in all_scores:
        if s.member_id not in seen:
            seen.add(s.member_id)
            latest_scores.append(s)

    churn_dist = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    for s in latest_scores:
        churn_dist[s.risk_category] = churn_dist.get(s.risk_category, 0) + 1
    high_risk_count = churn_dist.get("High", 0) + churn_dist.get("Critical", 0)

    # ── Coach tasks ───────────────────────────────────────────────────
    open_tasks   = db.query(func.count(CoachTask.id)).filter(
        CoachTask.status.in_(["Open", "In Progress"])
    ).scalar() or 0
    closed_30    = db.query(func.count(CoachTask.id)).filter(
        CoachTask.status == "Completed",
        CoachTask.created_at >= days_30,
    ).scalar() or 0
    urgent_tasks = db.query(func.count(CoachTask.id)).filter(
        CoachTask.status.in_(["Open", "In Progress"]),
        CoachTask.priority == "Urgent",
    ).scalar() or 0

    # ── Workout groups ────────────────────────────────────────────────
    groups = db.query(WorkoutGroup).filter(WorkoutGroup.status == "Active").all()
    group_stats = []
    for g in groups:
        member_count = db.query(func.count(MemberWorkoutGroupAssignment.id)).filter(
            MemberWorkoutGroupAssignment.workout_group_id == g.id,
            MemberWorkoutGroupAssignment.status == "Active",
        ).scalar() or 0
        group_sessions = db.query(WorkoutSession).filter(
            WorkoutSession.workout_group_id == g.id,
            WorkoutSession.session_date >= days_30,
        ).all()
        group_completion = round(
            sum(s.completion_percentage or 0 for s in group_sessions) / max(len(group_sessions), 1), 1
        ) if group_sessions else 0
        group_stats.append({
            "id": g.id,
            "name": g.group_name,
            "members": member_count,
            "sessions_30d": len(group_sessions),
            "avg_completion": group_completion,
        })
    group_stats.sort(key=lambda x: x["avg_completion"], reverse=True)

    # ── Most improved members (largest positive progress entry delta) ─
    progress_entries = db.query(ProgressEntry).filter(
        ProgressEntry.date >= days_30,
        ProgressEntry.adherence_score.isnot(None),
    ).order_by(ProgressEntry.adherence_score.desc()).limit(5).all()
    top_members = []
    for pe in progress_entries:
        m = db.query(Member).filter(Member.id == pe.member_id).first()
        if m:
            top_members.append({
                "member_id": m.id,
                "name": f"{m.first_name} {m.last_name}",
                "adherence_score": pe.adherence_score,
            })

    return {
        "as_of": today.isoformat(),
        "revenue": {
            "this_month": round(float(rev_month), 2),
            "prev_month": round(float(rev_prev), 2),
            "trend_pct": round((float(rev_month) - float(rev_prev)) / max(float(rev_prev), 1) * 100, 1),
            "outstanding": round(float(outstanding), 2),
            "overdue_invoices": overdue_invoices,
            "monthly_trend": rev_trend,
        },
        "membership": {
            "total": total_members,
            "active": active_members,
            "paused": paused_members,
            "cancelled": cancelled_members,
            "new_this_month": new_this_month,
        },
        "attendance": {
            "rate_30d": att_rate,
            "no_show_rate_30d": noshow_rate,
            "total_sessions_30d": total_att,
            "trend": att_trend,
        },
        "workout_adherence": {
            "avg_completion_30d": avg_completion,
            "sessions_logged_30d": len(w_sessions_30),
        },
        "readiness": {
            "avg_score_30d": avg_readiness,
            "distribution": readiness_dist,
        },
        "retention": {
            "high_risk_count": high_risk_count,
            "distribution": churn_dist,
            "scored_members": len(latest_scores),
        },
        "coach_tasks": {
            "open": open_tasks,
            "urgent": urgent_tasks,
            "completed_30d": closed_30,
        },
        "workout_groups": group_stats,
        "top_members": top_members,
    }
