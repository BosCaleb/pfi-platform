"""Member ↔ Workout Group assignment router + recommendation engine."""
import logging
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth, database, models
from app.group_recommender import recommend_groups
from app.schemas_phase2 import (
    MemberGroupAssignCreate, MemberGroupAssignOut, RecommendationOut,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/member-groups", tags=["member group assignments"])


# ── Recommendation ──────────────────────────────────────────────────────

@router.get("/member/{member_id}/recommendation", response_model=List[RecommendationOut])
def get_recommendation(
    member_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(404, "Member not found")

    groups = db.query(models.WorkoutGroup).filter(
        models.WorkoutGroup.status == "Active"
    ).all()
    ranked = recommend_groups(member, groups)

    return [
        RecommendationOut(group_id=g.id, group_name=g.group_name, score=s, reason=r)
        for g, s, r in ranked[:5]   # top 5
    ]


# ── Current assignment ──────────────────────────────────────────────────

@router.get("/member/{member_id}/current", response_model=MemberGroupAssignOut)
def get_current_assignment(
    member_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    a = db.query(models.MemberWorkoutGroupAssignment).filter(
        models.MemberWorkoutGroupAssignment.member_id == member_id,
        models.MemberWorkoutGroupAssignment.status == "Active",
    ).first()
    if not a:
        raise HTTPException(404, "No active group assignment for this member")
    return {
        **{c.name: getattr(a, c.name) for c in a.__table__.columns},
        "group_name": a.workout_group.group_name if a.workout_group else None,
    }


@router.get("/member/{member_id}/history", response_model=List[MemberGroupAssignOut])
def get_assignment_history(
    member_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    assignments = db.query(models.MemberWorkoutGroupAssignment).filter(
        models.MemberWorkoutGroupAssignment.member_id == member_id,
    ).order_by(models.MemberWorkoutGroupAssignment.created_at.desc()).all()
    return [
        {
            **{c.name: getattr(a, c.name) for c in a.__table__.columns},
            "group_name": a.workout_group.group_name if a.workout_group else None,
        }
        for a in assignments
    ]


# ── Assign ──────────────────────────────────────────────────────────────

@router.post("/assign", response_model=MemberGroupAssignOut)
def assign_member_to_group(
    data: MemberGroupAssignCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    member = db.query(models.Member).filter(models.Member.id == data.member_id).first()
    if not member:
        raise HTTPException(404, "Member not found")
    group = db.query(models.WorkoutGroup).filter(
        models.WorkoutGroup.id == data.workout_group_id
    ).first()
    if not group:
        raise HTTPException(404, "Workout group not found")

    # Close any active assignment
    existing = db.query(models.MemberWorkoutGroupAssignment).filter(
        models.MemberWorkoutGroupAssignment.member_id == data.member_id,
        models.MemberWorkoutGroupAssignment.status == "Active",
    ).all()
    for a in existing:
        a.status = "Moved"
        a.end_date = date.today()

    assignment = models.MemberWorkoutGroupAssignment(
        member_id=data.member_id,
        workout_group_id=data.workout_group_id,
        assigned_by_admin_id=admin.id,
        assignment_reason=data.assignment_reason,
        recommendation_score=data.recommendation_score,
        is_system_recommended=data.is_system_recommended,
        start_date=data.start_date or date.today(),
        notes=data.notes,
        status="Active",
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    logger.info(
        "Member %s assigned to group %s by admin %s",
        data.member_id, data.workout_group_id, admin.id,
    )
    return {
        **{c.name: getattr(assignment, c.name) for c in assignment.__table__.columns},
        "group_name": group.group_name,
    }


@router.patch("/{assignment_id}/remove")
def remove_from_group(
    assignment_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    a = db.query(models.MemberWorkoutGroupAssignment).filter(
        models.MemberWorkoutGroupAssignment.id == assignment_id
    ).first()
    if not a:
        raise HTTPException(404, "Assignment not found")
    a.status = "Archived"
    a.end_date = date.today()
    db.commit()
    return {"message": "Member removed from group"}
