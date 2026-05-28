"""
AI Coach Copilot — Phase 3.2
Deterministic, data-driven coaching insight generator.
Produces structured, natural-language analysis without an external AI API.
"""
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app import models


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def generate_insight(
    member_id: int,
    db: Session,
    admin_id: Optional[int] = None,
) -> models.AiCoachingInsight:
    """Generate a structured coaching insight for a member from live data."""
    now   = _utcnow()
    today = now.date()

    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise ValueError("Member not found")

    name      = member.first_name
    full_name = f"{member.first_name} {member.last_name}"

    # ── gather data ──────────────────────────────────────────────────────────

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
    adherence_pct = (len(completed_28) / len(sessions_28) * 100) if sessions_28 else 0.0

    rpe_vals  = [s.overall_rpe      for s in completed_28 if s.overall_rpe]
    pain_vals = [s.highest_pain_score for s in completed_28 if s.highest_pain_score]
    avg_rpe   = (sum(rpe_vals)  / len(rpe_vals))  if rpe_vals  else 0.0
    avg_pain  = (sum(pain_vals) / len(pain_vals))  if pain_vals else 0.0

    avg_completion_pct = (
        sum(s.completion_percentage or 0 for s in sessions_28) / len(sessions_28)
    ) if sessions_28 else 0.0

    readiness_7 = (
        db.query(models.ReadinessScore)
        .filter(
            models.ReadinessScore.member_id == member_id,
            models.ReadinessScore.created_at >= now - timedelta(days=7),
        )
        .order_by(models.ReadinessScore.created_at.desc())
        .all()
    )
    avg_readiness = (
        sum(r.score for r in readiness_7) / len(readiness_7)
    ) if readiness_7 else None
    readiness_cats = [r.category for r in readiness_7]

    recovery_7 = (
        db.query(models.RecoveryScore)
        .filter(
            models.RecoveryScore.member_id == member_id,
            models.RecoveryScore.created_at >= now - timedelta(days=7),
        )
        .all()
    )
    avg_recovery = (
        sum(r.score for r in recovery_7) / len(recovery_7)
    ) if recovery_7 else None
    poor_recovery = sum(1 for r in recovery_7 if r.category in ("Poor Recovery", "Recovery Risk"))

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

    check_ins_14 = (
        db.query(models.MemberCheckIn)
        .filter(
            models.MemberCheckIn.member_id == member_id,
            models.MemberCheckIn.check_in_date >= today - timedelta(days=14),
        )
        .all()
    )
    ci_pct = len(check_ins_14) / 14 * 100

    weekly_4 = (
        db.query(models.WeeklyMemberCheckIn)
        .filter(
            models.WeeklyMemberCheckIn.member_id == member_id,
            models.WeeklyMemberCheckIn.week_start_date >= today - timedelta(days=28),
        )
        .all()
    )

    open_tasks = (
        db.query(models.CoachTask)
        .filter(
            models.CoachTask.member_id == member_id,
            models.CoachTask.status == "Open",
        )
        .count()
    )

    hp = member.health_profile  # may be None

    # ── confidence (based on data richness) ──────────────────────────────────
    data_points = (
        len(sessions_28) * 2 +
        len(readiness_7) * 3 +
        len(check_ins_14) * 1 +
        len(weekly_4) * 2
    )
    confidence = min(0.95, 0.40 + data_points * 0.005)

    # ── SUMMARY ──────────────────────────────────────────────────────────────
    if not sessions_28 and not check_ins_14:
        summary = (
            f"{full_name} has no recent workout sessions or check-ins on record. "
            "Not enough data to generate a full coaching insight — encourage the member to "
            "complete daily check-ins and log workout sessions."
        )
        confidence = 0.30
    else:
        trend = (
            "progressing well" if adherence_pct >= 80
            else "maintaining momentum" if adherence_pct >= 60
            else "falling behind on sessions"
        )
        redness = critical_flags or [f for f in open_flags if f.risk_level == "High"]
        flag_note = (
            f" {len(open_flags)} open pain flag(s) require attention." if open_flags else ""
        )
        summary = (
            f"{full_name} is {trend} — {len(completed_28)} sessions completed over the last 28 days "
            f"({adherence_pct:.0f}% adherence)"
            + (f", average RPE {avg_rpe:.1f}" if avg_rpe else "")
            + (f", average readiness {avg_readiness:.0f}" if avg_readiness else "")
            + f".{flag_note}"
        )

    # ── PROGRESS ANALYSIS ────────────────────────────────────────────────────
    if not sessions_28:
        progress_analysis = (
            f"No workout sessions recorded in the last 28 days. "
            f"Encourage {name} to log sessions consistently."
        )
    else:
        comp_label = (
            "excellent" if adherence_pct >= 85
            else "good" if adherence_pct >= 70
            else "moderate" if adherence_pct >= 50
            else "low"
        )
        rpe_label = (
            "well within capacity — room to progress" if avg_rpe <= 6
            else "manageable" if avg_rpe <= 7.5
            else "high — consider reducing load" if avg_rpe <= 9
            else "very high — reduce intensity immediately"
        )
        progress_analysis = (
            f"{name} has completed {len(completed_28)} of {len(sessions_28)} logged sessions "
            f"({adherence_pct:.0f}% — {comp_label}). "
            f"Average session completion rate: {avg_completion_pct:.0f}%. "
        )
        if avg_rpe:
            progress_analysis += f"Average RPE: {avg_rpe:.1f} ({rpe_label}). "
        if avg_pain:
            pain_note = (
                "Pain levels are low — low injury risk." if avg_pain < 3
                else "Pain levels are moderate — monitor carefully." if avg_pain < 6
                else "Pain levels are high — review before next session."
            )
            progress_analysis += f"Average pain score: {avg_pain:.1f}/10 — {pain_note}"

    # ── READINESS ANALYSIS ───────────────────────────────────────────────────
    if not readiness_7:
        readiness_analysis = (
            f"No readiness scores in the last 7 days. "
            f"Encourage {name} to submit daily check-ins to generate readiness scores."
        )
    else:
        green  = readiness_cats.count("Green")
        yellow = readiness_cats.count("Yellow")
        orange = readiness_cats.count("Orange")
        red    = readiness_cats.count("Red")
        latest_cat = readiness_7[0].category

        status = (
            f"well-recovered and ready to train" if green >= 5
            else f"under-recovered — reduce intensity and focus on recovery" if red >= 2 or orange >= 3
            else f"variable — continue monitoring"
        )
        readiness_analysis = (
            f"7-day readiness: average score {avg_readiness:.0f}/100 (latest: {latest_cat}). "
            f"Distribution — Green: {green}, Yellow: {yellow}, Orange: {orange}, Red: {red}. "
            f"{name} appears {status}."
        )
        if avg_recovery is not None:
            rec_label = (
                "Excellent" if avg_recovery >= 80 else
                "Good" if avg_recovery >= 65 else
                "Moderate" if avg_recovery >= 50 else
                "Poor"
            )
            readiness_analysis += (
                f" Average recovery score: {avg_recovery:.0f}/100 ({rec_label})."
            )
            if poor_recovery >= 3:
                readiness_analysis += (
                    f" {poor_recovery}/7 days showed poor recovery — deload recommended."
                )

    # ── RISK ANALYSIS ────────────────────────────────────────────────────────
    if not open_flags:
        risk_analysis = f"No open pain or risk flags for {name}. Current risk level: Low."
    else:
        flag_summary = "; ".join(
            f"{f.risk_level} — {f.pain_location or 'unspecified'} (pain {f.pain_score}/10)"
            for f in open_flags[:4]
        )
        risk_analysis = (
            f"{name} has {len(open_flags)} open pain/risk flag(s): {flag_summary}."
        )
        if critical_flags:
            risk_analysis += " CRITICAL: Pause high-intensity training until reviewed by coach."
        elif high_flags:
            risk_analysis += " High-risk flags should be reviewed — modify exercises affecting flagged areas."

    # ── ADHERENCE ANALYSIS ───────────────────────────────────────────────────
    adherence_analysis = (
        f"Check-in adherence: {len(check_ins_14)}/14 days ({ci_pct:.0f}%). "
        f"Workout adherence: {adherence_pct:.0f}% over 28 days. "
    )
    if weekly_4:
        latest_w = weekly_4[-1]
        if latest_w.workout_adherence_self_rating:
            adherence_analysis += f"Self-rated workout adherence: {latest_w.workout_adherence_self_rating}. "
        if latest_w.perceived_progress:
            adherence_analysis += f"Perceived progress: {latest_w.perceived_progress}."
        if latest_w.biggest_challenge_this_week:
            adherence_analysis += f" Key challenge: \"{latest_w.biggest_challenge_this_week}\"."

    # ── NUTRITION ANALYSIS ───────────────────────────────────────────────────
    if not weekly_4:
        nutrition_analysis = (
            f"No weekly check-in data available for nutrition analysis. "
            "Encourage {name} to complete weekly check-ins."
        )
    else:
        poor_n = sum(1 for w in weekly_4 if w.nutrition_adherence_self_rating == "Poor")
        good_n = sum(1 for w in weekly_4 if w.nutrition_adherence_self_rating in ("Good", "Excellent"))
        if poor_n >= 2:
            nutrition_analysis = (
                f"Nutrition adherence has been poor in {poor_n}/{len(weekly_4)} recent weekly check-ins. "
                "Review the nutrition plan and address barriers. "
                "DISCLAIMER: Nutrition guidance is for general fitness support and does not replace "
                "advice from a registered dietitian or healthcare professional."
            )
        elif good_n >= 2:
            nutrition_analysis = (
                f"Nutrition adherence is strong ({good_n}/{len(weekly_4)} weeks rated Good or Excellent). "
                "Continue current approach and monitor alignment with goal progress."
            )
        else:
            nutrition_analysis = (
                f"Nutrition adherence is variable — {len(weekly_4)} weeks tracked. "
                "Continue monitoring and address any recurring challenges."
            )

    # ── SUPPLEMENT ANALYSIS ──────────────────────────────────────────────────
    if not weekly_4:
        supplement_analysis = "No weekly check-in data for supplement analysis."
    else:
        supp_poor = sum(1 for w in weekly_4 if w.supplement_adherence_self_rating == "Poor")
        side_effect = (
            db.query(models.SupplementAdherenceLog)
            .filter(
                models.SupplementAdherenceLog.member_id == member_id,
                models.SupplementAdherenceLog.side_effects_reported == True,
                models.SupplementAdherenceLog.date >= today - timedelta(days=14),
            )
            .first()
        )
        if side_effect:
            supplement_analysis = (
                "⚠ Supplement side effects recently reported. "
                "Supplement plan should be paused and reviewed. "
                "DISCLAIMER: Supplement recommendations do not constitute medical advice — "
                "consult a qualified healthcare professional."
            )
        elif supp_poor >= 2:
            supplement_analysis = (
                f"Poor supplement adherence in {supp_poor}/{len(weekly_4)} recent weeks. "
                "Review whether the plan is practical and address compliance barriers."
            )
        else:
            supplement_analysis = (
                "Supplement adherence appears on track based on recent check-ins."
            )

    # ── RECOMMENDED NEXT STEPS ───────────────────────────────────────────────
    steps = []
    if critical_flags:
        steps.append("URGENT — review critical pain flags before next session.")
    if open_tasks:
        steps.append(f"Action {open_tasks} open coach task(s) in the Coach Tasks page.")
    if avg_rpe >= 9:
        steps.append("Reduce training intensity — average RPE is too high.")
    elif adherence_pct >= 85 and avg_rpe <= 6.5 and not open_flags:
        steps.append("Consider progressive overload — member has capacity to increase load.")
    if avg_readiness is not None and avg_readiness < 50:
        steps.append("Implement a deload or recovery week — readiness is persistently low.")
    if ci_pct < 40:
        steps.append("Contact member to improve check-in consistency.")
    if not steps:
        steps.append("Continue current plan and monitor weekly progress.")
        if adherence_pct >= 85:
            steps.append("Schedule a formal reassessment to update benchmarks and set new targets.")

    recommended_next_steps = " | ".join(steps)

    # ── SAFETY NOTES ─────────────────────────────────────────────────────────
    safety_parts = []
    if hp:
        if hp.medical_clearance_required == "Yes" and hp.medical_clearance_received != "Yes":
            safety_parts.append(
                "Medical clearance required — confirm before increasing intensity."
            )
        if hp.medications:
            safety_parts.append(
                "Member is on medication — check contraindications before adding supplements or high-intensity load."
            )
        if hp.chronic_conditions:
            safety_parts.append(
                f"Chronic conditions on file ({hp.chronic_conditions[:60]}…) — apply appropriate exercise caution."
            )
    if critical_flags:
        safety_parts.append("Critical pain flags open — do not progress until reviewed.")
    if not safety_parts:
        safety_parts.append("No critical safety flags identified at this time.")

    safety_notes = " | ".join(safety_parts)

    # ── source data snapshot ─────────────────────────────────────────────────
    source_data = {
        "generated_at": str(today),
        "sessions_28d": len(sessions_28),
        "completed_28d": len(completed_28),
        "adherence_pct": round(adherence_pct, 1),
        "avg_rpe": round(avg_rpe, 1) if avg_rpe else None,
        "avg_pain": round(avg_pain, 1) if avg_pain else None,
        "readiness_scores_7d": len(readiness_7),
        "avg_readiness": round(avg_readiness, 1) if avg_readiness else None,
        "avg_recovery": round(avg_recovery, 1) if avg_recovery else None,
        "open_pain_flags": len(open_flags),
        "check_ins_14d": len(check_ins_14),
        "open_coach_tasks": open_tasks,
        "weekly_check_ins_4w": len(weekly_4),
    }

    insight = models.AiCoachingInsight(
        member_id=member_id,
        generated_by_admin_id=admin_id,
        summary=summary,
        progress_analysis=progress_analysis,
        readiness_analysis=readiness_analysis,
        risk_analysis=risk_analysis,
        adherence_analysis=adherence_analysis,
        nutrition_analysis=nutrition_analysis,
        supplement_analysis=supplement_analysis,
        recommended_next_steps=recommended_next_steps,
        safety_notes=safety_notes,
        confidence_score=round(confidence, 2),
        source_data_json=json.dumps(source_data),
        status="Generated",
    )
    db.add(insight)
    db.commit()
    db.refresh(insight)
    return insight
