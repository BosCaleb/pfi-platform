"""Workout Groups router — CRUD, plan assignment, group dashboard."""
import logging
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth, database, models
from app.schemas_phase2 import (
    WorkoutGroupCreate, WorkoutGroupOut, WorkoutGroupUpdate,
    GroupPlanAssignCreate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/workout-groups", tags=["workout groups"])


def _group_or_404(db: Session, group_id: int) -> models.WorkoutGroup:
    g = db.query(models.WorkoutGroup).filter(models.WorkoutGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Workout group not found")
    return g


def _group_out(g: models.WorkoutGroup) -> dict:
    member_count = (
        db_count := sum(1 for a in (g.members or []) if a.status == "Active")
    )
    return {
        **{c.name: getattr(g, c.name) for c in g.__table__.columns},
        "member_count": member_count,
    }


@router.get("/", response_model=List[WorkoutGroupOut])
def list_groups(
    status: Optional[str] = None,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    q = db.query(models.WorkoutGroup)
    if status:
        q = q.filter(models.WorkoutGroup.status == status)
    groups = q.order_by(models.WorkoutGroup.group_name).all()
    return [_group_out(g) for g in groups]


@router.post("/", response_model=WorkoutGroupOut)
def create_group(
    data: WorkoutGroupCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    g = models.WorkoutGroup(**data.model_dump())
    db.add(g)
    db.commit()
    db.refresh(g)
    logger.info("Workout group created: %s (id=%s)", g.group_name, g.id)
    return _group_out(g)


@router.get("/{group_id}", response_model=WorkoutGroupOut)
def get_group(
    group_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    return _group_out(_group_or_404(db, group_id))


@router.put("/{group_id}", response_model=WorkoutGroupOut)
def update_group(
    group_id: int,
    data: WorkoutGroupUpdate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    g = _group_or_404(db, group_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(g, k, v)
    db.commit()
    db.refresh(g)
    return _group_out(g)


@router.patch("/{group_id}/archive")
def archive_group(
    group_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    g = _group_or_404(db, group_id)
    g.status = "Archived"
    db.commit()
    logger.info("Workout group archived: %s", group_id)
    return {"message": "Group archived"}


# ── Plan assignment ─────────────────────────────────────────────────────

@router.post("/{group_id}/assign-plan")
def assign_plan(
    group_id: int,
    data: GroupPlanAssignCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    _group_or_404(db, group_id)
    plan = db.query(models.WorkoutPlanTemplate).filter(
        models.WorkoutPlanTemplate.id == data.workout_plan_id
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Workout plan not found")

    # Deactivate any existing active assignment for this group
    existing = db.query(models.WorkoutGroupPlanAssignment).filter(
        models.WorkoutGroupPlanAssignment.workout_group_id == group_id,
        models.WorkoutGroupPlanAssignment.is_active == True,
    ).all()
    for a in existing:
        a.is_active = False

    assignment = models.WorkoutGroupPlanAssignment(
        workout_group_id=group_id,
        workout_plan_id=data.workout_plan_id,
        plan_version_id=data.plan_version_id,
        is_active=True,
    )
    db.add(assignment)
    db.commit()
    logger.info("Plan %s assigned to group %s", data.workout_plan_id, group_id)
    return {"message": "Plan assigned to group"}


@router.get("/{group_id}/current-plan")
def get_current_plan(
    group_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    _group_or_404(db, group_id)
    assignment = db.query(models.WorkoutGroupPlanAssignment).filter(
        models.WorkoutGroupPlanAssignment.workout_group_id == group_id,
        models.WorkoutGroupPlanAssignment.is_active == True,
    ).first()
    if not assignment:
        return {"plan": None}
    plan = assignment.plan
    return {
        "assignment_id": assignment.id,
        "plan_id":        plan.id,
        "plan_name":      plan.plan_name,
        "plan_version_id":assignment.plan_version_id,
        "status":         plan.status,
        "assigned_at":    assignment.assigned_at,
    }


# ── Members list ────────────────────────────────────────────────────────

@router.get("/{group_id}/members")
def list_group_members(
    group_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    _group_or_404(db, group_id)
    assignments = db.query(models.MemberWorkoutGroupAssignment).filter(
        models.MemberWorkoutGroupAssignment.workout_group_id == group_id,
        models.MemberWorkoutGroupAssignment.status == "Active",
    ).all()
    result = []
    for a in assignments:
        m = a.member
        result.append({
            "assignment_id":    a.id,
            "member_id":        m.id,
            "name":             f"{m.first_name} {m.last_name}",
            "email":            m.email,
            "fitness_level":    m.fitness_level,
            "risk_level":       m.risk_level,
            "primary_goal":     m.primary_goal,
            "start_date":       a.start_date,
            "is_recommended":   a.is_system_recommended,
        })
    return result


# ── Group dashboard ─────────────────────────────────────────────────────

@router.get("/{group_id}/dashboard")
def group_dashboard(
    group_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    g = _group_or_404(db, group_id)

    active_assignments = [a for a in g.members if a.status == "Active"]
    member_ids = [a.member_id for a in active_assignments]

    sessions = db.query(models.WorkoutSession).filter(
        models.WorkoutSession.workout_group_id == group_id,
    ).all() if member_ids else []

    completed = [s for s in sessions if s.completion_status == "Completed"]
    pain_flags = [s for s in sessions if s.pain_flag]
    avg_completion = (
        round(sum(s.completion_percentage for s in completed) / len(completed), 1)
        if completed else 0
    )
    avg_rpe = (
        round(sum(s.overall_rpe for s in completed if s.overall_rpe) /
              max(1, sum(1 for s in completed if s.overall_rpe)), 1)
        if completed else None
    )
    today = date.today()
    this_week = [s for s in sessions if s.session_date and
                 (today - s.session_date).days <= 7]

    # Members with pain flags this week
    pain_member_ids = list({s.member_id for s in pain_flags
                            if s.session_date and (today - s.session_date).days <= 30})

    # Per-member stats for most improved
    member_stats = {}
    for s in completed:
        if s.member_id not in member_stats:
            member_stats[s.member_id] = {"sessions": 0, "total_completion": 0}
        member_stats[s.member_id]["sessions"] += 1
        member_stats[s.member_id]["total_completion"] += s.completion_percentage

    # Resolve member names
    pain_member_names = []
    for mid in pain_member_ids:
        m = db.query(models.Member).filter(models.Member.id == mid).first()
        if m:
            pain_member_names.append({"id": mid, "name": f"{m.first_name} {m.last_name}"})

    return {
        "group_id":            group_id,
        "group_name":          g.group_name,
        "total_members":       len(active_assignments),
        "total_sessions":      len(sessions),
        "completed_sessions":  len(completed),
        "sessions_this_week":  len(this_week),
        "avg_completion_pct":  avg_completion,
        "avg_rpe":             avg_rpe,
        "members_with_pain":   pain_member_names,
        "pain_flag_count":     len(pain_member_ids),
    }
