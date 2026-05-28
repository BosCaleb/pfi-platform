"""Operations Dashboard — KPI summary for gym operations."""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import (
    Member, MemberMembership, Invoice, Payment,
    GymSession, SessionBooking, AttendanceRecord,
    CoachTask, CommunicationMessage,
)
from app.auth import get_current_admin

router = APIRouter(prefix="/api/operations", tags=["operations"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _today():
    return datetime.now(timezone.utc).date()


@router.get("/dashboard")
def operations_dashboard(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    today = _today()
    month_start = today.replace(day=1)
    week_start = today - timedelta(days=today.weekday())

    # ── Members ────────────────────────────────────────────────────────
    total_members = db.query(func.count(Member.id)).scalar() or 0
    active_members = (
        db.query(func.count(MemberMembership.id))
        .filter(MemberMembership.membership_status == "Active")
        .scalar() or 0
    )
    paused_members = (
        db.query(func.count(MemberMembership.id))
        .filter(MemberMembership.membership_status == "Paused")
        .scalar() or 0
    )
    cancelled_members = (
        db.query(func.count(MemberMembership.id))
        .filter(MemberMembership.membership_status == "Cancelled")
        .scalar() or 0
    )

    # ── Sessions (today) ───────────────────────────────────────────────
    todays_sessions = (
        db.query(GymSession)
        .filter(GymSession.session_date == today, GymSession.session_status == "Scheduled")
        .all()
    )
    todays_session_count = len(todays_sessions)
    todays_booked = (
        db.query(func.count(SessionBooking.id))
        .join(GymSession, GymSession.id == SessionBooking.session_id)
        .filter(
            GymSession.session_date == today,
            SessionBooking.booking_status == "Booked",
        )
        .scalar() or 0
    )

    # ── Sessions (this week) ───────────────────────────────────────────
    week_sessions = (
        db.query(func.count(GymSession.id))
        .filter(GymSession.session_date >= week_start, GymSession.session_date <= today)
        .scalar() or 0
    )

    # ── Attendance (this week) ─────────────────────────────────────────
    week_attended = (
        db.query(func.count(AttendanceRecord.id))
        .join(GymSession, GymSession.id == AttendanceRecord.session_id)
        .filter(
            GymSession.session_date >= week_start,
            AttendanceRecord.attendance_status == "Attended",
        )
        .scalar() or 0
    )
    week_noshows = (
        db.query(func.count(AttendanceRecord.id))
        .join(GymSession, GymSession.id == AttendanceRecord.session_id)
        .filter(
            GymSession.session_date >= week_start,
            AttendanceRecord.attendance_status == "No-Show",
        )
        .scalar() or 0
    )

    # ── Billing ────────────────────────────────────────────────────────
    revenue_month = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.payment_date >= month_start)
        .scalar() or 0
    )
    outstanding_invoices = (
        db.query(Invoice)
        .filter(Invoice.invoice_status.in_(["Sent", "Overdue", "Partially Paid"]))
        .all()
    )
    outstanding_amount = sum((i.balance_due or 0) for i in outstanding_invoices)
    overdue_count = (
        db.query(func.count(Invoice.id))
        .filter(Invoice.invoice_status == "Overdue")
        .scalar() or 0
    )
    unpaid_count = (
        db.query(func.count(MemberMembership.id))
        .filter(MemberMembership.payment_status.in_(["Unpaid", "Overdue"]))
        .scalar() or 0
    )

    # ── Coach tasks ────────────────────────────────────────────────────
    open_tasks = (
        db.query(func.count(CoachTask.id))
        .filter(CoachTask.status.in_(["Open", "In Progress"]))
        .scalar() or 0
    )
    urgent_tasks = (
        db.query(func.count(CoachTask.id))
        .filter(CoachTask.status.in_(["Open", "In Progress"]), CoachTask.priority == "Urgent")
        .scalar() or 0
    )

    # ── Upcoming sessions (next 7 days) ────────────────────────────────
    next7 = today + timedelta(days=7)
    upcoming = (
        db.query(GymSession)
        .filter(
            GymSession.session_date >= today,
            GymSession.session_date <= next7,
            GymSession.session_status == "Scheduled",
        )
        .order_by(GymSession.session_date, GymSession.start_time)
        .limit(10)
        .all()
    )

    return {
        "as_of": today.isoformat(),
        "members": {
            "total": total_members,
            "active": active_members,
            "paused": paused_members,
            "cancelled": cancelled_members,
        },
        "sessions_today": {
            "count": todays_session_count,
            "booked": todays_booked,
            "sessions": [
                {
                    "id": s.id,
                    "title": s.session_title,
                    "type": s.session_type,
                    "start_time": s.start_time,
                    "end_time": s.end_time,
                    "capacity": s.capacity,
                }
                for s in todays_sessions
            ],
        },
        "this_week": {
            "sessions": week_sessions,
            "attended": week_attended,
            "no_shows": week_noshows,
        },
        "billing": {
            "revenue_this_month": round(float(revenue_month), 2),
            "outstanding_amount": round(float(outstanding_amount), 2),
            "outstanding_invoices": len(outstanding_invoices),
            "overdue_invoices": overdue_count,
            "members_unpaid": unpaid_count,
        },
        "coach_tasks": {
            "open": open_tasks,
            "urgent": urgent_tasks,
        },
        "upcoming_sessions": [
            {
                "id": s.id,
                "title": s.session_title,
                "session_date": s.session_date.isoformat() if s.session_date else None,
                "start_time": s.start_time,
                "type": s.session_type,
                "capacity": s.capacity,
            }
            for s in upcoming
        ],
    }
