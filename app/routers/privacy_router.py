"""Data Privacy & Export Workflows — GDPR-style member data requests, export, deactivation."""
import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_admin
from app.models import (
    MemberDataRequest, Member, WorkoutSession, AttendanceRecord,
    MemberCheckIn, ReadinessScore, ProgressEntry, Assessment,
    NutritionAdherenceLog, MemberMilestone, MemberMembership,
)

router = APIRouter(prefix="/api/privacy", tags=["privacy"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _request_dict(r: MemberDataRequest, db: Session) -> dict:
    m = db.query(Member).filter(Member.id == r.member_id).first()
    return {
        "id": r.id,
        "member_id": r.member_id,
        "member_name": f"{m.first_name} {m.last_name}" if m else None,
        "request_type": r.request_type,
        "status": r.status,
        "requested_at": r.requested_at.isoformat() if r.requested_at else None,
        "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
        "admin_notes": r.admin_notes,
        "export_url": r.export_url,
    }


# ── Data Requests ──────────────────────────────────────────────────────

@router.get("/requests")
def list_requests(
    member_id:    Optional[int] = None,
    status:       Optional[str] = None,
    request_type: Optional[str] = None,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    q = db.query(MemberDataRequest)
    if member_id:    q = q.filter(MemberDataRequest.member_id == member_id)
    if status:       q = q.filter(MemberDataRequest.status == status)
    if request_type: q = q.filter(MemberDataRequest.request_type == request_type)
    return [_request_dict(r, db) for r in q.order_by(MemberDataRequest.requested_at.desc()).all()]


@router.post("/requests", status_code=201)
def create_request(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    member_id    = body.get("member_id")
    request_type = body.get("request_type")
    if not member_id or not request_type:
        raise HTTPException(400, "member_id and request_type required")
    if not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(404, "Member not found")
    r = MemberDataRequest(
        member_id    = member_id,
        request_type = request_type,
        status       = "Pending",
        requested_at = _utcnow(),
        admin_notes  = body.get("admin_notes"),
    )
    db.add(r); db.commit(); db.refresh(r)
    return _request_dict(r, db)


@router.put("/requests/{rid}")
def update_request(rid: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    r = db.query(MemberDataRequest).filter(MemberDataRequest.id == rid).first()
    if not r: raise HTTPException(404, "Request not found")
    for k in ("status", "admin_notes", "export_url"):
        if k in body: setattr(r, k, body[k])
    if body.get("status") in ("Completed", "Deleted") and not r.resolved_at:
        r.resolved_at = _utcnow()
    db.commit(); db.refresh(r)
    return _request_dict(r, db)


@router.delete("/requests/{rid}", status_code=204)
def delete_request(rid: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    r = db.query(MemberDataRequest).filter(MemberDataRequest.id == rid).first()
    if not r: raise HTTPException(404, "Request not found")
    db.delete(r); db.commit()


# ── Member Data Export ─────────────────────────────────────────────────

@router.get("/export/{member_id}")
def export_member_data(member_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    """Compile a full member data export (GDPR-style). Returns structured JSON."""
    m = db.query(Member).filter(Member.id == member_id).first()
    if not m: raise HTTPException(404, "Member not found")

    memberships = db.query(MemberMembership).filter(MemberMembership.member_id == member_id).all()
    sessions    = db.query(WorkoutSession).filter(WorkoutSession.member_id == member_id).all()
    checkins    = db.query(MemberCheckIn).filter(MemberCheckIn.member_id == member_id).all()
    readiness   = db.query(ReadinessScore).filter(ReadinessScore.member_id == member_id).all()
    progress    = db.query(ProgressEntry).filter(ProgressEntry.member_id == member_id).all()
    assessments = db.query(Assessment).filter(Assessment.member_id == member_id).all()
    nutrition   = db.query(NutritionAdherenceLog).filter(NutritionAdherenceLog.member_id == member_id).all()
    milestones  = db.query(MemberMilestone).filter(MemberMilestone.member_id == member_id).all()

    export = {
        "export_date": _utcnow().isoformat(),
        "member": {
            "id": m.id,
            "first_name": m.first_name,
            "last_name": m.last_name,
            "email": m.email,
            "phone": m.phone,
            "date_of_birth": m.date_of_birth.isoformat() if m.date_of_birth else None,
            "gender": m.gender,
            "primary_goal": m.primary_goal,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        },
        "memberships": [
            {
                "type": ms.membership_type,
                "status": ms.membership_status,
                "start_date": ms.start_date.isoformat() if ms.start_date else None,
                "end_date": ms.end_date.isoformat() if ms.end_date else None,
            }
            for ms in memberships
        ],
        "workout_sessions": [
            {
                "date": s.session_date.isoformat() if s.session_date else None,
                "status": s.completion_status,
                "completion_pct": s.completion_percentage,
            }
            for s in sessions
        ],
        "check_ins": [
            {
                "date": c.check_in_date.isoformat() if c.check_in_date else None,
                "energy_level": c.energy_level,
                "sleep_quality": c.sleep_quality,
                "stress_level": c.stress_level,
                "soreness_level": c.soreness_level,
            }
            for c in checkins
        ],
        "readiness_scores": [
            {
                "score": r.score,
                "category": r.category,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in readiness
        ],
        "progress_entries": [
            {
                "date": p.date.isoformat() if p.date else None,
                "weight": p.weight,
                "body_fat_pct": p.body_fat_pct,
                "adherence_score": p.adherence_score,
            }
            for p in progress
        ],
        "assessments": [
            {
                "date": a.assessment_date.isoformat() if a.assessment_date else None,
                "type": a.assessment_type,
            }
            for a in assessments
        ],
        "nutrition_logs": [
            {
                "date": n.date.isoformat() if n.date else None,
                "adherence_rating": n.nutrition_adherence_rating,
                "calories": n.calories_consumed,
                "protein_g": n.protein_g,
            }
            for n in nutrition
        ],
        "milestones": [
            {
                "title": mi.milestone_title,
                "type": mi.milestone_type,
                "achieved_at": mi.achieved_at.isoformat() if mi.achieved_at else None,
            }
            for mi in milestones
        ],
        "summary": {
            "total_sessions": len(sessions),
            "total_check_ins": len(checkins),
            "total_milestones": len(milestones),
            "total_progress_entries": len(progress),
            "total_assessments": len(assessments),
        },
    }
    return export


# ── Member Deactivation ────────────────────────────────────────────────

@router.post("/deactivate/{member_id}")
def deactivate_member(member_id: int, body: dict = {}, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    """Soft-deactivate a member (sets is_active=False, anonymises contact info on hard delete)."""
    m = db.query(Member).filter(Member.id == member_id).first()
    if not m: raise HTTPException(404, "Member not found")

    hard_delete = body.get("hard_delete", False)
    if hard_delete:
        # Anonymise PII rather than destroy training history
        m.first_name = "Deleted"
        m.last_name  = "Member"
        m.email      = f"deleted_{member_id}@anonymised.local"
        m.phone      = None
        m.date_of_birth = None
        m.is_active  = False
        m.emergency_contact_name  = None
        m.emergency_contact_phone = None
        db.commit()
        return {"member_id": member_id, "action": "anonymised", "message": "Member PII anonymised. Training history retained."}
    else:
        m.is_active = False
        db.commit()
        return {"member_id": member_id, "action": "deactivated", "message": "Member deactivated. All data retained."}
