"""Gym Settings — GET/PUT single-row settings."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GymSettings
from app.auth import get_current_admin

router = APIRouter(prefix="/api/gym-settings", tags=["gym-settings"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _settings_dict(s: GymSettings) -> dict:
    return {
        "id": s.id,
        "gym_name": s.gym_name,
        "contact_email": s.contact_email,
        "contact_phone": s.contact_phone,
        "location": s.location,
        "operating_hours": s.operating_hours,
        "default_session_duration": s.default_session_duration,
        "default_cancellation_window_hours": s.default_cancellation_window_hours,
        "default_session_capacity": s.default_session_capacity,
        "currency": s.currency,
        "invoice_prefix": s.invoice_prefix,
        "timezone": s.timezone,
        "membership_terms": s.membership_terms,
        "cancellation_policy": s.cancellation_policy,
        "privacy_policy": s.privacy_policy,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def _get_or_create(db: Session) -> GymSettings:
    s = db.query(GymSettings).first()
    if not s:
        s = GymSettings()
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.get("/")
def get_gym_settings(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    return _settings_dict(_get_or_create(db))


@router.put("/")
def update_gym_settings(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    s = _get_or_create(db)
    for k, v in body.items():
        if k not in ("id", "created_at", "updated_at") and hasattr(s, k):
            setattr(s, k, v)
    s.updated_at = _utcnow()
    db.commit()
    db.refresh(s)
    return _settings_dict(s)
