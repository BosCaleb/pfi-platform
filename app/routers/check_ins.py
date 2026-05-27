"""
Daily Member Check-In router.

POST /api/check-ins/               — submit a daily check-in
GET  /api/check-ins/               — list check-ins (filterable by member_id, date)
GET  /api/check-ins/{id}           — get single check-in
DELETE /api/check-ins/{id}         — delete check-in

On every POST, the engine calculates:
  - ReadinessScore
  - RecoveryScore
And runs alert rules (pain flags, coach tasks).
"""
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import auth, database, models
from app.scoring_engine import calculate_readiness_score, calculate_recovery_score
from app.alert_engine import process_check_in_alerts

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/check-ins", tags=["check-ins"])


class CheckInCreate(BaseModel):
    member_id: int
    check_in_date: date
    energy_level: Optional[str] = None
    sleep_hours: Optional[float] = None
    sleep_quality: Optional[str] = None
    stress_level: Optional[str] = None
    muscle_soreness: Optional[str] = None
    pain_level: Optional[int] = None
    pain_location: Optional[str] = None
    mood: Optional[str] = None
    motivation_level: Optional[str] = None
    hydration_status: Optional[str] = None
    nutrition_adherence: Optional[str] = None
    supplement_adherence: Optional[str] = None
    workout_readiness: Optional[str] = None
    new_injury_reported: Optional[str] = "No"
    injury_notes: Optional[str] = None
    member_notes: Optional[str] = None
    submitted_by: Optional[str] = "Admin"


@router.post("/", summary="Submit a daily check-in")
def create_check_in(
    data: CheckInCreate,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    member = db.query(models.Member).filter(models.Member.id == data.member_id).first()
    if not member:
        raise HTTPException(404, "Member not found.")

    check_in = models.MemberCheckIn(
        member_id=data.member_id,
        check_in_date=data.check_in_date,
        energy_level=data.energy_level,
        sleep_hours=data.sleep_hours,
        sleep_quality=data.sleep_quality,
        stress_level=data.stress_level,
        muscle_soreness=data.muscle_soreness,
        pain_level=data.pain_level,
        pain_location=data.pain_location,
        mood=data.mood,
        motivation_level=data.motivation_level,
        hydration_status=data.hydration_status,
        nutrition_adherence=data.nutrition_adherence,
        supplement_adherence=data.supplement_adherence,
        workout_readiness=data.workout_readiness,
        new_injury_reported=data.new_injury_reported or "No",
        injury_notes=data.injury_notes,
        member_notes=data.member_notes,
        submitted_by=data.submitted_by or "Admin",
    )
    db.add(check_in)
    db.flush()

    # ── Calculate scores ───────────────────────────────────────────────
    r = calculate_readiness_score(
        sleep_hours=data.sleep_hours,
        sleep_quality=data.sleep_quality,
        energy_level=data.energy_level,
        stress_level=data.stress_level,
        muscle_soreness=data.muscle_soreness,
        pain_level=data.pain_level,
        mood=data.mood,
        motivation_level=data.motivation_level,
        nutrition_adherence=data.nutrition_adherence,
        new_injury_reported=data.new_injury_reported,
        workout_readiness=data.workout_readiness,
    )
    readiness = models.ReadinessScore(
        member_id=data.member_id,
        check_in_id=check_in.id,
        score=r["score"],
        category=r["category"],
        recommendation_summary=r["recommendation_summary"],
        score_breakdown_json=r["score_breakdown_json"],
    )
    db.add(readiness)

    rec = calculate_recovery_score(
        sleep_hours=data.sleep_hours,
        sleep_quality=data.sleep_quality,
        stress_level=data.stress_level,
        muscle_soreness=data.muscle_soreness,
        pain_level=data.pain_level,
    )
    recovery = models.RecoveryScore(
        member_id=data.member_id,
        check_in_id=check_in.id,
        score=rec["score"],
        category=rec["category"],
        score_breakdown_json=rec["score_breakdown_json"],
    )
    db.add(recovery)
    db.flush()

    # ── Alert rules ────────────────────────────────────────────────────
    process_check_in_alerts(db, check_in, r["score"], rec["score"])

    db.commit()
    db.refresh(check_in)

    return {
        "id": check_in.id,
        "member_id": check_in.member_id,
        "check_in_date": str(check_in.check_in_date),
        "readiness_score": r["score"],
        "readiness_category": r["category"],
        "recovery_score": rec["score"],
        "recovery_category": rec["category"],
        "recommendation": r["recommendation_summary"],
    }


@router.get("/", summary="List check-ins")
def list_check_ins(
    member_id: Optional[int] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    limit: int = Query(50, le=200),
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    q = db.query(models.MemberCheckIn)
    if member_id:
        q = q.filter(models.MemberCheckIn.member_id == member_id)
    if from_date:
        q = q.filter(models.MemberCheckIn.check_in_date >= from_date)
    if to_date:
        q = q.filter(models.MemberCheckIn.check_in_date <= to_date)
    rows = q.order_by(models.MemberCheckIn.check_in_date.desc()).limit(limit).all()
    return [_serialize(r) for r in rows]


@router.get("/{check_in_id}", summary="Get a single check-in")
def get_check_in(
    check_in_id: int,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    ci = db.query(models.MemberCheckIn).filter(models.MemberCheckIn.id == check_in_id).first()
    if not ci:
        raise HTTPException(404, "Check-in not found.")
    return _serialize(ci)


@router.delete("/{check_in_id}", summary="Delete a check-in")
def delete_check_in(
    check_in_id: int,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    ci = db.query(models.MemberCheckIn).filter(models.MemberCheckIn.id == check_in_id).first()
    if not ci:
        raise HTTPException(404, "Check-in not found.")
    db.delete(ci)
    db.commit()
    return {"message": "Check-in deleted."}


def _serialize(ci: models.MemberCheckIn) -> dict:
    return {
        "id": ci.id,
        "member_id": ci.member_id,
        "check_in_date": str(ci.check_in_date),
        "check_in_type": ci.check_in_type,
        "energy_level": ci.energy_level,
        "sleep_hours": ci.sleep_hours,
        "sleep_quality": ci.sleep_quality,
        "stress_level": ci.stress_level,
        "muscle_soreness": ci.muscle_soreness,
        "pain_level": ci.pain_level,
        "pain_location": ci.pain_location,
        "mood": ci.mood,
        "motivation_level": ci.motivation_level,
        "hydration_status": ci.hydration_status,
        "nutrition_adherence": ci.nutrition_adherence,
        "supplement_adherence": ci.supplement_adherence,
        "workout_readiness": ci.workout_readiness,
        "new_injury_reported": ci.new_injury_reported,
        "injury_notes": ci.injury_notes,
        "member_notes": ci.member_notes,
        "submitted_by": ci.submitted_by,
        "created_at": ci.created_at.isoformat() if ci.created_at else None,
    }
