"""Safety router — check exercises against member profile + record overrides."""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth, database, models
from app.schemas_phase2 import (
    SafetyCheckRequest, SafetyCheckResponse, SafetyWarning, SafetyOverrideCreate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/safety", tags=["safety"])


def _generate_warnings(
    member: models.Member,
    exercises: list[models.ExerciseLibrary],
) -> list[dict]:
    """Return warning dicts for exercises that conflict with member's health profile."""
    warnings: list[dict] = []
    health   = member.health_profile
    physical = member.physical_metrics

    risk_level = (member.risk_level or "Low").lower()
    pain_areas = (health.pain_areas or "").lower() if health else ""
    injuries   = (health.injuries   or "").lower() if health else ""

    has_knee_pain  = "knee"     in pain_areas or "knee"     in injuries
    has_back_pain  = "back"     in pain_areas or "back"     in injuries
    has_shoulder   = "shoulder" in pain_areas or "shoulder" in injuries
    needs_clearance = (
        health and health.medical_clearance_required == "Yes"
        and health.medical_clearance_received != "Yes"
    )

    for ex in exercises:
        ex_warnings: list[tuple[str, str, str]] = []  # (type, message, severity)

        if ex.avoid_if_knee_injury and has_knee_pain:
            ex_warnings.append((
                "Knee injury",
                f"⚠ {ex.exercise_name}: Member has knee pain. This exercise is flagged as unsuitable for knee injuries.",
                "warning",
            ))

        if ex.avoid_if_lower_back_pain and has_back_pain:
            ex_warnings.append((
                "Lower back pain",
                f"⚠ {ex.exercise_name}: Member has lower back pain. Review this movement carefully before programming.",
                "warning",
            ))

        if ex.avoid_if_shoulder_injury and has_shoulder:
            ex_warnings.append((
                "Shoulder injury",
                f"⚠ {ex.exercise_name}: Member has shoulder issues. This exercise loads the shoulder joint.",
                "warning",
            ))

        if needs_clearance and ex.medical_clearance_recommended:
            ex_warnings.append((
                "Medical clearance required",
                f"🚨 {ex.exercise_name}: Member requires medical clearance. This exercise is flagged as requiring clearance.",
                "critical",
            ))
        elif needs_clearance:
            ex_warnings.append((
                "Medical clearance pending",
                f"ℹ {ex.exercise_name}: Member has not received medical clearance. Confirm suitability before proceeding.",
                "info",
            ))

        if risk_level in ("medium", "high") and ex.impact_level == "High":
            ex_warnings.append((
                "High impact — elevated risk",
                f"⚠ {ex.exercise_name}: High-impact exercise selected for a member with {risk_level} risk level.",
                "warning",
            ))

        if ex.avoid_if_high_blood_pressure and health:
            if any(k in (health.chronic_conditions or "").lower() for k in ("hypertension", "blood pressure", "hbp")):
                ex_warnings.append((
                    "High blood pressure",
                    f"⚠ {ex.exercise_name}: Member may have hypertension. This exercise is flagged accordingly.",
                    "warning",
                ))

        for warning_type, message, severity in ex_warnings:
            warnings.append({
                "exercise_id":   ex.id,
                "exercise_name": ex.exercise_name,
                "warning_type":  warning_type,
                "message":       message,
                "severity":      severity,
            })

    return warnings


@router.post("/check", response_model=SafetyCheckResponse)
def check_safety(
    data: SafetyCheckRequest,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    member = db.query(models.Member).filter(models.Member.id == data.member_id).first()
    if not member:
        raise HTTPException(404, "Member not found")

    exercises = db.query(models.ExerciseLibrary).filter(
        models.ExerciseLibrary.id.in_(data.exercise_ids)
    ).all()

    warnings = _generate_warnings(member, exercises)
    return SafetyCheckResponse(
        member_id=data.member_id,
        warnings=[SafetyWarning(**w) for w in warnings],
    )


@router.post("/override")
def record_override(
    data: SafetyOverrideCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    override = models.SafetyOverride(
        member_id=data.member_id,
        exercise_id=data.exercise_id,
        admin_id=admin.id,
        warning_type=data.warning_type,
        override_reason=data.override_reason,
    )
    db.add(override)
    db.commit()
    logger.info(
        "Safety override recorded by admin %s for member %s (warning: %s)",
        admin.id, data.member_id, data.warning_type,
    )
    return {"message": "Override recorded"}
