"""Readiness and Recovery score endpoints."""
from typing import Optional
import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import auth, database, models

router = APIRouter(prefix="/api/readiness", tags=["readiness"])


@router.get("/latest/{member_id}", summary="Latest readiness and recovery scores")
def get_latest_scores(
    member_id: int,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    readiness = (
        db.query(models.ReadinessScore)
        .filter(models.ReadinessScore.member_id == member_id)
        .order_by(models.ReadinessScore.created_at.desc())
        .first()
    )
    recovery = (
        db.query(models.RecoveryScore)
        .filter(models.RecoveryScore.member_id == member_id)
        .order_by(models.RecoveryScore.created_at.desc())
        .first()
    )
    return {
        "readiness": _ser_readiness(readiness) if readiness else None,
        "recovery": _ser_recovery(recovery) if recovery else None,
    }


@router.get("/history/{member_id}", summary="Readiness history")
def get_readiness_history(
    member_id: int,
    days: int = Query(30, le=90),
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    from datetime import datetime, timedelta, timezone
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=days)
    rows = (
        db.query(models.ReadinessScore)
        .filter(
            models.ReadinessScore.member_id == member_id,
            models.ReadinessScore.created_at >= cutoff,
        )
        .order_by(models.ReadinessScore.created_at.asc())
        .all()
    )
    recovery_rows = (
        db.query(models.RecoveryScore)
        .filter(
            models.RecoveryScore.member_id == member_id,
            models.RecoveryScore.created_at >= cutoff,
        )
        .order_by(models.RecoveryScore.created_at.asc())
        .all()
    )
    return {
        "readiness_history": [_ser_readiness(r) for r in rows],
        "recovery_history": [_ser_recovery(r) for r in recovery_rows],
    }


@router.get("/dashboard", summary="Admin readiness dashboard summary")
def readiness_dashboard(
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    """Return per-member latest readiness and flag summary for the admin dashboard."""
    from datetime import datetime, timedelta, timezone
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=7)

    # Latest readiness per member using a subquery approach
    all_scores = (
        db.query(models.ReadinessScore)
        .filter(models.ReadinessScore.created_at >= cutoff)
        .order_by(models.ReadinessScore.member_id, models.ReadinessScore.created_at.desc())
        .all()
    )
    seen = set()
    latest = []
    for s in all_scores:
        if s.member_id not in seen:
            seen.add(s.member_id)
            latest.append(s)

    red_count = sum(1 for s in latest if s.category == "Red")
    orange_count = sum(1 for s in latest if s.category == "Orange")
    avg_score = round(sum(s.score for s in latest) / len(latest), 1) if latest else None

    open_pain_flags = db.query(models.PainRiskFlag).filter(models.PainRiskFlag.status == "Open").count()
    open_tasks = db.query(models.CoachTask).filter(models.CoachTask.status.in_(["Open", "In Progress"])).count()
    urgent_tasks = db.query(models.CoachTask).filter(
        models.CoachTask.status.in_(["Open", "In Progress"]),
        models.CoachTask.priority == "Urgent",
    ).count()

    return {
        "members_scored": len(latest),
        "red_count": red_count,
        "orange_count": orange_count,
        "average_readiness_score": avg_score,
        "open_pain_flags": open_pain_flags,
        "open_coach_tasks": open_tasks,
        "urgent_coach_tasks": urgent_tasks,
        "member_readiness": [_ser_readiness(s) for s in latest],
    }


def _ser_readiness(r: models.ReadinessScore) -> dict:
    return {
        "id": r.id,
        "member_id": r.member_id,
        "check_in_id": r.check_in_id,
        "score": r.score,
        "category": r.category,
        "recommendation_summary": r.recommendation_summary,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _ser_recovery(r: models.RecoveryScore) -> dict:
    return {
        "id": r.id,
        "member_id": r.member_id,
        "check_in_id": r.check_in_id,
        "score": r.score,
        "category": r.category,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
