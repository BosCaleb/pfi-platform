"""Reassessment Alerts router — CRUD + automatic evaluation engine."""
import logging
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth, database, models
from app.models import _utcnow
from app.schemas_phase2 import AlertOut

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reassessment-alerts", tags=["reassessment alerts"])

_ASSESSMENT_OVERDUE_DAYS = 42   # 6 weeks


def _evaluate_member(member: models.Member, db: Session) -> list[dict]:
    """Run all trigger rules for a member. Returns new alert payloads."""
    alerts: list[dict] = []
    today = date.today()

    # ── Assessment overdue ─────────────────────────────────────────────
    if not member.assessments:
        last_date = None
    else:
        last_date = max(a.assessment_date for a in member.assessments)

    if last_date is None or (today - last_date).days > _ASSESSMENT_OVERDUE_DAYS:
        overdue_days = (today - last_date).days if last_date else None
        msg = (
            f"Member has no assessment on record."
            if last_date is None
            else f"Last assessment was {overdue_days} days ago (>{_ASSESSMENT_OVERDUE_DAYS} day threshold)."
        )
        alerts.append(dict(
            trigger_type="Assessment overdue",
            trigger_message=msg,
            severity="High" if (overdue_days or 999) > 60 else "Medium",
        ))

    # ── Workout session signals ────────────────────────────────────────
    sessions = sorted(
        [s for s in (member.workout_sessions or []) if s.completion_status == "Completed"],
        key=lambda s: s.session_date,
    )
    recent_30 = [s for s in sessions if s.session_date and (today - s.session_date).days <= 30]

    if len(recent_30) >= 2:
        # High adherence (≥80% over last 4+ sessions)
        if len(recent_30) >= 4:
            avg_completion = sum(s.completion_percentage for s in recent_30[-4:]) / 4
            if avg_completion >= 80:
                alerts.append(dict(
                    trigger_type="High adherence",
                    trigger_message=(
                        f"Member completed {avg_completion:.0f}% average over last 4 sessions. "
                        "Reassessment recommended to progress the plan."
                    ),
                    severity="Low",
                ))

        # Pain flag (pain ≥6 in 2+ sessions)
        pain_sessions = [s for s in recent_30 if s.pain_flag]
        if len(pain_sessions) >= 2:
            alerts.append(dict(
                trigger_type="Pain flag",
                trigger_message=(
                    f"Pain score ≥6 recorded in {len(pain_sessions)} sessions in the last 30 days. "
                    "Review exercise selection and consider medical referral."
                ),
                severity="High",
            ))

        # High RPE (RPE ≥9 in 2+ sessions)
        high_rpe_sessions = [s for s in recent_30 if s.overall_rpe and s.overall_rpe >= 9]
        if len(high_rpe_sessions) >= 2:
            alerts.append(dict(
                trigger_type="High RPE",
                trigger_message=(
                    f"RPE ≥9 reported in {len(high_rpe_sessions)} sessions. "
                    "Possible overtraining. Reassess load and recovery."
                ),
                severity="Medium",
            ))

        # Low adherence (<50% across recent sessions)
        avg_recent = sum(s.completion_percentage for s in recent_30) / len(recent_30)
        if avg_recent < 50:
            alerts.append(dict(
                trigger_type="Low adherence",
                trigger_message=(
                    f"Average session completion is {avg_recent:.0f}% over the last 30 days. "
                    "Review programming difficulty and member motivation."
                ),
                severity="Medium",
            ))

    return alerts


@router.get("/", response_model=List[AlertOut])
def list_all_alerts(
    status:   Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    q = db.query(models.ReassessmentAlert)
    if status:
        q = q.filter(models.ReassessmentAlert.status == status)
    if severity:
        q = q.filter(models.ReassessmentAlert.severity == severity)
    alerts = q.order_by(models.ReassessmentAlert.created_at.desc()).all()
    result = []
    for a in alerts:
        m = a.member
        result.append({
            **{c.name: getattr(a, c.name) for c in a.__table__.columns},
            "member_name": f"{m.first_name} {m.last_name}" if m else None,
        })
    return result


@router.get("/member/{member_id}", response_model=List[AlertOut])
def list_member_alerts(
    member_id: int,
    status: Optional[str] = None,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    q = db.query(models.ReassessmentAlert).filter(
        models.ReassessmentAlert.member_id == member_id
    )
    if status:
        q = q.filter(models.ReassessmentAlert.status == status)
    alerts = q.order_by(models.ReassessmentAlert.created_at.desc()).all()
    return [
        {
            **{c.name: getattr(a, c.name) for c in a.__table__.columns},
            "member_name": None,
        }
        for a in alerts
    ]


@router.post("/evaluate/{member_id}")
def evaluate_member(
    member_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    """Run trigger rules for a member and create new Open alerts."""
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(404, "Member not found")

    new_payloads = _evaluate_member(member, db)

    # Avoid duplicate open alerts of same trigger type
    existing_open = {
        a.trigger_type
        for a in db.query(models.ReassessmentAlert).filter(
            models.ReassessmentAlert.member_id == member_id,
            models.ReassessmentAlert.status == "Open",
        ).all()
    }

    created = 0
    for payload in new_payloads:
        if payload["trigger_type"] not in existing_open:
            db.add(models.ReassessmentAlert(member_id=member_id, **payload))
            created += 1

    db.commit()
    logger.info("Evaluated member %s — %d new alerts", member_id, created)
    return {"evaluated": True, "new_alerts": created}


@router.patch("/{alert_id}/review")
def review_alert(
    alert_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    a = db.query(models.ReassessmentAlert).filter(
        models.ReassessmentAlert.id == alert_id
    ).first()
    if not a:
        raise HTTPException(404, "Alert not found")
    a.status = "Reviewed"
    a.reviewed_at = _utcnow()
    a.reviewed_by_admin_id = admin.id
    db.commit()
    return {"message": "Alert marked as reviewed"}


@router.patch("/{alert_id}/close")
def close_alert(
    alert_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    a = db.query(models.ReassessmentAlert).filter(
        models.ReassessmentAlert.id == alert_id
    ).first()
    if not a:
        raise HTTPException(404, "Alert not found")
    a.status = "Closed"
    a.reviewed_at = _utcnow()
    a.reviewed_by_admin_id = admin.id
    db.commit()
    return {"message": "Alert closed"}
