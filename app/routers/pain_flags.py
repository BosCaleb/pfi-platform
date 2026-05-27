"""Pain and Risk Flag router."""
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import auth, database, models

router = APIRouter(prefix="/api/pain-flags", tags=["pain-flags"])


class FlagCreate(BaseModel):
    member_id: int
    source_type: str = "Admin Note"
    source_id: Optional[int] = None
    pain_score: Optional[int] = None
    pain_location: Optional[str] = None
    risk_level: str = "Medium"
    flag_message: str
    recommended_action: Optional[str] = None


class FlagUpdate(BaseModel):
    status: Optional[str] = None
    risk_level: Optional[str] = None
    recommended_action: Optional[str] = None


@router.post("/", summary="Create a pain/risk flag manually")
def create_flag(
    data: FlagCreate,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    flag = models.PainRiskFlag(**data.model_dump())
    db.add(flag)
    db.commit()
    db.refresh(flag)
    return _serialize(flag)


@router.get("/", summary="List pain/risk flags")
def list_flags(
    member_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    q = db.query(models.PainRiskFlag)
    if member_id:
        q = q.filter(models.PainRiskFlag.member_id == member_id)
    if status:
        q = q.filter(models.PainRiskFlag.status == status)
    if risk_level:
        q = q.filter(models.PainRiskFlag.risk_level == risk_level)
    rows = q.order_by(models.PainRiskFlag.created_at.desc()).limit(limit).all()
    return [_serialize(r) for r in rows]


@router.patch("/{flag_id}", summary="Update a pain flag")
def update_flag(
    flag_id: int,
    data: FlagUpdate,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    flag = db.query(models.PainRiskFlag).filter(models.PainRiskFlag.id == flag_id).first()
    if not flag:
        raise HTTPException(404, "Flag not found.")
    if data.status:
        flag.status = data.status
        if data.status in ("Reviewed", "Closed"):
            flag.reviewed_at = datetime.now(tz=timezone.utc)
            flag.reviewed_by_admin_id = admin.id
    if data.risk_level:
        flag.risk_level = data.risk_level
    if data.recommended_action is not None:
        flag.recommended_action = data.recommended_action
    db.commit()
    db.refresh(flag)
    return _serialize(flag)


def _serialize(f: models.PainRiskFlag) -> dict:
    return {
        "id": f.id,
        "member_id": f.member_id,
        "source_type": f.source_type,
        "source_id": f.source_id,
        "pain_score": f.pain_score,
        "pain_location": f.pain_location,
        "risk_level": f.risk_level,
        "flag_message": f.flag_message,
        "recommended_action": f.recommended_action,
        "status": f.status,
        "created_at": f.created_at.isoformat() if f.created_at else None,
        "reviewed_at": f.reviewed_at.isoformat() if f.reviewed_at else None,
        "reviewed_by_admin_id": f.reviewed_by_admin_id,
    }
