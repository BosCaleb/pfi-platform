"""Weekly Member Check-In router."""
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import auth, database, models

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/weekly-check-ins", tags=["weekly-check-ins"])


class WeeklyCheckInCreate(BaseModel):
    member_id: int
    week_start_date: date
    week_end_date: date
    average_energy: Optional[str] = None
    average_sleep_hours: Optional[float] = None
    average_stress: Optional[str] = None
    average_soreness: Optional[str] = None
    average_pain: Optional[float] = None
    weight_update: Optional[float] = None
    waist_update: Optional[float] = None
    progress_photo_url: Optional[str] = None
    perceived_progress: Optional[str] = None
    workout_adherence_self_rating: Optional[str] = None
    nutrition_adherence_self_rating: Optional[str] = None
    supplement_adherence_self_rating: Optional[str] = None
    biggest_win_this_week: Optional[str] = None
    biggest_challenge_this_week: Optional[str] = None
    coach_support_needed: Optional[str] = "No"
    member_notes: Optional[str] = None
    submitted_by: Optional[str] = "Admin"


@router.post("/", summary="Submit a weekly check-in")
def create_weekly_check_in(
    data: WeeklyCheckInCreate,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    member = db.query(models.Member).filter(models.Member.id == data.member_id).first()
    if not member:
        raise HTTPException(404, "Member not found.")

    ci = models.WeeklyMemberCheckIn(**data.model_dump())
    db.add(ci)

    # Auto-create coach task if coach support requested
    if data.coach_support_needed == "Yes":
        task = models.CoachTask(
            member_id=data.member_id,
            task_type="Coach Follow-Up",
            title="Member requested coach support",
            description=f"Weekly check-in for {data.week_start_date} – {data.week_end_date}. Member notes: {data.member_notes or 'None'}.",
            priority="High",
            status="Open",
            created_by_system=True,
        )
        db.add(task)

    # Auto-flag poor nutrition adherence
    if data.nutrition_adherence_self_rating == "Poor":
        task = models.CoachTask(
            member_id=data.member_id,
            task_type="Nutrition Review",
            title="Poor nutrition adherence reported",
            description=f"Member self-rated nutrition adherence as Poor for week {data.week_start_date}.",
            priority="Medium",
            status="Open",
            created_by_system=True,
        )
        db.add(task)

    db.commit()
    db.refresh(ci)
    return _serialize(ci)


@router.get("/", summary="List weekly check-ins")
def list_weekly_check_ins(
    member_id: Optional[int] = Query(None),
    limit: int = Query(20, le=100),
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    q = db.query(models.WeeklyMemberCheckIn)
    if member_id:
        q = q.filter(models.WeeklyMemberCheckIn.member_id == member_id)
    rows = q.order_by(models.WeeklyMemberCheckIn.week_start_date.desc()).limit(limit).all()
    return [_serialize(r) for r in rows]


@router.get("/{ci_id}", summary="Get a weekly check-in")
def get_weekly_check_in(
    ci_id: int,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    ci = db.query(models.WeeklyMemberCheckIn).filter(models.WeeklyMemberCheckIn.id == ci_id).first()
    if not ci:
        raise HTTPException(404, "Weekly check-in not found.")
    return _serialize(ci)


@router.delete("/{ci_id}", summary="Delete a weekly check-in")
def delete_weekly_check_in(
    ci_id: int,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    ci = db.query(models.WeeklyMemberCheckIn).filter(models.WeeklyMemberCheckIn.id == ci_id).first()
    if not ci:
        raise HTTPException(404, "Not found.")
    db.delete(ci)
    db.commit()
    return {"message": "Deleted."}


def _serialize(ci: models.WeeklyMemberCheckIn) -> dict:
    return {
        "id": ci.id,
        "member_id": ci.member_id,
        "week_start_date": str(ci.week_start_date),
        "week_end_date": str(ci.week_end_date),
        "check_in_type": ci.check_in_type,
        "average_energy": ci.average_energy,
        "average_sleep_hours": ci.average_sleep_hours,
        "average_stress": ci.average_stress,
        "average_soreness": ci.average_soreness,
        "average_pain": ci.average_pain,
        "weight_update": ci.weight_update,
        "waist_update": ci.waist_update,
        "perceived_progress": ci.perceived_progress,
        "workout_adherence_self_rating": ci.workout_adherence_self_rating,
        "nutrition_adherence_self_rating": ci.nutrition_adherence_self_rating,
        "supplement_adherence_self_rating": ci.supplement_adherence_self_rating,
        "biggest_win_this_week": ci.biggest_win_this_week,
        "biggest_challenge_this_week": ci.biggest_challenge_this_week,
        "coach_support_needed": ci.coach_support_needed,
        "member_notes": ci.member_notes,
        "submitted_by": ci.submitted_by,
        "created_at": ci.created_at.isoformat() if ci.created_at else None,
    }
