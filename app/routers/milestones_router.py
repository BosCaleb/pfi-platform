"""Member Milestones — gamification and achievement tracking."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_admin
from app.models import MemberMilestone, Member, WorkoutSession, AttendanceRecord, GymSession

router = APIRouter(prefix="/api/milestones", tags=["milestones"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


BADGE_CATALOGUE = [
    {"type": "Sessions Completed",      "title": "5 Sessions Strong",       "threshold": 5,   "metric": "sessions"},
    {"type": "Sessions Completed",      "title": "10 Sessions Milestone",    "threshold": 10,  "metric": "sessions"},
    {"type": "Sessions Completed",      "title": "25 Sessions Champion",     "threshold": 25,  "metric": "sessions"},
    {"type": "Sessions Completed",      "title": "50 Sessions Legend",       "threshold": 50,  "metric": "sessions"},
    {"type": "Attendance Streak",       "title": "4-Week Consistency",       "threshold": 4,   "metric": "weeks"},
    {"type": "First Reassessment",      "title": "First Reassessment Complete", "threshold": 1, "metric": "assessments"},
    {"type": "Strength Milestone",      "title": "Strength Builder",         "threshold": None,"metric": "manual"},
    {"type": "Recovery Consistency",    "title": "Recovery Champion",        "threshold": None,"metric": "manual"},
    {"type": "Nutrition Consistency",   "title": "Nutrition Consistency",    "threshold": None,"metric": "manual"},
    {"type": "Goal Progress",           "title": "Ready to Progress",        "threshold": None,"metric": "manual"},
]


def _milestone_dict(m: MemberMilestone, db: Session) -> dict:
    member = db.query(Member).filter(Member.id == m.member_id).first()
    return {
        "id": m.id, "member_id": m.member_id,
        "member_name": f"{member.first_name} {member.last_name}" if member else None,
        "milestone_type": m.milestone_type,
        "milestone_title": m.milestone_title,
        "milestone_description": m.milestone_description,
        "achieved_at": m.achieved_at.isoformat() if m.achieved_at else None,
        "related_metric": m.related_metric,
        "visible_to_member": m.visible_to_member,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


@router.get("/")
def list_milestones(
    member_id: Optional[int] = None,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    q = db.query(MemberMilestone)
    if member_id: q = q.filter(MemberMilestone.member_id == member_id)
    return [_milestone_dict(m, db) for m in q.order_by(MemberMilestone.achieved_at.desc()).all()]


@router.post("/", status_code=201)
def create_milestone(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    member_id = body.get("member_id")
    if not member_id:
        raise HTTPException(400, "member_id required")
    if not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(404, "Member not found")
    m = MemberMilestone(
        member_id             = member_id,
        milestone_type        = body.get("milestone_type"),
        milestone_title       = body.get("milestone_title", "Achievement"),
        milestone_description = body.get("milestone_description"),
        related_metric        = body.get("related_metric"),
        visible_to_member     = body.get("visible_to_member", True),
        achieved_at           = _utcnow(),
        created_at            = _utcnow(),
    )
    db.add(m); db.commit(); db.refresh(m)
    return _milestone_dict(m, db)


@router.post("/auto-check/{member_id}")
def auto_check_milestones(member_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    """Auto-award session-count milestones based on completed workout sessions."""
    if not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(404, "Member not found")

    total_sessions = db.query(WorkoutSession).filter(
        WorkoutSession.member_id == member_id,
        WorkoutSession.completion_status == "Completed",
    ).count()

    awarded = []
    for badge in BADGE_CATALOGUE:
        if badge["metric"] != "sessions":
            continue
        threshold = badge["threshold"]
        if total_sessions >= threshold:
            already = db.query(MemberMilestone).filter(
                MemberMilestone.member_id == member_id,
                MemberMilestone.milestone_title == badge["title"],
            ).first()
            if not already:
                m = MemberMilestone(
                    member_id             = member_id,
                    milestone_type        = badge["type"],
                    milestone_title       = badge["title"],
                    milestone_description = f"Completed {threshold} workout sessions.",
                    related_metric        = f"{total_sessions} sessions",
                    visible_to_member     = True,
                    achieved_at           = _utcnow(),
                    created_at            = _utcnow(),
                )
                db.add(m)
                awarded.append(badge["title"])

    db.commit()
    return {"member_id": member_id, "awarded": awarded, "total_sessions": total_sessions}


@router.get("/catalogue")
def milestone_catalogue(admin=Depends(get_current_admin)):
    return BADGE_CATALOGUE


@router.put("/{mid}")
def update_milestone(mid: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    m = db.query(MemberMilestone).filter(MemberMilestone.id == mid).first()
    if not m: raise HTTPException(404, "Milestone not found")
    for k in ("milestone_title", "milestone_description", "visible_to_member", "related_metric"):
        if k in body: setattr(m, k, body[k])
    db.commit(); db.refresh(m)
    return _milestone_dict(m, db)


@router.delete("/{mid}", status_code=204)
def delete_milestone(mid: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    m = db.query(MemberMilestone).filter(MemberMilestone.id == mid).first()
    if not m: raise HTTPException(404, "Milestone not found")
    db.delete(m); db.commit()
