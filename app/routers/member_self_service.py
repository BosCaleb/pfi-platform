"""Member Self-Service — all data endpoints for the member portal.

Every route is secured with get_current_member() — members can only see
their own data. Nothing here exposes other members' information.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.auth import get_current_member
from app.models import (
    Member, MemberMilestone, MemberMembership, MembershipPackage,
    Invoice, Payment,
    WorkoutSession, MemberCheckIn, WeeklyMemberCheckIn, ReadinessScore,
    ProgressEntry, Assessment, WorkoutPlan, NutritionPlan, SupplementPlan,
    CommunicationMessage, MemberWorkoutGroupAssignment, WorkoutGroup,
    NutritionAdherenceLog, MemberRetentionScore,
)

router = APIRouter(prefix="/api/member", tags=["member-portal"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def _today():
    return datetime.now(timezone.utc).date()


# ── Overview / Dashboard ───────────────────────────────────────────────

@router.get("/portal", summary="Member portal dashboard summary")
def member_portal_summary(
    member: Member = Depends(get_current_member),
    db:     Session = Depends(get_db),
):
    today    = _today()
    days_30  = today - timedelta(days=30)
    days_7   = today - timedelta(days=7)

    # Membership
    membership = db.query(MemberMembership).filter(
        MemberMembership.member_id == member.id,
        MemberMembership.membership_status == "Active",
    ).first()
    mem_package = db.query(MembershipPackage).filter(
        MembershipPackage.id == membership.membership_package_id,
    ).first() if membership and membership.membership_package_id else None

    # Recent sessions
    sessions_30 = db.query(WorkoutSession).filter(
        WorkoutSession.member_id == member.id,
        WorkoutSession.session_date >= days_30,
    ).all()
    completed_30 = sum(1 for s in sessions_30 if s.completion_status == "Completed")
    avg_comp = round(
        sum(s.completion_percentage or 0 for s in sessions_30) / max(len(sessions_30), 1), 1
    ) if sessions_30 else 0

    # Latest readiness
    latest_readiness = db.query(ReadinessScore).filter(
        ReadinessScore.member_id == member.id,
    ).order_by(ReadinessScore.created_at.desc()).first()

    # Milestones count
    milestone_count = db.query(func.count(MemberMilestone.id)).filter(
        MemberMilestone.member_id == member.id,
        MemberMilestone.visible_to_member == True,
    ).scalar() or 0

    # Unread messages
    unread_messages = db.query(func.count(CommunicationMessage.id)).filter(
        CommunicationMessage.recipient_member_id == member.id,
        CommunicationMessage.visible_in_member_portal == True,
    ).scalar() or 0

    # Outstanding invoices
    outstanding = db.query(func.count(Invoice.id)).filter(
        Invoice.member_id == member.id,
        Invoice.invoice_status.in_(["Sent", "Overdue", "Partially Paid"]),
    ).scalar() or 0

    # Latest check-in
    latest_checkin = db.query(MemberCheckIn).filter(
        MemberCheckIn.member_id == member.id,
    ).order_by(MemberCheckIn.check_in_date.desc()).first()

    # Latest progress entry
    latest_progress = db.query(ProgressEntry).filter(
        ProgressEntry.member_id == member.id,
    ).order_by(ProgressEntry.date.desc()).first()

    # Workout group
    group_assign = db.query(MemberWorkoutGroupAssignment).filter(
        MemberWorkoutGroupAssignment.member_id == member.id,
        MemberWorkoutGroupAssignment.status == "Active",
    ).first()
    group_name = None
    if group_assign:
        g = db.query(WorkoutGroup).filter(WorkoutGroup.id == group_assign.workout_group_id).first()
        group_name = g.group_name if g else None

    return {
        "member": {
            "id": member.id,
            "first_name": member.first_name,
            "last_name": member.last_name,
            "primary_goal": member.primary_goal,
            "fitness_level": member.fitness_level,
            "status": member.status,
        },
        "membership": {
            "type": mem_package.package_name if mem_package else None,
            "status": membership.membership_status if membership else "No active membership",
            "end_date": membership.end_date.isoformat() if membership and membership.end_date else None,
        },
        "workout_group": group_name,
        "sessions_30d": {
            "total": len(sessions_30),
            "completed": completed_30,
            "avg_completion_pct": avg_comp,
        },
        "readiness": {
            "latest_score": latest_readiness.score if latest_readiness else None,
            "category": latest_readiness.category if latest_readiness else None,
            "date": latest_readiness.created_at.isoformat() if latest_readiness else None,
        },
        "latest_checkin": {
            "date": latest_checkin.check_in_date.isoformat() if latest_checkin else None,
            "energy_level": latest_checkin.energy_level if latest_checkin else None,
            "stress_level": latest_checkin.stress_level if latest_checkin else None,
        },
        "latest_weight": latest_progress.weight if latest_progress else None,
        "milestones_earned": milestone_count,
        "unread_messages": unread_messages,
        "outstanding_invoices": outstanding,
    }


# ── Progress ───────────────────────────────────────────────────────────

@router.get("/progress", summary="Member progress history")
def member_progress(
    member: Member = Depends(get_current_member),
    db:     Session = Depends(get_db),
):
    entries = db.query(ProgressEntry).filter(
        ProgressEntry.member_id == member.id,
    ).order_by(ProgressEntry.date.desc()).limit(52).all()

    assessments = db.query(Assessment).filter(
        Assessment.member_id == member.id,
    ).order_by(Assessment.assessment_date.desc()).all()

    return {
        "progress_entries": [
            {
                "date": e.date.isoformat() if e.date else None,
                "weight": e.weight,
                "body_fat_pct": e.body_fat_pct,
                "waist_cm": e.waist_measurement,
                "adherence_score": e.adherence_score,
                "notes": e.notes,
            }
            for e in entries
        ],
        "assessments": [
            {
                "date": a.assessment_date.isoformat() if a.assessment_date else None,
                "type": a.assessment_type,
                "pushups": a.pushups,
                "squats": a.squats,
                "plank_seconds": a.plank_seconds,
                "overall_notes": a.overall_notes,
            }
            for a in assessments
        ],
    }


# ── Workout Sessions ───────────────────────────────────────────────────

@router.get("/sessions", summary="Member workout session history")
def member_sessions(
    limit:  int = 30,
    member: Member = Depends(get_current_member),
    db:     Session = Depends(get_db),
):
    sessions = db.query(WorkoutSession).filter(
        WorkoutSession.member_id == member.id,
    ).order_by(WorkoutSession.session_date.desc()).limit(limit).all()

    return [
        {
            "id": s.id,
            "date": s.session_date.isoformat() if s.session_date else None,
            "status": s.completion_status,
            "completion_pct": s.completion_percentage,
            "coach_notes": s.coach_feedback,
            "member_feedback": s.member_notes,
            "rpe": s.overall_rpe,
        }
        for s in sessions
    ]


# ── Check-ins ──────────────────────────────────────────────────────────

@router.get("/check-ins", summary="Member daily and weekly check-ins")
def member_checkins(
    member: Member = Depends(get_current_member),
    db:     Session = Depends(get_db),
):
    daily = db.query(MemberCheckIn).filter(
        MemberCheckIn.member_id == member.id,
    ).order_by(MemberCheckIn.check_in_date.desc()).limit(14).all()

    weekly = db.query(WeeklyMemberCheckIn).filter(
        WeeklyMemberCheckIn.member_id == member.id,
    ).order_by(WeeklyMemberCheckIn.week_start_date.desc()).limit(8).all()

    readiness = db.query(ReadinessScore).filter(
        ReadinessScore.member_id == member.id,
    ).order_by(ReadinessScore.created_at.desc()).limit(14).all()

    return {
        "daily": [
            {
                "date": c.check_in_date.isoformat() if c.check_in_date else None,
                "energy_level": c.energy_level,
                "sleep_quality": c.sleep_quality,
                "stress_level": c.stress_level,
                "soreness_level": c.soreness_level,
                "motivation_level": c.motivation_level,
                "notes": c.notes,
            }
            for c in daily
        ],
        "weekly": [
            {
                "week_start": w.week_start_date.isoformat() if w.week_start_date else None,
                "perceived_progress": w.perceived_progress,
                "average_energy": w.average_energy,
                "average_sleep_hours": w.average_sleep_hours,
                "average_stress": w.average_stress,
                "wins": w.biggest_win_this_week,
                "challenges": w.biggest_challenge_this_week,
                "nutrition_adherence": w.nutrition_adherence_self_rating,
                "workout_adherence": w.workout_adherence_self_rating,
            }
            for w in weekly
        ],
        "readiness": [
            {
                "date": r.created_at.isoformat() if r.created_at else None,
                "score": r.score,
                "category": r.category,
                "recommendation": r.recommendation_summary,
            }
            for r in readiness
        ],
    }


# ── Milestones ─────────────────────────────────────────────────────────

@router.get("/milestones", summary="Member badges and achievements")
def member_milestones(
    member: Member = Depends(get_current_member),
    db:     Session = Depends(get_db),
):
    milestones = db.query(MemberMilestone).filter(
        MemberMilestone.member_id == member.id,
        MemberMilestone.visible_to_member == True,
    ).order_by(MemberMilestone.achieved_at.desc()).all()

    return [
        {
            "id": m.id,
            "type": m.milestone_type,
            "title": m.milestone_title,
            "description": m.milestone_description,
            "achieved_at": m.achieved_at.isoformat() if m.achieved_at else None,
            "related_metric": m.related_metric,
        }
        for m in milestones
    ]


# ── Plans ──────────────────────────────────────────────────────────────

@router.get("/plans", summary="Member active workout, nutrition and supplement plans")
def member_plans(
    member: Member = Depends(get_current_member),
    db:     Session = Depends(get_db),
):
    workout = db.query(WorkoutPlan).filter(
        WorkoutPlan.member_id == member.id,
    ).order_by(WorkoutPlan.created_at.desc()).first()

    nutrition = db.query(NutritionPlan).filter(
        NutritionPlan.member_id == member.id,
    ).order_by(NutritionPlan.created_at.desc()).first()

    supplement = db.query(SupplementPlan).filter(
        SupplementPlan.member_id == member.id,
    ).order_by(SupplementPlan.created_at.desc()).first()

    def plan_dict(p, fields):
        if not p: return None
        return {f: getattr(p, f, None) for f in fields}

    return {
        "workout": plan_dict(workout, [
            "id", "plan_name", "goal", "weeks", "sessions_per_week",
            "plan_details", "created_at",
        ]) if workout else None,
        "nutrition": plan_dict(nutrition, [
            "id", "plan_name", "calories_target", "protein_target",
            "carbs_target", "fat_target", "meal_timing", "dietary_notes",
            "created_at",
        ]) if nutrition else None,
        "supplement": plan_dict(supplement, [
            "id", "plan_name", "supplements", "timing_notes", "created_at",
        ]) if supplement else None,
    }


# ── Billing ────────────────────────────────────────────────────────────

@router.get("/billing", summary="Member invoices and payment history")
def member_billing(
    member: Member = Depends(get_current_member),
    db:     Session = Depends(get_db),
):
    invoices = db.query(Invoice).filter(
        Invoice.member_id == member.id,
    ).order_by(Invoice.issue_date.desc()).limit(24).all()

    payments = db.query(Payment).filter(
        Payment.member_id == member.id,
    ).order_by(Payment.payment_date.desc()).limit(24).all()

    # Active membership
    membership = db.query(MemberMembership).filter(
        MemberMembership.member_id == member.id,
        MemberMembership.membership_status == "Active",
    ).first()
    mem_package = db.query(MembershipPackage).filter(
        MembershipPackage.id == membership.membership_package_id,
    ).first() if membership and membership.membership_package_id else None

    return {
        "membership": {
            "type": mem_package.package_name if mem_package else None,
            "status": membership.membership_status if membership else None,
            "start_date": membership.start_date.isoformat() if membership and membership.start_date else None,
            "end_date": membership.end_date.isoformat() if membership and membership.end_date else None,
            "amount": mem_package.price if mem_package else None,
        },
        "invoices": [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "amount": inv.amount_due,
                "balance_due": inv.balance_due,
                "status": inv.invoice_status,
                "issue_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
                "due_date": inv.due_date.isoformat() if inv.due_date else None,
            }
            for inv in invoices
        ],
        "payments": [
            {
                "id": pay.id,
                "amount": pay.amount,
                "method": pay.payment_method,
                "date": pay.payment_date.isoformat() if pay.payment_date else None,
                "reference": pay.payment_reference,
                "notes": pay.notes,
            }
            for pay in payments
        ],
    }


# ── Messages ───────────────────────────────────────────────────────────

@router.get("/messages", summary="Member portal messages from coach")
def member_messages(
    member: Member = Depends(get_current_member),
    db:     Session = Depends(get_db),
):
    messages = db.query(CommunicationMessage).filter(
        CommunicationMessage.recipient_member_id == member.id,
        CommunicationMessage.visible_in_member_portal == True,
    ).order_by(CommunicationMessage.created_at.desc()).limit(50).all()

    return [
        {
            "id": msg.id,
            "subject": msg.subject,
            "body": msg.body,
            "message_type": msg.message_type,
            "sent_at": msg.created_at.isoformat() if msg.created_at else None,
        }
        for msg in messages
    ]
