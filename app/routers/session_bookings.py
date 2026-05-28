"""Session Bookings — booking management with capacity and waitlist logic."""
from datetime import datetime, timezone, date as date_type
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import SessionBooking, GymSession, Member
from app.auth import get_current_admin

router = APIRouter(prefix="/api/session-bookings", tags=["session-bookings"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _today():
    return datetime.now(timezone.utc).date()


def _booking_dict(b: SessionBooking, db: Session) -> dict:
    member = db.query(Member).filter(Member.id == b.member_id).first()
    session = db.query(GymSession).filter(GymSession.id == b.session_id).first()
    return {
        "id": b.id,
        "session_id": b.session_id,
        "session_title": session.session_title if session else None,
        "session_date": session.session_date.isoformat() if session and session.session_date else None,
        "start_time": session.start_time if session else None,
        "member_id": b.member_id,
        "member_name": f"{member.first_name} {member.last_name}" if member else None,
        "booking_status": b.booking_status,
        "booked_by": b.booked_by,
        "booking_date": b.booking_date.isoformat() if b.booking_date else None,
        "cancellation_reason": b.cancellation_reason,
        "cancelled_at": b.cancelled_at.isoformat() if b.cancelled_at else None,
        "notes": b.notes,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


@router.get("/")
def list_bookings(
    session_id: Optional[int] = None,
    member_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(SessionBooking)
    if session_id:
        q = q.filter(SessionBooking.session_id == session_id)
    if member_id:
        q = q.filter(SessionBooking.member_id == member_id)
    if status:
        q = q.filter(SessionBooking.booking_status == status)
    items = q.order_by(SessionBooking.created_at.desc()).all()
    return [_booking_dict(b, db) for b in items]


@router.post("/", status_code=201)
def create_booking(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    session_id = body.get("session_id")
    member_id = body.get("member_id")
    if not session_id or not member_id:
        raise HTTPException(400, "session_id and member_id are required")

    gym_session = db.query(GymSession).filter(GymSession.id == session_id).first()
    if not gym_session:
        raise HTTPException(404, "Session not found")
    if not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(404, "Member not found")

    # Check duplicate
    existing = (
        db.query(SessionBooking)
        .filter(
            SessionBooking.session_id == session_id,
            SessionBooking.member_id == member_id,
            SessionBooking.booking_status.in_(["Booked", "Waitlisted"]),
        )
        .first()
    )
    if existing:
        raise HTTPException(400, "Member already has an active booking for this session")

    # Check capacity
    booked_count = (
        db.query(func.count(SessionBooking.id))
        .filter(SessionBooking.session_id == session_id, SessionBooking.booking_status == "Booked")
        .scalar() or 0
    )
    capacity = gym_session.capacity or 1
    status = "Booked" if booked_count < capacity else "Waitlisted"

    booking = SessionBooking(
        session_id=session_id,
        member_id=member_id,
        booking_status=status,
        booked_by=body.get("booked_by", "Admin"),
        booking_date=_today(),
        notes=body.get("notes"),
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return _booking_dict(booking, db)


@router.put("/{booking_id}")
def update_booking(booking_id: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    b = db.query(SessionBooking).filter(SessionBooking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")

    new_status = body.get("booking_status")
    if new_status and new_status in ("Cancelled",):
        b.cancellation_reason = body.get("cancellation_reason")
        b.cancelled_at = _utcnow()
        b.booking_status = new_status
        # Promote first waitlisted member if there is one
        session_id = b.session_id
        next_waitlisted = (
            db.query(SessionBooking)
            .filter(
                SessionBooking.session_id == session_id,
                SessionBooking.booking_status == "Waitlisted",
            )
            .order_by(SessionBooking.created_at)
            .first()
        )
        if next_waitlisted:
            next_waitlisted.booking_status = "Booked"
            next_waitlisted.updated_at = _utcnow()
    else:
        for k, v in body.items():
            if k not in ("id", "created_at", "session_id", "member_id") and hasattr(b, k):
                setattr(b, k, v)

    b.updated_at = _utcnow()
    db.commit()
    db.refresh(b)
    return _booking_dict(b, db)


@router.delete("/{booking_id}", status_code=204)
def delete_booking(booking_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    b = db.query(SessionBooking).filter(SessionBooking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    db.delete(b)
    db.commit()
