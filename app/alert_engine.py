"""
Rule-based alert engine for Phase 3.1.

Processes check-ins and generates PainRiskFlags and CoachTasks
based on transparent, auditable rules. No AI/ML used.
"""
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app import models

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def process_check_in_alerts(
    db: Session,
    check_in: models.MemberCheckIn,
    readiness_score: Optional[float] = None,
    recovery_score: Optional[float] = None,
) -> None:
    """
    Run all alert rules against a newly submitted daily check-in.
    Creates PainRiskFlags and CoachTasks as needed.
    """
    member_id = check_in.member_id

    # ── Rule 1: Pain >= 6 → pain flag ────────────────────────────────
    if check_in.pain_level is not None and check_in.pain_level >= 6:
        risk = "High" if check_in.pain_level >= 8 else "Medium"
        _create_pain_flag(
            db, member_id,
            source_type="Check-In", source_id=check_in.id,
            pain_score=check_in.pain_level,
            pain_location=check_in.pain_location or "Unspecified",
            risk_level=risk,
            flag_message=f"Pain level {check_in.pain_level}/10 reported on {check_in.check_in_date}.",
            recommended_action="Review member profile and check-in notes. Consider reducing load or rest day.",
        )
        _create_coach_task(
            db, member_id,
            task_type="Pain Review",
            title=f"Pain level {check_in.pain_level}/10 — review required",
            description=f"Member reported pain level {check_in.pain_level}/10 at location: {check_in.pain_location or 'unspecified'}. Date: {check_in.check_in_date}.",
            priority="High" if check_in.pain_level >= 8 else "Medium",
        )

    # ── Rule 2: New injury reported → urgent task ─────────────────────
    if check_in.new_injury_reported == "Yes":
        _create_pain_flag(
            db, member_id,
            source_type="Check-In", source_id=check_in.id,
            pain_score=check_in.pain_level or 0,
            pain_location=check_in.pain_location or "Unspecified",
            risk_level="Critical",
            flag_message=f"New injury reported on {check_in.check_in_date}. Notes: {check_in.injury_notes or 'None'}",
            recommended_action="Do not progress training. Obtain medical clearance before resuming. Admin must review.",
        )
        _create_coach_task(
            db, member_id,
            task_type="Injury Review",
            title="New injury reported — urgent review",
            description=f"Member reported a new injury on {check_in.check_in_date}. Injury notes: {check_in.injury_notes or 'None'}.",
            priority="Urgent",
        )

    # ── Rule 3: Pain in same location twice in 7 days ─────────────────
    if check_in.pain_location and check_in.pain_level and check_in.pain_level > 0:
        seven_days_ago = check_in.check_in_date - timedelta(days=7)
        recent_same_pain = (
            db.query(models.MemberCheckIn)
            .filter(
                models.MemberCheckIn.member_id == member_id,
                models.MemberCheckIn.check_in_date >= seven_days_ago,
                models.MemberCheckIn.check_in_date < check_in.check_in_date,
                models.MemberCheckIn.pain_location == check_in.pain_location,
                models.MemberCheckIn.pain_level > 0,
                models.MemberCheckIn.id != check_in.id,
            )
            .count()
        )
        if recent_same_pain >= 1:
            _create_pain_flag(
                db, member_id,
                source_type="Check-In", source_id=check_in.id,
                pain_score=check_in.pain_level,
                pain_location=check_in.pain_location,
                risk_level="High",
                flag_message=f"Recurring pain in '{check_in.pain_location}' — reported {recent_same_pain + 1} times in last 7 days.",
                recommended_action="Recurring pain pattern detected. Reduce load on affected area. Consider referral.",
            )

    # ── Rule 4: Red readiness → urgent coach task ─────────────────────
    if readiness_score is not None and readiness_score < 40:
        _create_coach_task(
            db, member_id,
            task_type="Readiness Review",
            title=f"Red readiness score ({readiness_score:.0f}) — coach review needed",
            description=f"Member's readiness score is {readiness_score:.0f}/100 (Red category) on {check_in.check_in_date}. Recovery or rest day recommended.",
            priority="Urgent",
        )

    # ── Rule 5: Orange readiness — check for 2nd consecutive ──────────
    elif readiness_score is not None and readiness_score < 60:
        yesterday = check_in.check_in_date - timedelta(days=1)
        prev_orange = (
            db.query(models.ReadinessScore)
            .filter(
                models.ReadinessScore.member_id == member_id,
                models.ReadinessScore.category.in_(["Orange", "Red"]),
                models.ReadinessScore.created_at >= datetime.combine(yesterday, datetime.min.time()),
            )
            .count()
        )
        if prev_orange >= 1:
            _create_coach_task(
                db, member_id,
                task_type="Readiness Review",
                title="Consecutive low readiness — review recommended",
                description=f"Member has had Orange or lower readiness for 2+ consecutive check-ins. Current score: {readiness_score:.0f}.",
                priority="High",
            )

    # ── Rule 6: Very low sleep for 3+ days ───────────────────────────
    if check_in.sleep_hours is not None and check_in.sleep_hours < 5:
        three_days_ago = check_in.check_in_date - timedelta(days=3)
        poor_sleep_count = (
            db.query(models.MemberCheckIn)
            .filter(
                models.MemberCheckIn.member_id == member_id,
                models.MemberCheckIn.check_in_date >= three_days_ago,
                models.MemberCheckIn.sleep_hours < 5,
                models.MemberCheckIn.id != check_in.id,
            )
            .count()
        )
        if poor_sleep_count >= 2:
            _create_coach_task(
                db, member_id,
                task_type="Readiness Review",
                title="Chronic poor sleep — recovery warning",
                description=f"Member has reported less than 5 hours sleep for 3+ days. Current: {check_in.sleep_hours}h.",
                priority="High",
            )

    # ── Rule 7: Supplement side effect ───────────────────────────────
    # (handled separately via supplement logs; placeholder here)

    logger.info(
        "Alert engine processed check-in id=%s for member_id=%s",
        check_in.id, member_id,
    )


def process_supplement_log_alerts(
    db: Session,
    log: models.SupplementAdherenceLog,
) -> None:
    """Create urgent task if side effects are reported."""
    if log.side_effects_reported:
        _create_coach_task(
            db, log.member_id,
            task_type="Supplement Review",
            title="Supplement side effects reported — urgent review",
            description=f"Member reported side effects on {log.date}. Notes: {log.side_effect_notes or 'None'}.",
            priority="Urgent",
        )


# ── Helpers ───────────────────────────────────────────────────────────

def _create_pain_flag(
    db: Session,
    member_id: int,
    source_type: str,
    source_id: int,
    pain_score: int,
    pain_location: str,
    risk_level: str,
    flag_message: str,
    recommended_action: str,
) -> models.PainRiskFlag:
    flag = models.PainRiskFlag(
        member_id=member_id,
        source_type=source_type,
        source_id=source_id,
        pain_score=pain_score,
        pain_location=pain_location,
        risk_level=risk_level,
        flag_message=flag_message,
        recommended_action=recommended_action,
        status="Open",
    )
    db.add(flag)
    db.flush()
    return flag


def _create_coach_task(
    db: Session,
    member_id: int,
    task_type: str,
    title: str,
    description: str,
    priority: str = "Medium",
) -> models.CoachTask:
    from datetime import timedelta
    task = models.CoachTask(
        member_id=member_id,
        task_type=task_type,
        title=title,
        description=description,
        priority=priority,
        status="Open",
        created_by_system=True,
        due_date=(date.today() + timedelta(days=1 if priority == "Urgent" else 3)),
    )
    db.add(task)
    db.flush()
    return task
