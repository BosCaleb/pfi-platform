"""Workout Group recommendation engine.

Given a Member ORM object and a list of WorkoutGroup ORM objects,
scores and ranks groups by compatibility. Returns a sorted list of
(WorkoutGroup, score, reason) tuples.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models import Member, WorkoutGroup


def recommend_groups(
    member: "Member",
    groups: list["WorkoutGroup"],
) -> list[tuple["WorkoutGroup", int, str]]:
    """Score each active group against a member profile.

    Returns list of (group, score, reason_string) sorted best-first.
    Only groups with score > 0 are returned.
    """
    health     = member.health_profile
    physical   = member.physical_metrics
    lifestyle  = member.lifestyle_profile
    motivation = member.motivation_profile

    fitness_level  = (member.fitness_level  or "Beginner").strip()
    primary_goal   = (member.primary_goal   or "").strip().lower()
    risk_level     = (member.risk_level     or "Low").strip().lower()

    has_injuries    = bool(health and health.injuries and health.injuries.strip())
    has_knee_pain   = bool(health and health.pain_areas and "knee"    in (health.pain_areas or "").lower())
    has_back_pain   = bool(health and health.pain_areas and "back"    in (health.pain_areas or "").lower())
    has_shoulder    = bool(health and health.pain_areas and "shoulder" in (health.pain_areas or "").lower())
    needs_clearance = bool(
        health
        and health.medical_clearance_required == "Yes"
        and health.medical_clearance_received != "Yes"
    )

    mobility_score     = (physical.mobility_score or 5) if physical else 5
    recovery_capacity  = ((lifestyle.recovery_capacity or "Medium") if lifestyle else "Medium").lower()
    pref_frequency     = (motivation.training_frequency if motivation else None)
    pref_duration      = (motivation.session_duration   if motivation else None)

    results: list[tuple["WorkoutGroup", int, str]] = []

    for group in groups:
        if group.status != "Active":
            continue

        score   = 0
        reasons: list[str] = []

        # ── Risk compatibility ─────────────────────────────────
        group_risk = (group.allowed_risk_level or "Low").lower()
        if group_risk == "low" and risk_level in ("medium", "high"):
            continue   # incompatible
        if group_risk == "medium" and risk_level == "high":
            score -= 5  # possible but not ideal

        gname = group.group_name.lower()

        # ── Fitness level (30 pts) ─────────────────────────────
        target_lvl = (group.target_fitness_level or "").lower()
        if target_lvl == fitness_level.lower():
            score += 30
            reasons.append(f"Fitness level match ({fitness_level})")
        elif target_lvl in ("beginner", "intermediate") and fitness_level.lower() in ("beginner", "intermediate"):
            score += 10

        # ── Goal match (25 pts) ────────────────────────────────
        group_goal = (group.primary_goal or "").lower()
        if group_goal and primary_goal:
            if group_goal in primary_goal or primary_goal in group_goal:
                score += 25
                reasons.append(f"Goal match ({member.primary_goal})")

        # ── Injury / rehab signals (up to 20 pts) ─────────────
        if (has_injuries or needs_clearance) and ("rehab" in gname or "mobility" in gname):
            score += 20
            reasons.append("Injury/clearance history suits rehab focus")

        if has_knee_pain and "low-impact" in gname:
            score += 20
            reasons.append("Knee pain — low-impact training recommended")
        elif (has_injuries or has_back_pain or has_shoulder) and "low-impact" in gname:
            score += 10

        # ── Risk level → low-impact preference (10 pts) ───────
        if risk_level in ("medium", "high") and "low-impact" in gname:
            score += 10
            reasons.append(f"Risk level ({risk_level}) — low-impact safer")

        # ── Advanced performance (20 pts) ──────────────────────
        if fitness_level.lower() in ("advanced", "athlete") and primary_goal in (
            "sports performance", "strength", "muscle gain"
        ):
            if any(kw in gname for kw in ("sports", "athlete", "advanced")):
                score += 20
                reasons.append("Advanced/Athlete with performance goal")

        # ── Busy Professional (15 pts) ─────────────────────────
        if pref_duration and pref_duration <= 40 and "busy" in gname:
            score += 15
            reasons.append("Short session preference → Busy Professional")

        # ── Training frequency alignment (10 pts) ─────────────
        if pref_frequency and group.default_weekly_frequency:
            diff = abs(pref_frequency - group.default_weekly_frequency)
            if diff == 0:
                score += 10
                reasons.append(f"Frequency match ({pref_frequency}×/wk)")
            elif diff == 1:
                score += 5

        # ── Low mobility / low recovery (15 pts) ──────────────
        if (mobility_score < 5 or recovery_capacity == "low") and (
            "mobility" in gname or "rehab" in gname
        ):
            score += 15
            reasons.append("Low mobility/recovery — mobility focus advised")

        if score > 0:
            reason_str = "; ".join(reasons) if reasons else "General compatibility"
            results.append((group, score, reason_str))

    results.sort(key=lambda x: x[1], reverse=True)
    return results
