"""Dashboard router — platform stats, reassessment alerts, and progress trends."""

import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth, database, models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

# Reassessment windows
_REASSESS_DAYS = 30       # standard reassessment cadence
_WARN_DAYS     = 7        # "due soon" lookahead window


@router.get("/stats")
def get_stats(
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    members = db.query(models.Member).all()
    total   = len(members)
    active  = sum(1 for m in members if m.status == "Active")
    now     = datetime.now(tz=timezone.utc)

    new_this_month = sum(
        1 for m in members
        if m.registration_date
        and m.registration_date.month == now.month
        and m.registration_date.year == now.year
    )
    high_risk = sum(1 for m in members if m.risk_level == "High")

    goals, levels = {}, {}
    for m in members:
        if m.primary_goal:
            goals[m.primary_goal]   = goals.get(m.primary_goal, 0) + 1
        if m.fitness_level:
            levels[m.fitness_level] = levels.get(m.fitness_level, 0) + 1

    recent = sorted(
        members,
        key=lambda m: m.registration_date or datetime.min,
        reverse=True,
    )[:5]

    return {
        "total_members":  total,
        "active_members": active,
        "new_this_month": new_this_month,
        "high_risk":      high_risk,
        "by_goal":        goals,
        "by_level":       levels,
        "recent": [
            {
                "id":   m.id,
                "name": f"{m.first_name} {m.last_name}",
                "goal": m.primary_goal,
                "level": m.fitness_level,
                "date": m.registration_date.isoformat() if m.registration_date else None,
                "risk": m.risk_level,
            }
            for m in recent
        ],
    }


@router.get("/reassessments")
def get_reassessments(
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    """Return members who are overdue for reassessment or due within the next week.

    Each entry now includes:
    - ``days_overdue``  — negative means due in that many days (upcoming)
    - ``urgency``       — "critical" | "overdue" | "due_soon"
    """
    members = db.query(models.Member).filter(models.Member.status == "Active").all()
    today   = date.today()
    result  = []

    for m in members:
        if not m.assessments:
            # Never assessed → treat as immediately due
            due_date    = today
            days_overdue = 0
            urgency      = "overdue"
        else:
            last_date    = max(a.assessment_date for a in m.assessments)
            due_date     = last_date + timedelta(days=_REASSESS_DAYS)
            days_overdue = (today - due_date).days   # positive = overdue

            if days_overdue > 30:
                urgency = "critical"
            elif days_overdue >= 0:
                urgency = "overdue"
            elif days_overdue >= -_WARN_DAYS:
                urgency = "due_soon"
            else:
                continue  # not due yet — skip

        result.append({
            "member_id":       m.id,
            "name":            f"{m.first_name} {m.last_name}",
            "last_assessment": m.assessments and max(a.assessment_date for a in m.assessments).isoformat(),
            "due_date":        due_date.isoformat(),
            "days_overdue":    days_overdue,
            "urgency":         urgency,
            "risk_level":      m.risk_level,
        })

    # Sort: critical first, then by days overdue descending
    urgency_order = {"critical": 0, "overdue": 1, "due_soon": 2}
    result.sort(key=lambda x: (urgency_order.get(x["urgency"], 9), -x["days_overdue"]))
    return result


@router.get("/members/{member_id}/progress-trend")
def get_progress_trend(
    member_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    """Return time-series progress data for a member's analytics chart.

    Returns progress entries sorted oldest-first with:
    - weight, waist_measurement, body_fat_percentage, adherence_score
    - assessment snapshots (pushups, squats, plank_seconds) keyed by date

    The frontend merges these into a single timeline for rendering.
    """
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    progress = sorted(member.progress_entries, key=lambda e: e.date)
    assessments = sorted(member.assessments, key=lambda a: a.assessment_date)

    return {
        "member_id": member_id,
        "progress": [
            {
                "date":               str(e.date),
                "weight":             e.weight,
                "waist":              e.waist_measurement,
                "body_fat":           e.body_fat_percentage,
                "adherence":          e.adherence_score,
                "progress_note":      e.progress_note,
                "coach_note":         e.coach_note,
            }
            for e in progress
        ],
        "assessments": [
            {
                "date":          str(a.assessment_date),
                "pushups":       a.pushups,
                "squats":        a.squats,
                "plank_seconds": a.plank_seconds,
                "cardio_result": a.cardio_result,
                "mobility":      a.mobility_score,
                "balance":       a.balance_score,
                "notes":         a.overall_notes,
            }
            for a in assessments
        ],
        "baseline": {
            "weight": member.physical_metrics.weight if member.physical_metrics else None,
            "waist":  member.physical_metrics.waist_measurement if member.physical_metrics else None,
            "bmi":    member.physical_metrics.bmi if member.physical_metrics else None,
        },
    }
