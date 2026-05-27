"""Workout Plan Builder router — full hierarchy CRUD + version management."""
import logging
from datetime import timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app import auth, database, models
from app.schemas_phase2 import (
    PlanTemplateCreate, PlanTemplateOut,
    PlanVersionCreate, PlanVersionOut,
    WeekCreate, WeekOut,
    DayCreate, DayOut,
    SectionCreate, SectionOut,
    PlanExerciseCreate, PlanExerciseOut,
)
from app.models import _utcnow

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/plan-builder", tags=["plan builder"])


# ── Helpers ─────────────────────────────────────────────────────────────

def _plan_or_404(db, plan_id):
    p = db.query(models.WorkoutPlanTemplate).filter(
        models.WorkoutPlanTemplate.id == plan_id
    ).first()
    if not p:
        raise HTTPException(404, "Workout plan not found")
    return p

def _version_or_404(db, version_id):
    v = db.query(models.WorkoutPlanVersion).filter(
        models.WorkoutPlanVersion.id == version_id
    ).first()
    if not v:
        raise HTTPException(404, "Plan version not found")
    return v

def _week_or_404(db, week_id):
    w = db.query(models.WorkoutPlanWeek).filter(
        models.WorkoutPlanWeek.id == week_id
    ).first()
    if not w:
        raise HTTPException(404, "Plan week not found")
    return w

def _day_or_404(db, day_id):
    d = db.query(models.WorkoutPlanDay).filter(
        models.WorkoutPlanDay.id == day_id
    ).first()
    if not d:
        raise HTTPException(404, "Plan day not found")
    return d

def _section_or_404(db, section_id):
    s = db.query(models.WorkoutSection).filter(
        models.WorkoutSection.id == section_id
    ).first()
    if not s:
        raise HTTPException(404, "Workout section not found")
    return s


def _serialise_plan_full(plan: models.WorkoutPlanTemplate) -> dict:
    """Return plan with nested versions/weeks/days/sections/exercises."""
    versions = []
    for v in sorted(plan.versions, key=lambda x: x.version_number):
        weeks = []
        for w in sorted(v.weeks, key=lambda x: x.week_number):
            days = []
            for d in sorted(w.days, key=lambda x: x.day_number):
                sections = []
                for s in sorted(d.sections, key=lambda x: x.display_order):
                    exercises = []
                    for pe in sorted(s.exercises, key=lambda x: x.display_order):
                        ex_name = pe.exercise.exercise_name if pe.exercise else "Unknown"
                        exercises.append({
                            "id":                           pe.id,
                            "exercise_id":                  pe.exercise_id,
                            "exercise_name":                ex_name,
                            "display_order":                pe.display_order,
                            "prescribed_sets":              pe.prescribed_sets,
                            "prescribed_reps":              pe.prescribed_reps,
                            "prescribed_weight":            pe.prescribed_weight,
                            "prescribed_duration_seconds":  pe.prescribed_duration_seconds,
                            "prescribed_distance":          pe.prescribed_distance,
                            "prescribed_rest_seconds":      pe.prescribed_rest_seconds,
                            "prescribed_tempo":             pe.prescribed_tempo,
                            "prescribed_rpe":               pe.prescribed_rpe,
                            "coach_notes":                  pe.coach_notes,
                            "is_optional":                  pe.is_optional,
                            "substitution_allowed":         pe.substitution_allowed,
                        })
                    sections.append({
                        "id":            s.id,
                        "section_name":  s.section_name,
                        "section_type":  s.section_type,
                        "display_order": s.display_order,
                        "notes":         s.notes,
                        "exercises":     exercises,
                    })
                days.append({
                    "id":                        d.id,
                    "day_number":                d.day_number,
                    "day_name":                  d.day_name,
                    "day_focus":                 d.day_focus,
                    "estimated_duration_minutes":d.estimated_duration_minutes,
                    "intensity_level":           d.intensity_level,
                    "notes":                     d.notes,
                    "sections":                  sections,
                })
            weeks.append({
                "id":          w.id,
                "week_number": w.week_number,
                "week_focus":  w.week_focus,
                "notes":       w.notes,
                "days":        days,
            })
        versions.append({
            "id":             v.id,
            "version_number": v.version_number,
            "version_notes":  v.version_notes,
            "is_active":      v.is_active,
            "created_at":     v.created_at,
            "published_at":   v.published_at,
            "weeks":          weeks,
        })
    return {
        **{c.name: getattr(plan, c.name) for c in plan.__table__.columns},
        "versions": versions,
    }


