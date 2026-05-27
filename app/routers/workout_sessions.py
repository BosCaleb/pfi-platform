"""Workout Session router — create, log exercises, complete."""
import logging
from datetime import timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth, database, models
from app.models import _utcnow
from app.schemas_phase2 import (
    SessionCreate, SessionUpdate, SessionOut,
    SessionExerciseCreate, SessionExerciseOut,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/workout-sessions", tags=["workout sessions"])


def _session_or_404(db: Session, session_id: int) -> models.WorkoutSession:
    s = db.query(models.WorkoutSession).filter(
        models.WorkoutSession.id == session_id
    ).first()
    if not s:
        raise HTTPException(404, "Workout session not found")
    return s


def _recalculate(session: models.WorkoutSession) -> None:
    """Recompute completion_percentage, pain_flag, and highest_pain_score."""
    exercises = session.exercises
    if not exercises:
        return
    completed = sum(1 for e in exercises if e.completed)
    total     = len(exercises)
    session.exercises_completed   = completed
    session.total_exercises       = total
    session.completion_percentage = round(completed / total * 100, 1) if total else 0.0
    pain_scores = [e.pain_score for e in exercises if e.pain_score is not None]
    if pain_scores:
        session.highest_pain_score = max(pain_scores)
        session.pain_flag          = max(pain_scores) >= 6
    else:
        session.highest_pain_score = None
        session.pain_flag          = False


# ── Sessions ────────────────────────────────────────────────────────────

@router.get("/member/{member_id}", response_model=List[SessionOut])
def list_member_sessions(
    member_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    return db.query(models.WorkoutSession).filter(
        models.WorkoutSession.member_id == member_id,
    ).order_by(models.WorkoutSession.session_date.desc()).all()


@router.post("/", response_model=SessionOut)
def create_session(
    data: SessionCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    session = models.WorkoutSession(
        member_id=data.member_id,
        session_date=data.session_date,
        workout_group_id=data.workout_group_id,
        workout_plan_id=data.workout_plan_id,
        workout_plan_version_id=data.workout_plan_version_id,
        workout_day_id=data.workout_day_id,
        member_notes=data.member_notes,
        completion_status="Not Started",
        started_at=_utcnow(),
    )

    # If linked to a plan day, pre-populate exercise entries from the plan
    if data.workout_day_id:
        day = db.query(models.WorkoutPlanDay).filter(
            models.WorkoutPlanDay.id == data.workout_day_id
        ).first()
        if day:
            all_plan_exercises = []
            for section in sorted(day.sections, key=lambda s: s.display_order):
                for pe in sorted(section.exercises, key=lambda x: x.display_order):
                    all_plan_exercises.append(pe)
            session.total_exercises = len(all_plan_exercises)
            db.add(session)
            db.flush()
            for pe in all_plan_exercises:
                ex_name = pe.exercise.exercise_name if pe.exercise else "Unknown"
                se = models.WorkoutSessionExercise(
                    workout_session_id=session.id,
                    planned_exercise_id=pe.id,
                    actual_exercise_id=pe.exercise_id,
                    exercise_name_snapshot=ex_name,
                    prescribed_sets=pe.prescribed_sets,
                    prescribed_reps=pe.prescribed_reps,
                    prescribed_weight=pe.prescribed_weight,
                    prescribed_duration_seconds=pe.prescribed_duration_seconds,
                    prescribed_distance=pe.prescribed_distance,
                    prescribed_rest_seconds=pe.prescribed_rest_seconds,
                    completed=False,
                )
                db.add(se)
        else:
            db.add(session)
    else:
        db.add(session)

    db.commit()
    db.refresh(session)
    logger.info("Workout session created for member %s", data.member_id)
    return session


@router.get("/{session_id}")
def get_session(
    session_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    s = _session_or_404(db, session_id)
    exercises = [
        {**{c.name: getattr(e, c.name) for c in e.__table__.columns}}
        for e in sorted(s.exercises, key=lambda x: x.id)
    ]
    return {
        **{c.name: getattr(s, c.name) for c in s.__table__.columns},
        "exercises": exercises,
    }


@router.put("/{session_id}", response_model=SessionOut)
def update_session(
    session_id: int,
    data: SessionUpdate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    session = _session_or_404(db, session_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(session, k, v)
    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_id}/complete", response_model=SessionOut)
def complete_session(
    session_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    session = _session_or_404(db, session_id)
    _recalculate(session)
    pct = session.completion_percentage
    session.completion_status = (
        "Completed" if pct >= 100
        else "Partially Completed" if pct > 0
        else "Skipped"
    )
    session.completed_at = _utcnow()
    db.commit()
    db.refresh(session)
    logger.info("Session %s completed (%.0f%%)", session_id, pct)
    return session


# ── Session exercises ───────────────────────────────────────────────────

@router.post("/{session_id}/exercises/", response_model=SessionExerciseOut)
def log_exercise(
    session_id: int,
    data: SessionExerciseCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    _session_or_404(db, session_id)
    se = models.WorkoutSessionExercise(workout_session_id=session_id, **data.model_dump())
    db.add(se)
    db.commit()
    db.refresh(se)

    # Recalculate session stats
    session = _session_or_404(db, session_id)
    _recalculate(session)
    db.commit()
    return se


@router.put("/{session_id}/exercises/{exercise_id}", response_model=SessionExerciseOut)
def update_session_exercise(
    session_id: int,
    exercise_id: int,
    data: SessionExerciseCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    se = db.query(models.WorkoutSessionExercise).filter(
        models.WorkoutSessionExercise.id == exercise_id,
        models.WorkoutSessionExercise.workout_session_id == session_id,
    ).first()
    if not se:
        raise HTTPException(404, "Session exercise not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(se, k, v)
    db.commit()
    db.refresh(se)

    session = _session_or_404(db, session_id)
    _recalculate(session)
    db.commit()
    return se
