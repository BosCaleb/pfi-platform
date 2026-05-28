"""Member Reports — generate, review, and share progress reports."""
import json
from datetime import datetime, timezone, date as date_type
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_admin
from app.models import (
    MemberReport, Member, WorkoutSession, AttendanceRecord, GymSession,
    MemberCheckIn, ReadinessScore, ProgressEntry, Assessment,
    NutritionAdherenceLog, MemberMembership,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _report_dict(r: MemberReport, db: Session) -> dict:
    m = db.query(Member).filter(Member.id == r.member_id).first()
    return {
        "id": r.id,
        "member_id": r.member_id,
        "member_name": f"{m.first_name} {m.last_name}" if m else None,
        "report_type": r.report_type,
        "date_range_start": r.date_range_start.isoformat() if r.date_range_start else None,
        "date_range_end": r.date_range_end.isoformat() if r.date_range_end else None,
        "report_title": r.report_title,
        "report_summary": r.report_summary,
        "report_data_snapshot": r.report_data_snapshot,
        "ai_summary": r.ai_summary,
        "coach_final_notes": r.coach_final_notes,
        "status": r.status,
        "shared_with_member": r.shared_with_member,
        "shared_at": r.shared_at.isoformat() if r.shared_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _build_snapshot(member_id: int, start: date_type, end: date_type, db: Session) -> dict:
    sessions = db.query(WorkoutSession).filter(
        WorkoutSession.member_id == member_id,
        WorkoutSession.session_date >= start,
        WorkoutSession.session_date <= end,
    ).all()
    completed = sum(1 for s in sessions if s.completion_status == "Completed")
    avg_comp  = round(sum(s.completion_percentage or 0 for s in sessions) / max(len(sessions), 1), 1)

    attendance = db.query(AttendanceRecord).filter(
        AttendanceRecord.member_id == member_id,
    ).join(GymSession, GymSession.id == AttendanceRecord.session_id).filter(
        GymSession.session_date >= start,
        GymSession.session_date <= end,
    ).all()
    att_attended = sum(1 for a in attendance if a.attendance_status == "Attended")
    att_rate = round(att_attended / max(len(attendance), 1) * 100, 1)

    checkins = db.query(MemberCheckIn).filter(
        MemberCheckIn.member_id == member_id,
        MemberCheckIn.check_in_date >= start,
        MemberCheckIn.check_in_date <= end,
    ).all()
    avg_energy = None
    if checkins:
        energy_vals = [c.energy_level for c in checkins if c.energy_level]
        avg_energy = max(set(energy_vals), key=energy_vals.count) if energy_vals else None

    readiness = db.query(ReadinessScore).filter(
        ReadinessScore.member_id == member_id,
        ReadinessScore.created_at >= datetime.combine(start, datetime.min.time()),
        ReadinessScore.created_at <= datetime.combine(end, datetime.max.time()),
    ).all()
    avg_readiness = round(sum(r.score for r in readiness) / max(len(readiness), 1), 1) if readiness else None

    progress = db.query(ProgressEntry).filter(
        ProgressEntry.member_id == member_id,
        ProgressEntry.date >= start,
        ProgressEntry.date <= end,
    ).order_by(ProgressEntry.date).all()
    weight_start = progress[0].weight  if progress and progress[0].weight  else None
    weight_end   = progress[-1].weight if progress and progress[-1].weight else None

    assessments = db.query(Assessment).filter(
        Assessment.member_id == member_id,
        Assessment.assessment_date >= start,
        Assessment.assessment_date <= end,
    ).all()

    nutrition = db.query(NutritionAdherenceLog).filter(
        NutritionAdherenceLog.member_id == member_id,
        NutritionAdherenceLog.date >= start,
        NutritionAdherenceLog.date <= end,
    ).all()
    nutrition_ratings = [n.nutrition_adherence_rating for n in nutrition if n.nutrition_adherence_rating]
    avg_nutrition = max(set(nutrition_ratings), key=nutrition_ratings.count) if nutrition_ratings else None

    return {
        "sessions_total": len(sessions),
        "sessions_completed": completed,
        "avg_completion_pct": avg_comp,
        "attendance_total": len(attendance),
        "attendance_attended": att_attended,
        "attendance_rate": att_rate,
        "checkins_count": len(checkins),
        "avg_energy": avg_energy,
        "avg_readiness_score": avg_readiness,
        "weight_start": weight_start,
        "weight_end": weight_end,
        "weight_delta": round(weight_end - weight_start, 1) if weight_start and weight_end else None,
        "assessments_count": len(assessments),
        "avg_nutrition_adherence": avg_nutrition,
        "progress_entries": len(progress),
    }


def _build_ai_summary(report_type: str, member_name: str, snap: dict, goal: str) -> str:
    completed  = snap.get("sessions_completed", 0)
    total      = snap.get("sessions_total", 0)
    att_rate   = snap.get("attendance_rate", 0)
    comp_pct   = snap.get("avg_completion_pct", 0)
    readiness  = snap.get("avg_readiness_score")
    w_delta    = snap.get("weight_delta")

    lines = [
        f"## AI-Assisted Summary — {report_type}",
        f"**Member:** {member_name}  |  **Goal:** {goal}",
        "",
        f"{member_name} completed {completed} of {total} sessions during this period "
        f"with an average completion rate of {comp_pct}% and an attendance rate of {att_rate}%.",
        "",
    ]
    if readiness:
        lines.append(f"Average readiness score was {readiness}/100, "
                     f"indicating {'good' if readiness >= 65 else 'below-average'} recovery trends.")
        lines.append("")
    if w_delta is not None:
        direction = "decreased" if w_delta < 0 else "increased"
        lines.append(f"Body weight {direction} by {abs(w_delta)} kg over this period.")
        lines.append("")

    if comp_pct >= 80 and att_rate >= 75:
        lines.append(f"Overall, {member_name} has shown strong consistency and is on track toward their {goal} goal.")
        lines.append("Consider reviewing progression opportunities for the next period.")
    elif comp_pct < 60 or att_rate < 50:
        lines.append(f"{member_name} has had a challenging period with reduced engagement.")
        lines.append("A coaching conversation and plan review are recommended before the next block.")
    else:
        lines.append(f"{member_name} is making steady progress with room for improvement in consistency.")

    lines += [
        "",
        "---",
        "⚠️ _This summary was drafted from session data. It requires coach review before sharing._",
        "_This report does not constitute medical or nutritional advice._",
    ]
    return "\n".join(lines)


@router.get("/")
def list_reports(
    member_id:   Optional[int] = None,
    status:      Optional[str] = None,
    report_type: Optional[str] = None,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    q = db.query(MemberReport)
    if member_id:   q = q.filter(MemberReport.member_id == member_id)
    if status:      q = q.filter(MemberReport.status == status)
    if report_type: q = q.filter(MemberReport.report_type == report_type)
    items = q.order_by(MemberReport.created_at.desc()).all()
    return [_report_dict(r, db) for r in items]


@router.post("/generate", status_code=201)
def generate_report(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    member_id   = body.get("member_id")
    report_type = body.get("report_type", "Monthly Progress Report")
    start_str   = body.get("date_range_start")
    end_str     = body.get("date_range_end")

    if not member_id:
        raise HTTPException(400, "member_id is required")
    m = db.query(Member).filter(Member.id == member_id).first()
    if not m:
        raise HTTPException(404, "Member not found")

    from datetime import date as d_type
    start = d_type.fromisoformat(start_str) if start_str else d_type.today().replace(day=1)
    end   = d_type.fromisoformat(end_str)   if end_str   else d_type.today()

    snap    = _build_snapshot(member_id, start, end, db)
    goal    = m.primary_goal or "General Fitness"
    summary = _build_ai_summary(report_type, f"{m.first_name} {m.last_name}", snap, goal)
    title   = f"{report_type} — {m.first_name} {m.last_name} — {start.strftime('%b %Y')}"

    report = MemberReport(
        member_id             = member_id,
        report_type           = report_type,
        date_range_start      = start,
        date_range_end        = end,
        report_title          = title,
        report_data_snapshot  = json.dumps(snap, default=str),
        ai_summary            = summary,
        status                = "Draft",
        generated_by_admin_id = admin.id,
        created_at            = _utcnow(),
        updated_at            = _utcnow(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _report_dict(report, db)


@router.get("/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    r = db.query(MemberReport).filter(MemberReport.id == report_id).first()
    if not r:
        raise HTTPException(404, "Report not found")
    return _report_dict(r, db)


@router.put("/{report_id}")
def update_report(report_id: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    r = db.query(MemberReport).filter(MemberReport.id == report_id).first()
    if not r:
        raise HTTPException(404, "Report not found")
    for k in ("coach_final_notes", "ai_summary", "status", "report_title", "report_summary"):
        if k in body:
            setattr(r, k, body[k])
    if body.get("status") == "Shared with Member" and not r.shared_with_member:
        r.shared_with_member = True
        r.shared_at = _utcnow()
    r.updated_at = _utcnow()
    db.commit()
    db.refresh(r)
    return _report_dict(r, db)


@router.delete("/{report_id}", status_code=204)
def delete_report(report_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    r = db.query(MemberReport).filter(MemberReport.id == report_id).first()
    if not r:
        raise HTTPException(404, "Report not found")
    db.delete(r)
    db.commit()
