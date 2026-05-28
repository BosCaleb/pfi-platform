"""Gym Sessions — scheduling CRUD with capacity tracking."""
from datetime import datetime, timezone, date as date_type
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import GymSession, SessionBooking, Admin
from app.auth import get_current_admin

router = APIRouter(prefix="/api/gym-sessions", tags=["gym-sessions"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _session_dict(s: GymSession, db: Session) -> dict:
    coach = db.query(Admin).filter(Admin.id == s.coach_admin_id).first() if s.coach_admin_id else None
    booked_count = (
        db.query(func.count(SessionBooking.id))
        .filter(SessionBooking.session_id == s.id, SessionBooking.booking_status.in_(["Booked", "Waitlisted"]))
        .scalar() or 0
    )
    return {
        "id": s.id,
        "session_title": s.session_title,
        "session_type": s.session_type,
        "workout_group_id": s.workout_group_id,
        "workout_plan_id": s.workout_plan_id,
        "coach_admin_id": s.coach_admin_id,
        "coach_name": coach.email if coach else None,
        "session_date": s.session_date.isoformat() if s.session_date else None,
        "start_time": s.start_time,
        "end_time": s.end_time,
        "capacity": s.capacity,
        "booked_count": booked_count,
        "spots_available": max(0, (s.capacity or 1) - booked_count),
        "location": s.location,
        "session_status": s.session_status,
        "notes": s.notes,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("/")
def list_sessions(
    session_date: Optional[str] = None,
    session_type: Optional[str] = None,
    status: Optional[str] = None,
    coach_admin_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(GymSession)
    if session_date:
        q = q.filter(GymSession.session_date == date_type.fromisoformat(session_date))
    if session_type:
        q = q.filter(GymSession.session_type == session_type)
    if status:
        q = q.filter(GymSession.session_status == status)
    if coach_admin_id:
        q = q.filter(GymSession.coach_admin_id == coach_admin_id)
    items = q.order_by(GymSession.session_date, GymSession.start_time).all()
    return [_session_dict(s, db) for s in items]


@router.get("/upcoming")
def upcoming_sessions(
    days: int = 7,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    from datetime import timedelta
    today = datetime.now(timezone.utc).date()
    end = today + timedelta(days=days)
    items = (
        db.query(GymSession)
        .filter(
            GymSession.session_date >= today,
            GymSession.session_date <= end,
            GymSession.session_status == "Scheduled",
        )
        .order_by(GymSession.session_date, GymSession.start_time)
        .all()
    )
    return [_session_dict(s, db) for s in items]


@router.post("/", status_code=201)
def create_session(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    if not body.get("session_title"):
        raise HTTPException(400, "session_title is required")
    if not body.get("session_date"):
        raise HTTPException(400, "session_date is required")
    body.pop("id", None)
    body.pop("created_at", None)
    body.pop("updated_at", None)
    if isinstance(body.get("session_date"), str):
        body["session_date"] = date_type.fromisoformat(body["session_date"])
    s = GymSession(**body)
    db.add(s)
    db.commit()
    db.refresh(s)
    return _session_dict(s, db)


@router.get("/{session_id}")
def get_session(session_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    s = db.query(GymSession).filter(GymSession.id == session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")
    # include bookings
    result = _session_dict(s, db)
    bookings = db.query(SessionBooking).filter(SessionBooking.session_id == session_id).all()
    result["bookings"] = [
        {
            "id": b.id,
            "member_id": b.member_id,
            "booking_status": b.booking_status,
            "booked_by": b.booked_by,
            "booking_date": b.booking_date.isoformat() if b.booking_date else None,
            "notes": b.notes,
        }
        for b in bookings
    ]
    return result


@router.put("/{session_id}")
def update_session(session_id: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    s = db.query(GymSession).filter(GymSession.id == session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")
    for k, v in body.items():
        if k not in ("id", "created_at", "updated_at") and hasattr(s, k):
            if k == "session_date" and isinstance(v, str):
                v = date_type.fromisoformat(v) if v else None
            setattr(s, k, v)
    s.updated_at = _utcnow()
    db.commit()
    db.refresh(s)
    return _session_dict(s, db)


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    s = db.query(GymSession).filter(GymSession.id == session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")
    db.delete(s)
    db.commit()
