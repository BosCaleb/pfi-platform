"""
Recommendation Engine — Phase 3.2
Transparent rule-based coaching recommendation generation.
All recommendations are auto-approved unless admin manually changes status.
"""
import json
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy.orm import Session

from app import models


# ─── helpers ──────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def _recent_exists(db: Session, member_id: int, rec_type: str, days: int = 7) -> bool:
    """Return True if a non-rejected recommendation of this type exists within `days`."""
    cutoff = _utcnow() - timedelta(days=days)
    return (
        db.query(models.CoachingRecommendation)
        .filter(
            models.CoachingRecommendation.member_id == member_id,
            models.CoachingRecommendation.recommendation_type == rec_type,
            models.CoachingRecommendation.created_at >= cutoff,
            models.CoachingRecommendation.status.notin_(["Rejected", "Archived"]),
        )
        .first() is not None
    )


def _save_rec(
    db: Session,
    member_id: int,
    rec_type: str,
    title: str,
    summary: str,
    detailed_reason: str,
    supporting_data: dict,
    confidence: float,
    severity: str = "Medium",
    workout_group_id: int = None,
    workout_plan_id: int = None,
) -> models.CoachingRecommendation:
    rec = models.CoachingRecommendation(
        member_id=member_id,
        workout_group_id=workout_group_id,
        workout_plan_id=workout_plan_id,
        recommendation_type=rec_type,
        title=title,
        summary=summary,
        detailed_reason=detailed_reason,
        supporting_data_json=json.dumps(supporting_data),
        confidence_score=round(confidence, 2),
        severity=severity,
        status="Approved",
        generated_by="Rule Engine",
    )
    db.add(rec)
    db.flush()
    return rec


# ─── main engine ──────────────────────────────────────────────────────────────

