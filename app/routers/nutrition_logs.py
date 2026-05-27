"""Nutrition and supplement adherence log routers."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import auth, database, models
from app.alert_engine import process_supplement_log_alerts

router = APIRouter(prefix="/api/adherence-logs", tags=["adherence-logs"])


class NutritionLogCreate(BaseModel):
    member_id: int
    date: date
    nutrition_adherence_rating: Optional[str] = None
    hunger_level: Optional[str] = None
    cravings_level: Optional[str] = None
    water_intake: Optional[float] = None
    notes: Optional[str] = None


class SupplementLogCreate(BaseModel):
    member_id: int
    date: date
    supplement_plan_id: Optional[int] = None
    adherence_status: Optional[str] = None
    side_effects_reported: bool = False
    side_effect_notes: Optional[str] = None
    notes: Optional[str] = None


@router.post("/nutrition", summary="Log nutrition adherence")
def log_nutrition(
    data: NutritionLogCreate,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    log = models.NutritionAdherenceLog(**data.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return {"id": log.id, "member_id": log.member_id, "date": str(log.date), "nutrition_adherence_rating": log.nutrition_adherence_rating}


@router.get("/nutrition", summary="List nutrition logs")
def list_nutrition(
    member_id: Optional[int] = Query(None),
    limit: int = Query(30, le=100),
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    q = db.query(models.NutritionAdherenceLog)
    if member_id:
        q = q.filter(models.NutritionAdherenceLog.member_id == member_id)
    rows = q.order_by(models.NutritionAdherenceLog.date.desc()).limit(limit).all()
    return [{"id": r.id, "member_id": r.member_id, "date": str(r.date), "nutrition_adherence_rating": r.nutrition_adherence_rating, "hunger_level": r.hunger_level, "cravings_level": r.cravings_level, "water_intake": r.water_intake, "notes": r.notes} for r in rows]


@router.post("/supplement", summary="Log supplement adherence")
def log_supplement(
    data: SupplementLogCreate,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    log = models.SupplementAdherenceLog(**data.model_dump())
    db.add(log)
    process_supplement_log_alerts(db, log)
    db.commit()
    db.refresh(log)
    return {"id": log.id, "member_id": log.member_id, "date": str(log.date), "adherence_status": log.adherence_status, "side_effects_reported": log.side_effects_reported}


@router.get("/supplement", summary="List supplement logs")
def list_supplement(
    member_id: Optional[int] = Query(None),
    limit: int = Query(30, le=100),
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    q = db.query(models.SupplementAdherenceLog)
    if member_id:
        q = q.filter(models.SupplementAdherenceLog.member_id == member_id)
    rows = q.order_by(models.SupplementAdherenceLog.date.desc()).limit(limit).all()
    return [{"id": r.id, "member_id": r.member_id, "date": str(r.date), "supplement_plan_id": r.supplement_plan_id, "adherence_status": r.adherence_status, "side_effects_reported": r.side_effects_reported, "side_effect_notes": r.side_effect_notes, "notes": r.notes} for r in rows]
