"""
Member Portal — lightweight member-facing data endpoints.

For Phase 3.1, access is admin-authenticated (admin submits on member's behalf
or the admin generates a portal view). Full member self-auth is Phase 3.2.

GET  /api/portal/{member_id}/summary     — portal home data
GET  /api/portal/{member_id}/check-ins   — member's recent check-ins
GET  /api/portal/{member_id}/readiness   — member's readiness data
GET  /api/portal/{member_id}/workout     — member's current workout
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth, database, models

router = APIRouter(prefix="/api/portal", tags=["member-portal"])


@router.get("/{member_id}/summary", summary="Member portal home data")
def portal_summary(
    member_id: int,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(404, "Member not found.")

    # Latest readiness
    latest_readiness = (
        db.query(models.ReadinessScore)
        .filter(models.ReadinessScore.member_id == member_id)
        .order_by(models.ReadinessScore.created_at.desc())
        .first()
    )
    # Latest recovery
    latest_recovery = (
        db.query(models.RecoveryScore)
        .filter(models.RecoveryScore.member_id == member_id)
        .order_by(models.RecoveryScore.created_at.desc())
        .first()
    )
    # Latest daily check-in
    latest_check_in = (
        db.query(models.MemberCheckIn)
        .filter(models.MemberCheckIn.member_id == member_id)
        .order_by(models.MemberCheckIn.check_in_date.desc())
        .first()
    )
    # Current workout group
    group_assignment = (
        db.query(models.MemberWorkoutGroupAssignment)
        .filter(
            models.MemberWorkoutGroupAssignment.member_id == member_id,
            models.MemberWorkoutGroupAssignment.status == "Active",
        )
        .first()
    )
    # Open pain flags
    open_flags = (
        db.query(models.PainRiskFlag)
        .filter(
            models.PainRiskFlag.member_id == member_id,
            models.PainRiskFlag.status == "Open",
        )
        .count()
    )

    return {
        "member": {
            "id": member.id,
            "first_name": member.first_name,
            "last_name": member.last_name,
            "primary_goal": member.primary_goal,
            "fitness_level": member.fitness_level,
            "risk_level": member.risk_level,
        },
        "latest_readiness": {
            "score": latest_readiness.score,
            "category": latest_readiness.category,
            "recommendation": latest_readiness.recommendation_summary,
        } if latest_readiness else None,
        "latest_recovery": {
            "score": latest_recovery.score,
            "category": latest_recovery.category,
        } if latest_recovery else None,
        "last_check_in_date": str(latest_check_in.check_in_date) if latest_check_in else None,
        "current_group": group_assignment.workout_group_id if group_assignment else None,
        "open_pain_flags": open_flags,
    }


@router.get("/{member_id}/check-ins", summary="Member's recent check-ins for portal")
def portal_check_ins(
    member_id: int,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    daily = (
        db.query(models.MemberCheckIn)
        .filter(models.MemberCheckIn.member_id == member_id)
        .order_by(models.MemberCheckIn.check_in_date.desc())
        .limit(7)
        .all()
    )
    weekly = (
        db.query(models.WeeklyMemberCheckIn)
        .filter(models.WeeklyMemberCheckIn.member_id == member_id)
        .order_by(models.WeeklyMemberCheckIn.week_start_date.desc())
        .limit(4)
        .all()
    )
    return {
        "daily": [{"id": c.id, "date": str(c.check_in_date), "energy": c.energy_level, "pain": c.pain_level, "readiness": c.workout_readiness} for c in daily],
        "weekly": [{"id": w.id, "week": str(w.week_start_date), "perceived_progress": w.perceived_progress, "coach_support": w.coach_support_needed} for w in weekly],
    }
