"""Integration Readiness Layer — settings, status, and event logs for external services."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_admin
from app.models import IntegrationSetting, IntegrationEventLog

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

INTEGRATION_CATALOGUE = [
    {"service_name": "Google Calendar",  "category": "Calendar",  "description": "Sync gym sessions and appointments to Google Calendar."},
    {"service_name": "Email (SMTP)",     "category": "Messaging", "description": "Send automated emails for bookings, invoices, and reports."},
    {"service_name": "WhatsApp (Twilio)","category": "Messaging", "description": "Send WhatsApp notifications to members."},
    {"service_name": "SMS (Twilio)",     "category": "Messaging", "description": "Send SMS reminders and alerts."},
    {"service_name": "Yoco",             "category": "Payments",  "description": "Accept card payments via Yoco (South African POS/gateway)."},
    {"service_name": "PayFast",          "category": "Payments",  "description": "South African online payment gateway."},
    {"service_name": "Ozow",             "category": "Payments",  "description": "Instant EFT and payment processing."},
    {"service_name": "Stripe",           "category": "Payments",  "description": "Global card and subscription billing."},
    {"service_name": "Google Fit",       "category": "Wearables", "description": "Import workout and health data from Google Fit."},
    {"service_name": "Apple Health",     "category": "Wearables", "description": "Import workout and health data from Apple Health."},
    {"service_name": "Garmin Connect",   "category": "Wearables", "description": "Sync training data from Garmin devices."},
    {"service_name": "Fitbit",           "category": "Wearables", "description": "Sync activity and sleep data from Fitbit."},
]


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _setting_dict(s: IntegrationSetting) -> dict:
    return {
        "id": s.id,
        "service_name": s.service_name,
        "is_enabled": s.is_enabled,
        "config_json": s.config_json,
        "status": s.status,
        "last_sync_at": s.last_sync_at.isoformat() if s.last_sync_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def _log_dict(log: IntegrationEventLog) -> dict:
    return {
        "id": log.id,
        "integration_id": log.integration_id,
        "event_type": log.event_type,
        "status": log.status,
        "message": log.message,
        "payload_summary": log.payload_summary,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


@router.get("/catalogue")
def get_catalogue(admin=Depends(get_current_admin)):
    return INTEGRATION_CATALOGUE


@router.get("/")
def list_integrations(
    category: Optional[str] = None,
    enabled:  Optional[bool] = None,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    q = db.query(IntegrationSetting)
    if category: q = q.filter(IntegrationSetting.service_name.ilike(f"%{category}%"))
    if enabled is not None: q = q.filter(IntegrationSetting.is_enabled == enabled)
    return [_setting_dict(s) for s in q.order_by(IntegrationSetting.service_name).all()]


@router.post("/", status_code=201)
def create_integration(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    service_name = body.get("service_name")
    if not service_name:
        raise HTTPException(400, "service_name required")
    existing = db.query(IntegrationSetting).filter(
        IntegrationSetting.service_name == service_name
    ).first()
    if existing:
        raise HTTPException(409, f"Integration '{service_name}' already exists")
    s = IntegrationSetting(
        service_name = service_name,
        is_enabled   = body.get("is_enabled", False),
        config_json  = body.get("config_json"),
        status       = body.get("status", "Not Configured"),
        created_at   = _utcnow(),
        updated_at   = _utcnow(),
    )
    db.add(s); db.commit(); db.refresh(s)
    return _setting_dict(s)


@router.get("/logs")
def list_logs(
    integration_id: Optional[int] = None,
    status:         Optional[str] = None,
    limit:          int = 100,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    q = db.query(IntegrationEventLog)
    if integration_id: q = q.filter(IntegrationEventLog.integration_id == integration_id)
    if status:         q = q.filter(IntegrationEventLog.status == status)
    logs = q.order_by(IntegrationEventLog.created_at.desc()).limit(limit).all()
    return [_log_dict(log) for log in logs]


@router.post("/logs", status_code=201)
def create_log(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    log = IntegrationEventLog(
        integration_id  = body.get("integration_id"),
        event_type      = body.get("event_type", "manual"),
        status          = body.get("status", "Success"),
        message         = body.get("message"),
        payload_summary = body.get("payload_summary"),
        created_at      = _utcnow(),
    )
    db.add(log); db.commit(); db.refresh(log)
    return _log_dict(log)


@router.get("/{sid}")
def get_integration(sid: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    s = db.query(IntegrationSetting).filter(IntegrationSetting.id == sid).first()
    if not s: raise HTTPException(404, "Integration not found")
    return _setting_dict(s)


@router.put("/{sid}")
def update_integration(sid: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    s = db.query(IntegrationSetting).filter(IntegrationSetting.id == sid).first()
    if not s: raise HTTPException(404, "Integration not found")
    for k in ("is_enabled", "config_json", "status", "last_sync_at"):
        if k in body:
            setattr(s, k, body[k])
    s.updated_at = _utcnow()
    db.commit(); db.refresh(s)
    return _setting_dict(s)


@router.delete("/{sid}", status_code=204)
def delete_integration(sid: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    s = db.query(IntegrationSetting).filter(IntegrationSetting.id == sid).first()
    if not s: raise HTTPException(404, "Integration not found")
    db.delete(s); db.commit()