# ── Plan templates ──────────────────────────────────────────────────────

@router.get("/plans/", response_model=List[PlanTemplateOut])
def list_plans(
    status: Optional[str] = None,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    q = db.query(models.WorkoutPlanTemplate)
    if status:
        q = q.filter(models.WorkoutPlanTemplate.status == status)
    return q.order_by(models.WorkoutPlanTemplate.plan_name).all()


@router.post("/plans/", response_model=PlanTemplateOut)
def create_plan(
    data: PlanTemplateCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    plan = models.WorkoutPlanTemplate(**data.model_dump())
    db.add(plan)
    db.flush()
    # Auto-create version 1
    v1 = models.WorkoutPlanVersion(workout_plan_id=plan.id, version_number=1, is_active=False)
    db.add(v1)
    db.commit()
    db.refresh(plan)
    logger.info("Workout plan created: %s (id=%s)", plan.plan_name, plan.id)
    return plan


@router.get("/plans/{plan_id}")
def get_plan(
    plan_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    plan = _plan_or_404(db, plan_id)
    return _serialise_plan_full(plan)


@router.put("/plans/{plan_id}", response_model=PlanTemplateOut)
def update_plan(
    plan_id: int,
    data: PlanTemplateCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    plan = _plan_or_404(db, plan_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(plan, k, v)
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/plans/{plan_id}")
def delete_plan(
    plan_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    plan = _plan_or_404(db, plan_id)
    db.delete(plan)
    db.commit()
    return {"message": "Plan deleted"}


# ── Versions ────────────────────────────────────────────────────────────

@router.post("/plans/{plan_id}/versions/", response_model=PlanVersionOut)
def create_version(
    plan_id: int,
    data: PlanVersionCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    _plan_or_404(db, plan_id)
    existing_versions = db.query(models.WorkoutPlanVersion).filter(
        models.WorkoutPlanVersion.workout_plan_id == plan_id
    ).all()
    next_number = max((v.version_number for v in existing_versions), default=0) + 1
    version = models.WorkoutPlanVersion(
        workout_plan_id=plan_id,
        version_number=next_number,
        version_notes=data.version_notes,
        is_active=False,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    logger.info("Plan version %s created for plan %s", next_number, plan_id)
    return version


@router.post("/versions/{version_id}/publish")
def publish_version(
    version_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    version = _version_or_404(db, version_id)
    # Deactivate all other versions for this plan
    other_versions = db.query(models.WorkoutPlanVersion).filter(
        models.WorkoutPlanVersion.workout_plan_id == version.workout_plan_id,
        models.WorkoutPlanVersion.id != version_id,
    ).all()
    for v in other_versions:
        v.is_active = False

    version.is_active = True
    version.published_at = _utcnow()

    # Update plan status
    plan = version.plan
    plan.status = "Active"
    db.commit()
    logger.info("Plan version %s published", version_id)
    return {"message": f"Version {version.version_number} published"}


@router.delete("/versions/{version_id}")
def delete_version(
    version_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    version = _version_or_404(db, version_id)
    if version.is_active:
        raise HTTPException(400, "Cannot delete the active version. Publish another version first.")
    db.delete(version)
    db.commit()
    return {"message": "Version deleted"}


# ── Weeks ───────────────────────────────────────────────────────────────

@router.post("/versions/{version_id}/weeks/", response_model=WeekOut)
def add_week(
    version_id: int,
    data: WeekCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    _version_or_404(db, version_id)
    week = models.WorkoutPlanWeek(plan_version_id=version_id, **data.model_dump())
    db.add(week)
    db.commit()
    db.refresh(week)
    return week


@router.put("/weeks/{week_id}", response_model=WeekOut)
def update_week(
    week_id: int,
    data: WeekCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    week = _week_or_404(db, week_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(week, k, v)
    db.commit()
    db.refresh(week)
    return week


@router.delete("/weeks/{week_id}")
def delete_week(
    week_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    week = _week_or_404(db, week_id)
    db.delete(week)
    db.commit()
    return {"message": "Week deleted"}


# ── Days ────────────────────────────────────────────────────────────────

@router.post("/weeks/{week_id}/days/", response_model=DayOut)
def add_day(
    week_id: int,
    data: DayCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    _week_or_404(db, week_id)
    day = models.WorkoutPlanDay(week_id=week_id, **data.model_dump())
    db.add(day)
    db.commit()
    db.refresh(day)
    return day


@router.put("/days/{day_id}", response_model=DayOut)
def update_day(
    day_id: int,
    data: DayCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    day = _day_or_404(db, day_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(day, k, v)
    db.commit()
    db.refresh(day)
    return day


@router.delete("/days/{day_id}")
def delete_day(
    day_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    day = _day_or_404(db, day_id)
    db.delete(day)
    db.commit()
    return {"message": "Day deleted"}


# ── Sections ────────────────────────────────────────────────────────────

@router.post("/days/{day_id}/sections/", response_model=SectionOut)
def add_section(
    day_id: int,
    data: SectionCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    _day_or_404(db, day_id)
    section = models.WorkoutSection(workout_day_id=day_id, **data.model_dump())
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


@router.put("/sections/{section_id}", response_model=SectionOut)
def update_section(
    section_id: int,
    data: SectionCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    section = _section_or_404(db, section_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(section, k, v)
    db.commit()
    db.refresh(section)
    return section


@router.delete("/sections/{section_id}")
def delete_section(
    section_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    section = _section_or_404(db, section_id)
    db.delete(section)
    db.commit()
    return {"message": "Section deleted"}


# ── Plan exercises ──────────────────────────────────────────────────────

@router.post("/sections/{section_id}/exercises/", response_model=PlanExerciseOut)
def add_exercise_to_section(
    section_id: int,
    data: PlanExerciseCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    _section_or_404(db, section_id)
    exercise = db.query(models.ExerciseLibrary).filter(
        models.ExerciseLibrary.id == data.exercise_id
    ).first()
    if not exercise:
        raise HTTPException(404, "Exercise not found in library")

    pe = models.WorkoutPlanExercise(workout_section_id=section_id, **data.model_dump())
    db.add(pe)
    db.commit()
    db.refresh(pe)
    return {**{c.name: getattr(pe, c.name) for c in pe.__table__.columns},
            "exercise_name": exercise.exercise_name}


@router.put("/section-exercises/{pe_id}", response_model=PlanExerciseOut)
def update_plan_exercise(
    pe_id: int,
    data: PlanExerciseCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    pe = db.query(models.WorkoutPlanExercise).filter(
        models.WorkoutPlanExercise.id == pe_id
    ).first()
    if not pe:
        raise HTTPException(404, "Plan exercise not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(pe, k, v)
    db.commit()
    db.refresh(pe)
    ex_name = pe.exercise.exercise_name if pe.exercise else "Unknown"
    return {**{c.name: getattr(pe, c.name) for c in pe.__table__.columns},
            "exercise_name": ex_name}


@router.delete("/section-exercises/{pe_id}")
def delete_plan_exercise(
    pe_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    pe = db.query(models.WorkoutPlanExercise).filter(
        models.WorkoutPlanExercise.id == pe_id
    ).first()
    if not pe:
        raise HTTPException(404, "Plan exercise not found")
    db.delete(pe)
    db.commit()
    return {"message": "Exercise removed from section"}
