"""Attendance — mark, query, stats. Creates coach task on 3 consecutive no-shows."""
from datetime import datetime, timezone, date as date_type
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import AttendanceRecord, GymSession, Member, SessionBooking, CoachTask
from app.auth import get_current_admin

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _att_dict(a: AttendanceRecord, db: Session) -> dict:
    member = db.query(Member).filter(Member.id == a.member_id).first()
    session = db.query(GymSession).filter(GymSession.id == a.session_id).first()
    return {
        "id": a.id,
        "session_id": a.session_id,
        "session_title": session.session_title if session else None,
        "session_date": session.session_date.isoformat() if session and session.session_date else None,
        "member_id": a.member_id,
        "member_name": f"{member.first_name} {member.last_name}" if member else None,
        "attendance_status": a.attendance_status,
        "check_in_time": a.check_in_time.isoformat() if a.check_in_time else None,
        "marked_by_admin_id": a.marked_by_admin_id,
        "attendance_notes": a.attendance_notes,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


def _check_consecutive_noshows(member_id: int, db: Session, marking_admin_id: int):
    """Create a coach task if member has 3+ consecutive no-shows."""
    recent = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.member_id == member_id)
        .order_by(AttendanceRecord.created_at.desc())
        .limit(3)
        .all()
    )
    if len(recent) < 3:
        return
    if all(r.attendance_status == "No-Show" for r in recent):
        # Check if open task already exists
        existing = (
            db.query(CoachTask)
            .filter(
                CoachTask.member_id == member_id,
                CoachTask.task_type == "Attendance Follow-Up",
                CoachTask.status.in_(["Open", "In Progress"]),
            )
            .first()
        )
        if not existing:
            member = db.query(Member).filter(Member.id == member_id).first()
            name = f"{member.first_name} {member.last_name}" if member else f"Member #{member_id}"
            task = CoachTask(
                member_id=member_id,
                assigned_to_admin_id=marking_admin_id,
                task_type="Attendance Follow-Up",
                title=f"3 Consecutive No-Shows: {name}",
                description=(
                    f"{name} has missed 3 consecutive sessions without attendance. "
                    "Please follow up to check in on their wellbeing and re-engage them."
                ),
                priority="High",
                status="Open",
                created_at=_utcnow(),
                updated_at=_utcnow(),
            )
            db.add(task)


@router.get("/")
def list_attendance(
    session_id: Optional[int] = None,
    member_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(AttendanceRecord)
    if session_id:
        q = q.filter(AttendanceRecord.session_id == session_id)
    if member_id:
        q = q.filter(AttendanceRecord.member_id == member_id)
    if status:
        q = q.filter(AttendanceRecord.attendance_status == status)
    items = q.order_by(AttendanceRecord.created_at.desc()).all()
    return [_att_dict(a, db) for a in items]


@router.post("/", status_code=201)
def mark_attendance(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    session_id = body.get("session_id")
    member_id = body.get("member_id")
    if not session_id or not member_id:
        raise HTTPException(400, "session_id and member_id are required")
    if not db.query(GymSession).filter(GymSession.id == session_id).first():
        raise HTTPException(404, "Session not found")
    if not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(404, "Member not found")

    # Upsert — update if exists
    existing = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.session_id == session_id, AttendanceRecord.member_id == member_id)
        .first()
    )
    att_status = body.get("attendance_status", "Attended")

    if existing:
        existing.attendance_status = att_status
        existing.attendance_notes = body.get("attendance_notes", existing.attendance_notes)
        if att_status == "Attended":
            existing.check_in_time = body.get("check_in_time") or _utcnow()
        existing.marked_by_admin_id = admin.id
        existing.updated_at = _utcnow()
        record = existing
    else:
        record = AttendanceRecord(
            session_id=session_id,
            member_id=member_id,
            attendance_status=att_status,
            check_in_time=_utcnow() if att_status == "Attended" else None,
            marked_by_admin_id=admin.id,
            attendance_notes=body.get("attendance_notes"),
            created_at=_utcnow(),
            updated_at=_utcnow(),
        )
        db.add(record)

    # Also update booking status if there's a matching booking
    booking = (
        db.query(SessionBooking)
        .filter(
            SessionBooking.session_id == session_id,
            SessionBooking.member_id == member_id,
            SessionBooking.booking_status == "Booked",
        )
        .first()
    )
    if booking:
        booking.booking_status = "Completed" if att_status == "Attended" else "No-Show"
        booking.updated_at = _utcnow()

    db.flush()

    # Check 3-consecutive no-show rule
    if att_status == "No-Show":
        _check_consecutive_noshows(member_id, db, admin.id)

    db.commit()
    db.refresh(record)
    return _att_dict(record, db)


@router.get("/stats/{member_id}")
def member_attendance_stats(member_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    if not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(404, "Member not found")
    records = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.member_id == member_id)
        .all()
    )
    total = len(records)
    attended = sum(1 for r in records if r.attendance_status == "Attended")
    no_show = sum(1 for r in records if r.attendance_status == "No-Show")
    cancelled = sum(1 for r in records if "Cancelled" in (r.attendance_status or ""))
    return {
        "member_id": member_id,
        "total_sessions": total,
        "attended": attended,
        "no_show": no_show,
        "cancelled": cancelled,
        "attendance_rate": round(attended / total * 100, 1) if total > 0 else 0,
    }


@router.put("/{att_id}")
def update_attendance(att_id: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    a = db.query(AttendanceRecord).filter(AttendanceRecord.id == att_id).first()
    if not a:
        raise HTTPException(404, "Attendance record not found")
    for k, v in body.items():
        if k not in ("id", "created_at", "session_id", "member_id") and hasattr(a, k):
            setattr(a, k, v)
    a.marked_by_admin_id = admin.id
    a.updated_at = _utcnow()
    db.commit()
    db.refresh(a)
    return _att_dict(a, db)


@router.delete("/{att_id}", status_code=204)
def delete_attendance(att_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    a = db.query(AttendanceRecord).filter(AttendanceRecord.id == att_id).first()
    if not a:
        raise HTTPException(404, "Record not found")
    db.delete(a)
    db.commit()