def generate_for_member(member_id: int, db: Session) -> List[models.CoachingRecommendation]:
    """Run all rules for a member and return newly created recommendations."""
    created: List[models.CoachingRecommendation] = []
    now = _utcnow()
    today = now.date()

    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        return []
    first_name = member.first_name

    # ── workout sessions (last 28 days) ──────────────────────────────────────
    sessions_28 = (
        db.query(models.WorkoutSession)
        .filter(
            models.WorkoutSession.member_id == member_id,
            models.WorkoutSession.session_date >= today - timedelta(days=28),
        )
        .order_by(models.WorkoutSession.session_date.desc())
        .all()
    )
    completed_28 = [
        s for s in sessions_28
        if s.completion_status in ("Completed", "Partially Completed")
    ]
    adherence_28 = (len(completed_28) / len(sessions_28) * 100) if sessions_28 else 0.0

    rpe_sessions = [s for s in completed_28 if s.overall_rpe]
    avg_rpe_28 = (sum(s.overall_rpe for s in rpe_sessions) / len(rpe_sessions)) if rpe_sessions else 5.0

    pain_sessions = [s for s in completed_28 if s.highest_pain_score]
    avg_pain_28 = (sum(s.highest_pain_score for s in pain_sessions) / len(pain_sessions)) if pain_sessions else 0.0

    avg_compl_28 = (
        sum(s.completion_percentage or 0 for s in sessions_28) / len(sessions_28)
    ) if sessions_28 else 0.0

    # ── readiness scores (last 14 days) ──────────────────────────────────────
    readiness_14 = (
        db.query(models.ReadinessScore)
        .filter(
            models.ReadinessScore.member_id == member_id,
            models.ReadinessScore.created_at >= now - timedelta(days=14),
        )
        .order_by(models.ReadinessScore.created_at.desc())
        .all()
    )
    avg_readiness = (
        sum(r.score for r in readiness_14) / len(readiness_14)
    ) if readiness_14 else None
    red_count    = sum(1 for r in readiness_14 if r.category == "Red")
    orange_count = sum(1 for r in readiness_14 if r.category == "Orange")

    # ── recovery scores (last 7 days) ────────────────────────────────────────
    recovery_7 = (
        db.query(models.RecoveryScore)
        .filter(
            models.RecoveryScore.member_id == member_id,
            models.RecoveryScore.created_at >= now - timedelta(days=7),
        )
        .all()
    )
    poor_recovery_count = sum(
        1 for r in recovery_7 if r.category in ("Poor Recovery", "Recovery Risk")
    )

    # ── open pain flags ───────────────────────────────────────────────────────
    open_flags = (
        db.query(models.PainRiskFlag)
        .filter(
            models.PainRiskFlag.member_id == member_id,
            models.PainRiskFlag.status == "Open",
        )
        .all()
    )
    critical_flags = [f for f in open_flags if f.risk_level == "Critical"]
    high_flags     = [f for f in open_flags if f.risk_level == "High"]

    # ── check-ins (last 14 days) ─────────────────────────────────────────────
    check_ins_14 = (
        db.query(models.MemberCheckIn)
        .filter(
            models.MemberCheckIn.member_id == member_id,
            models.MemberCheckIn.check_in_date >= today - timedelta(days=14),
        )
        .all()
    )
    ci_adherence_pct = len(check_ins_14) / 14 * 100
    low_motivation   = sum(1 for c in check_ins_14 if c.motivation_level == "Low")

    # ── weekly check-ins (last 4 weeks) ──────────────────────────────────────
    weekly_4 = (
        db.query(models.WeeklyMemberCheckIn)
        .filter(
            models.WeeklyMemberCheckIn.member_id == member_id,
            models.WeeklyMemberCheckIn.week_start_date >= today - timedelta(days=28),
        )
        .all()
    )
    poor_nutrition_weeks  = sum(1 for w in weekly_4 if w.nutrition_adherence_self_rating == "Poor")
    poor_supplement_weeks = sum(1 for w in weekly_4 if w.supplement_adherence_self_rating == "Poor")

    # ── supplement side effects (last 14 days) ────────────────────────────────
    recent_side_effect = (
        db.query(models.SupplementAdherenceLog)
        .filter(
            models.SupplementAdherenceLog.member_id == member_id,
            models.SupplementAdherenceLog.side_effects_reported == True,
            models.SupplementAdherenceLog.date >= today - timedelta(days=14),
        )
        .first()
    )

    # ── current workout group ─────────────────────────────────────────────────
    current_assign = (
        db.query(models.MemberWorkoutGroupAssignment)
        .filter(
            models.MemberWorkoutGroupAssignment.member_id == member_id,
            models.MemberWorkoutGroupAssignment.status == "Active",
        )
        .order_by(models.MemberWorkoutGroupAssignment.created_at.desc())
        .first()
    )
    group_id = current_assign.workout_group_id if current_assign else None

    # ═══════════════════════════════════════════════════════════════════════════
    # RULES
    # ═══════════════════════════════════════════════════════════════════════════

    # ── 1. SAFETY REVIEW — Critical pain ─────────────────────────────────────
    if critical_flags and not _recent_exists(db, member_id, "Safety Review", days=3):
        locs = ", ".join(f.pain_location or "unspecified" for f in critical_flags)
        created.append(_save_rec(
            db, member_id, "Safety Review",
            title="⚠ Critical Pain Flag — Immediate Review Required",
            summary=(
                f"{first_name} has {len(critical_flags)} critical open pain flag(s). "
                "Coach review required before next session."
            ),
            detailed_reason=(
                f"Critical pain flags are open for: {locs}. "
                "High-intensity training should be paused until these are reviewed. "
                "The member may have an acute injury or overuse condition requiring professional assessment."
            ),
            supporting_data={
                "critical_flags": len(critical_flags),
                "locations": [f.pain_location for f in critical_flags],
                "pain_scores": [f.pain_score for f in critical_flags],
            },
            confidence=0.96, severity="Critical", workout_group_id=group_id,
        ))

    # ── 2. SAFETY REVIEW — High-risk pain (no critical) ──────────────────────
    elif high_flags and not _recent_exists(db, member_id, "Safety Review", days=3):
        locs = ", ".join(f.pain_location or "unspecified" for f in high_flags[:3])
        created.append(_save_rec(
            db, member_id, "Safety Review",
            title="⚠ High-Risk Pain Flags — Coach Review Recommended",
            summary=(
                f"{first_name} has {len(high_flags)} open high-risk pain flag(s). "
                "Review before progressing training load."
            ),
            detailed_reason=(
                f"High-risk pain flags are open for: {locs}. "
                "Consider modifying exercises that aggravate the affected areas and monitor closely."
            ),
            supporting_data={
                "high_flags": len(high_flags),
                "locations": [f.pain_location for f in high_flags],
            },
            confidence=0.88, severity="High", workout_group_id=group_id,
        ))

    # ── 3. SUPPLEMENT SIDE EFFECT — Urgent ───────────────────────────────────
    if recent_side_effect and not _recent_exists(db, member_id, "Supplement Review", days=3):
        created.append(_save_rec(
            db, member_id, "Supplement Review",
            title="⚠ Supplement Side Effect — Urgent Review Required",
            summary=(
                f"{first_name} has recently reported supplement side effects. "
                "Pause supplement plan pending coach or healthcare professional review."
            ),
            detailed_reason=(
                "A supplement side effect has been reported. The supplement plan should be paused or modified. "
                "The member should consult a coach or qualified healthcare professional before continuing. "
                "DISCLAIMER: Supplement recommendations do not constitute medical advice."
            ),
            supporting_data={
                "side_effect_notes": recent_side_effect.side_effect_notes or "Not specified",
                "reported_date": str(recent_side_effect.date),
            },
            confidence=0.96, severity="Critical",
        ))

    # ── 4. DELOAD — Persistent low readiness / poor recovery ─────────────────
    deload_triggered = False
    if (red_count >= 2 or orange_count >= 4 or poor_recovery_count >= 3):
        if not _recent_exists(db, member_id, "Deload", days=7):
            deload_triggered = True
            avg_r_str = f"{avg_readiness:.0f}" if avg_readiness else "N/A"
            created.append(_save_rec(
                db, member_id, "Deload",
                title="🔴 Deload Week Recommended",
                summary=(
                    f"{first_name} has {red_count} Red and {orange_count} Orange readiness scores "
                    f"in the last 14 days and {poor_recovery_count} poor recovery days in 7 days."
                ),
                detailed_reason=(
                    f"Persistent low readiness (Red: {red_count}, Orange: {orange_count} over 14 days) "
                    f"and {poor_recovery_count} poor recovery scores indicate inadequate recovery. "
                    "Recommended: reduce training volume by 40-50%, focus on mobility and low-intensity movement, "
                    "prioritise sleep, nutrition and stress management. "
                    f"Average readiness score: {avg_r_str}/100."
                ),
                supporting_data={
                    "red_readiness_14d": red_count,
                    "orange_readiness_14d": orange_count,
                    "poor_recovery_7d": poor_recovery_count,
                    "avg_readiness": round(avg_readiness, 1) if avg_readiness else None,
                },
                confidence=0.87, severity="High", workout_group_id=group_id,
            ))

    # ── 5. WORKOUT REGRESSION — High RPE or low completion (not deload) ───────
    regression_triggered = False
    if not deload_triggered and sessions_28:
        if (avg_rpe_28 >= 9 or avg_compl_28 < 50) and not _recent_exists(db, member_id, "Workout Regression", days=7):
            regression_triggered = True
            reasons = []
            if avg_rpe_28 >= 9:
                reasons.append(f"average RPE {avg_rpe_28:.1f} (target ≤7)")
            if avg_compl_28 < 50:
                reasons.append(f"average session completion {avg_compl_28:.0f}%")
            created.append(_save_rec(
                db, member_id, "Workout Regression",
                title="↘ Reduce Training Intensity",
                summary=f"{first_name}'s training load appears too high — consider reducing intensity or volume.",
                detailed_reason=(
                    f"Overload indicators: {'; '.join(reasons)}. "
                    "Recommended actions: reduce prescribed sets by 1, lower target RPE to 6-7, "
                    "increase rest periods between sets, or replace high-intensity finishers with mobility work."
                ),
                supporting_data={
                    "avg_rpe_28d": round(avg_rpe_28, 1),
                    "avg_completion_28d": round(avg_compl_28, 1),
                    "sessions_analysed": len(sessions_28),
                },
                confidence=0.81, severity="High", workout_group_id=group_id,
            ))

    # ── 6. WORKOUT PROGRESSION ────────────────────────────────────────────────
    if (not deload_triggered and not regression_triggered
            and adherence_28 >= 85 and avg_rpe_28 <= 7 and avg_pain_28 < 4
            and len(sessions_28) >= 6
            and (avg_readiness is None or avg_readiness >= 60)
            and not _recent_exists(db, member_id, "Workout Progression", days=7)):
        avg_r_str = f"{avg_readiness:.0f}" if avg_readiness else "N/A"
        created.append(_save_rec(
            db, member_id, "Workout Progression",
            title=f"🚀 {first_name} is Ready to Progress",
            summary=(
                f"{adherence_28:.0f}% adherence, avg RPE {avg_rpe_28:.1f}, "
                f"avg pain {avg_pain_28:.1f}, avg readiness {avg_r_str}. "
                "Consider increasing training load."
            ),
            detailed_reason=(
                f"Progression indicators are strong: {adherence_28:.0f}% workout adherence over 28 days, "
                f"average RPE {avg_rpe_28:.1f} (room to increase), average pain {avg_pain_28:.1f} (low risk). "
                "Suggested options: increase prescribed reps by 1-2 per set, "
                "increase load by 2.5-5%, add one set to main compound exercises, "
                "or advance to the next plan week."
            ),
            supporting_data={
                "adherence_28d_pct": round(adherence_28, 1),
                "avg_rpe_28d": round(avg_rpe_28, 1),
                "avg_pain_28d": round(avg_pain_28, 1),
                "avg_readiness": round(avg_readiness, 1) if avg_readiness else None,
                "completed_sessions": len(completed_28),
            },
            confidence=0.88, severity="Low", workout_group_id=group_id,
        ))

    # ── 7. REASSESSMENT ───────────────────────────────────────────────────────
    if (adherence_28 >= 85 and len(completed_28) >= 8
            and not _recent_exists(db, member_id, "Reassessment", days=14)):
        created.append(_save_rec(
            db, member_id, "Reassessment",
            title=f"📋 Schedule Reassessment for {first_name}",
            summary=(
                f"{len(completed_28)} sessions completed with {adherence_28:.0f}% adherence — formal reassessment due."
            ),
            detailed_reason=(
                f"With {len(completed_28)} completed sessions and {adherence_28:.0f}% adherence in 28 days, "
                f"{first_name} is progressing consistently. A formal reassessment is recommended to "
                "update physical metrics, re-score fitness benchmarks, review goals and potentially advance the plan."
            ),
            supporting_data={
                "completed_sessions_28d": len(completed_28),
                "adherence_pct": round(adherence_28, 1),
            },
            confidence=0.84, severity="Medium", workout_group_id=group_id,
        ))

    # ── 8. COACH FOLLOW-UP — Low engagement ──────────────────────────────────
    if (ci_adherence_pct < 40 or low_motivation >= 3) and not _recent_exists(db, member_id, "Coach Follow-Up", days=7):
        reasons = []
        if ci_adherence_pct < 40:
            reasons.append(f"only {len(check_ins_14)} check-ins in 14 days ({ci_adherence_pct:.0f}% adherence)")
        if low_motivation >= 3:
            reasons.append(f"motivation reported Low in {low_motivation} recent check-ins")
        created.append(_save_rec(
            db, member_id, "Coach Follow-Up",
            title=f"📞 Engagement Drop — Follow Up with {first_name}",
            summary="Member engagement is declining. Coach follow-up recommended.",
            detailed_reason=(
                f"Engagement concerns: {'; '.join(reasons)}. "
                "Actions: reach out, identify training barriers, review goals and "
                "increase accountability through coaching touchpoints."
            ),
            supporting_data={
                "check_in_count_14d": len(check_ins_14),
                "check_in_adherence_pct": round(ci_adherence_pct, 1),
                "low_motivation_count": low_motivation,
            },
            confidence=0.76, severity="Medium",
        ))

    # ── 9. NUTRITION REVIEW ───────────────────────────────────────────────────
    if poor_nutrition_weeks >= 2 and not _recent_exists(db, member_id, "Nutrition Adjustment", days=7):
        created.append(_save_rec(
            db, member_id, "Nutrition Adjustment",
            title=f"🥗 Nutrition Adherence Review — {first_name}",
            summary=(
                f"Poor nutrition adherence reported in {poor_nutrition_weeks}/{len(weekly_4)} recent weekly check-ins."
            ),
            detailed_reason=(
                f"Poor nutrition adherence over {poor_nutrition_weeks} recent weeks may impact "
                "recovery, energy and goal progress. Review nutrition plan, simplify meal approach, "
                "and address barriers to consistency. "
                "DISCLAIMER: Nutrition recommendations are for general fitness guidance and do not "
                "replace advice from a registered dietitian or healthcare professional."
            ),
            supporting_data={
                "poor_nutrition_weeks": poor_nutrition_weeks,
                "total_weekly_check_ins": len(weekly_4),
            },
            confidence=0.78, severity="Medium",
        ))

    # ── 10. SUPPLEMENT REVIEW — Poor adherence (no side effects) ─────────────
    if (not recent_side_effect and poor_supplement_weeks >= 2
            and not _recent_exists(db, member_id, "Supplement Review", days=7)):
        created.append(_save_rec(
            db, member_id, "Supplement Review",
            title=f"💊 Supplement Adherence Review — {first_name}",
            summary=f"Poor supplement adherence in {poor_supplement_weeks} recent weekly check-ins.",
            detailed_reason=(
                f"Poor supplement adherence reported {poor_supplement_weeks} time(s). "
                "Review whether the plan is practical and address barriers to consistency. "
                "DISCLAIMER: Supplement recommendations do not constitute medical advice."
            ),
            supporting_data={"poor_supplement_weeks": poor_supplement_weeks},
            confidence=0.72, severity="Low",
        ))

    db.commit()
    return created
