"""Retention Intelligence — churn risk scoring and coach task generation."""
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.auth import get_current_admin
from app.models import (
    MemberRetentionScore, Member, MemberMembership, Invoice,
    AttendanceRecord, GymSession, WorkoutSession, MemberCheckIn,
    ReadinessScore, CoachTask,
)

router = APIRouter(prefix="/api/retention", tags=["retention"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _today():
    return datetime.now(timezone.utc).date()


# ── Scoring engine ─────────────────────────────────────────────────────

def _compute_score(member_id: int, db: Session) -> dict:
    today = _today()
    w30   = today - timedelta(days=30)
    w7    = today - timedelta(days=7)

    reasons   = []
    components = {}

    # 1. Missed / no-show sessions (max 25 pts)
    recent_att = db.query(AttendanceRecord).filter(
        AttendanceRecord.member_id == member_id,
    ).join(GymSession, GymSession.id == AttendanceRecord.session_id).filter(
        GymSession.session_date >= w30,
    ).all()
    no_shows = sum(1 for a in recent_att if a.attendance_status == "No-Show")
    att_rate = (
        sum(1 for a in recent_att if a.attendance_status == "Attended") /
        max(len(recent_att), 1) * 100
    ) if recent_att else 0
    miss_comp = min(no_shows * 6, 20)
    att_comp  = max(0, (100 - att_rate) * 0.05)
    components["missed_session_component"] = round(miss_comp, 1)
    components["attendance_component"]     = round(att_comp, 1)
    if no_shows >= 3:
        reasons.append(f"{no_shows} no-shows in the last 30 days")
    if att_rate < 60 and recent_att:
        reasons.append(f"Low attendance rate: {round(att_rate)}%")

    # 2. Payment / billing (max 25 pts)
    membership = db.query(MemberMembership).filter(
        MemberMembership.member_id == member_id,
    ).order_by(MemberMembership.created_at.desc()).first()
    pay_comp = 0.0
    if membership:
        if membership.membership_status == "Paused":
            pay_comp += 10; reasons.append("Membership is paused")
        if membership.membership_status == "Cancelled":
            pay_comp += 25; reasons.append("Membership is cancelled")
        if membership.payment_status in ("Overdue",):
            pay_comp += 20; reasons.append("Overdue payment")
        elif membership.payment_status == "Unpaid":
            pay_comp += 12; reasons.append("Unpaid membership balance")
    components["payment_component"] = round(min(pay_comp, 25), 1)

    # 3. Workout adherence (max 15 pts)
    w_sessions = db.query(WorkoutSession).filter(
        WorkoutSession.member_id == member_id,
        WorkoutSession.session_date >= w30,
    ).all()
    avg_completion = (
        sum(s.completion_percentage or 0 for s in w_sessions) / max(len(w_sessions), 1)
    ) if w_sessions else None
    adh_comp = 0.0
    if avg_completion is not None and avg_completion < 60:
        adh_comp = (60 - avg_completion) * 0.25
        reasons.append(f"Low workout completion: {round(avg_completion)}%")
    elif not w_sessions:
        adh_comp = 10; reasons.append("No workout sessions logged in 30 days")
    components["workout_adherence_component"] = round(min(adh_comp, 15), 1)

    # 4. Check-in engagement (max 10 pts)
    checkins = db.query(MemberCheckIn).filter(
        MemberCheckIn.member_id == member_id,
        MemberCheckIn.check_in_date >= w30,
    ).all()
    eng_comp = max(0, 10 - len(checkins) * 1.5)
    components["check_in_component"] = round(eng_comp, 1)
    components["engagement_component"] = round(eng_comp * 0.5, 1)
    if len(checkins) == 0:
        reasons.append("No check-ins submitted in 30 days")
    elif len(checkins) < 4:
        reasons.append(f"Low check-in frequency: {len(checkins)} in 30 days")

    # 5. Motivation / readiness trend (max 15 pts)
    mot_comp = 0.0
    recent_checkins = db.query(MemberCheckIn).filter(
        MemberCheckIn.member_id == member_id,
        MemberCheckIn.check_in_date >= w7,
    ).all()
    low_motivation = sum(1 for c in recent_checkins if c.motivation_level == "Low")
    if low_motivation >= 2:
        mot_comp += 10; reasons.append(f"{low_motivation} low-motivation check-ins this week")
    readiness = db.query(ReadinessScore).filter(
        ReadinessScore.member_id == member_id,
    ).order_by(ReadinessScore.created_at.desc()).limit(5).all()
    low_readiness = sum(1 for r in readiness if r.category in ("Red", "Orange"))
    if low_readiness >= 3:
        mot_comp += 5; reasons.append("Consistently low readiness scores")
    components["motivation_component"] = round(min(mot_comp, 15), 1)
    components["readiness_component"]  = round(low_readiness, 1)

    total = sum(components.values())
    if total >= 70:
        category = "Critical"
    elif total >= 45:
        category = "High"
    elif total >= 20:
        category = "Medium"
    else:
        category = "Low"

    # Suggested action
    if category == "Critical":
        action = "Immediate personal outreach required. Book a check-in call, review payment, and offer support."
    elif category == "High":
        action = "Send personal follow-up message. Review schedule and consider rescheduling missed sessions."
    elif category == "Medium":
        action = "Monitor closely. Consider a check-in message and review workout adherence."
    else:
        action = "Member appears engaged. Continue monitoring standard metrics."

    return {
        "score": round(min(total, 100), 1),
        "risk_category": category,
        "risk_reason": " | ".join(reasons) if reasons else "No significant risk indicators",
        "suggested_action": action,
        **components,
    }


def _score_dict(s: MemberRetentionScore, db: Session) -> dict:
    m = db.query(Member).filter(Member.id == s.member_id).first()
    return {
        "id": s.id,
        "member_id": s.member_id,
        "member_name": f"{m.first_name} {m.last_name}" if m else None,
        "member_status": m.status if m else None,
        "score": s.score,
        "risk_category": s.risk_category,
        "missed_session_component": s.missed_session_component,
        "attendance_component": s.attendance_component,
        "payment_component": s.payment_component,
        "engagement_component": s.engagement_component,
        "motivation_component": s.motivation_component,
        "workout_adherence_component": s.workout_adherence_component,
        "check_in_component": s.check_in_component,
        "readiness_component": s.readiness_component,
        "risk_reason": s.risk_reason,
        "suggested_action": s.suggested_action,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


# ── Routes ─────────────────────────────────────────────────────────────

@router.get("/scores")
def list_scores(
    risk_category: Optional[str] = None,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    q = db.query(MemberRetentionScore)
    if risk_category:
        q = q.filter(MemberRetentionScore.risk_category == risk_category)
    items = q.order_by(MemberRetentionScore.score.desc()).all()
    return [_score_dict(s, db) for s in items]


@router.post("/score/{member_id}", status_code=201)
def score_member(member_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    if not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(404, "Member not found")

    data = _compute_score(member_id, db)

    # Auto-create coach task for High/Critical
    if data["risk_category"] in ("High", "Critical"):
        existing_task = db.query(CoachTask).filter(
            CoachTask.member_id == member_id,
            CoachTask.task_type == "Coach Follow-Up",
            CoachTask.status.in_(["Open", "In Progress"]),
        ).first()
        if not existing_task:
            task = CoachTask(
                member_id         = member_id,
                task_type         = "Coach Follow-Up",
                title             = f"Retention Risk — {data['risk_category']} Risk Member",
                description       = data["risk_reason"],
                priority          = "Urgent" if data["risk_category"] == "Critical" else "High",
                status            = "Open",
                created_by_system = True,
                created_at        = _utcnow(),
            )
            db.add(task)

    score = MemberRetentionScore(member_id=member_id, **data, created_at=_utcnow())
    db.add(score)
    db.commit()
    db.refresh(score)
    return _score_dict(score, db)


@router.post("/score-all")
def score_all_members(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    """Recalculate retention scores for all active members."""
    members = db.query(Member).filter(Member.status == "Active").all()
    results = []
    for m in members:
        data = _compute_score(m.id, db)
        if data["risk_category"] in ("High", "Critical"):
            existing = db.query(CoachTask).filter(
                CoachTask.member_id == m.id,
                CoachTask.task_type == "Coach Follow-Up",
                CoachTask.status.in_(["Open", "In Progress"]),
            ).first()
            if not existing:
                db.add(CoachTask(
                    member_id         = m.id,
                    task_type         = "Coach Follow-Up",
                    title             = f"Retention Risk — {data['risk_category']} Risk",
                    description       = data["risk_reason"],
                    priority          = "Urgent" if data["risk_category"] == "Critical" else "High",
                    status            = "Open",
                    created_by_system = True,
                    created_at        = _utcnow(),
                ))
        score = MemberRetentionScore(member_id=m.id, **data, created_at=_utcnow())
        db.add(score)
        results.append({"member_id": m.id, "score": data["score"], "category": data["risk_category"]})

    db.commit()
    return {"scored": len(results), "results": results}


@router.get("/dashboard")
def retention_dashboard(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    scores = db.query(MemberRetentionScore).order_by(MemberRetentionScore.created_at.desc()).all()
    # Keep only latest per member
    seen, latest = set(), []
    for s in scores:
        if s.member_id not in seen:
            seen.add(s.member_id)
            latest.append(s)

    cats = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    for s in latest:
        cats[s.risk_category] = cats.get(s.risk_category, 0) + 1

    high_risk = [_score_dict(s, db) for s in latest if s.risk_category in ("High", "Critical")]
    return {
        "total_scored": len(latest),
        "distribution": cats,
        "high_risk_members": sorted(high_risk, key=lambda x: x["score"], reverse=True)[:20],
    }
