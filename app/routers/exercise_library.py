"""Exercise Library router — CRUD + search/filter."""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth, database, models
from app.schemas_phase2 import ExerciseCreate, ExerciseOut, ExerciseUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/exercises", tags=["exercise library"])


def _ex_or_404(db: Session, exercise_id: int) -> models.ExerciseLibrary:
    ex = db.query(models.ExerciseLibrary).filter(
        models.ExerciseLibrary.id == exercise_id
    ).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return ex


@router.get("/", response_model=List[ExerciseOut])
def list_exercises(
    search:      Optional[str] = None,
    category:    Optional[str] = None,
    difficulty:  Optional[str] = None,
    impact:      Optional[str] = None,
    equipment:   Optional[str] = None,
    low_impact:  Optional[bool] = None,
    status:      Optional[str] = "Active",
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    q = db.query(models.ExerciseLibrary)
    if status:
        q = q.filter(models.ExerciseLibrary.status == status)
    if category:
        q = q.filter(models.ExerciseLibrary.exercise_category == category)
    if difficulty:
        q = q.filter(models.ExerciseLibrary.difficulty_level == difficulty)
    if impact:
        q = q.filter(models.ExerciseLibrary.impact_level == impact)
    if equipment:
        q = q.filter(models.ExerciseLibrary.equipment_needed == equipment)
    if low_impact is not None:
        q = q.filter(models.ExerciseLibrary.low_impact == low_impact)

    exercises = q.order_by(
        models.ExerciseLibrary.exercise_category,
        models.ExerciseLibrary.exercise_name,
    ).all()

    if search:
        s = search.lower()
        exercises = [
            e for e in exercises
            if s in (e.exercise_name or "").lower()
            or s in (e.primary_muscle_group or "").lower()
            or s in (e.exercise_category or "").lower()
        ]
    return exercises


@router.post("/", response_model=ExerciseOut)
def create_exercise(
    data: ExerciseCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    ex = models.ExerciseLibrary(**data.model_dump())
    db.add(ex)
    db.commit()
    db.refresh(ex)
    logger.info("Exercise created: %s (id=%s)", ex.exercise_name, ex.id)
    return ex


@router.get("/{exercise_id}", response_model=ExerciseOut)
def get_exercise(
    exercise_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    return _ex_or_404(db, exercise_id)


@router.put("/{exercise_id}", response_model=ExerciseOut)
def update_exercise(
    exercise_id: int,
    data: ExerciseUpdate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    ex = _ex_or_404(db, exercise_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(ex, k, v)
    db.commit()
    db.refresh(ex)
    return ex


@router.patch("/{exercise_id}/archive")
def archive_exercise(
    exercise_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    ex = _ex_or_404(db, exercise_id)
    ex.status = "Archived"
    db.commit()
    return {"message": "Exercise archived"}
