"""
Readiness and Recovery scoring engine for Phase 3.1.

Both scores are rule-based, transparent, and explained in the breakdown JSON.
No AI/ML is used — all logic is deterministic and auditable.
"""
import json
from typing import Optional


# ── Readiness Score ───────────────────────────────────────────────────

def calculate_readiness_score(
    sleep_hours: Optional[float] = None,
    sleep_quality: Optional[str] = None,
    energy_level: Optional[str] = None,
    stress_level: Optional[str] = None,
    muscle_soreness: Optional[str] = None,
    pain_level: Optional[int] = None,
    mood: Optional[str] = None,
    motivation_level: Optional[str] = None,
    nutrition_adherence: Optional[str] = None,
    new_injury_reported: Optional[str] = None,
    workout_readiness: Optional[str] = None,
) -> dict:
    """
    Calculate a readiness score from 0–100 based on check-in data.
    Returns dict with score, category, recommendation_summary, breakdown.
    """
    base = 50.0
    breakdown = {}

    # Sleep hours
    if sleep_hours is not None:
        if sleep_hours >= 8:
            delta = 15
        elif sleep_hours >= 7:
            delta = 8
        elif sleep_hours >= 6:
            delta = 3
        elif sleep_hours >= 5:
            delta = -8
        else:
            delta = -15
        base += delta
        breakdown["sleep_hours"] = {"value": sleep_hours, "delta": delta}

    # Sleep quality
    sq_map = {"Excellent": 12, "Good": 6, "Fair": -5, "Poor": -12}
    if sleep_quality and sleep_quality in sq_map:
        delta = sq_map[sleep_quality]
        base += delta
        breakdown["sleep_quality"] = {"value": sleep_quality, "delta": delta}

    # Energy level
    en_map = {"Very High": 12, "High": 6, "Moderate": 0, "Low": -8, "Very Low": -15}
    if energy_level and energy_level in en_map:
        delta = en_map[energy_level]
        base += delta
        breakdown["energy_level"] = {"value": energy_level, "delta": delta}

    # Stress level
    st_map = {"Low": 10, "Medium": 0, "High": -10, "Very High": -15}
    if stress_level and stress_level in st_map:
        delta = st_map[stress_level]
        base += delta
        breakdown["stress_level"] = {"value": stress_level, "delta": delta}

    # Muscle soreness
    so_map = {"None": 8, "Mild": 3, "Moderate": -5, "Severe": -10}
    if muscle_soreness and muscle_soreness in so_map:
        delta = so_map[muscle_soreness]
        base += delta
        breakdown["muscle_soreness"] = {"value": muscle_soreness, "delta": delta}

    # Pain level
    if pain_level is not None:
        if pain_level == 0:
            delta = 8
        elif pain_level <= 2:
            delta = 3
        elif pain_level <= 5:
            delta = -8
        elif pain_level <= 7:
            delta = -15
        else:
            delta = -25
        base += delta
        breakdown["pain_level"] = {"value": pain_level, "delta": delta}

    # New injury reported
    if new_injury_reported == "Yes":
        delta = -25
        base += delta
        breakdown["new_injury"] = {"value": True, "delta": delta}

    # Motivation
    mo_map = {"High": 6, "Medium": 0, "Low": -6}
    if motivation_level and motivation_level in mo_map:
        delta = mo_map[motivation_level]
        base += delta
        breakdown["motivation_level"] = {"value": motivation_level, "delta": delta}

    # Nutrition adherence bonus
    na_map = {"Excellent": 3, "Good": 3, "Moderate": 0, "Poor": -3}
    if nutrition_adherence and nutrition_adherence in na_map:
        delta = na_map[nutrition_adherence]
        base += delta
        breakdown["nutrition_adherence"] = {"value": nutrition_adherence, "delta": delta}

    # Workout readiness self-report override (soft cap)
    if workout_readiness == "Not Ready":
        base = min(base, 35)
        breakdown["self_report_override"] = {"value": workout_readiness, "note": "Capped at 35"}
    elif workout_readiness == "Ready to Push":
        base = max(base, 65)
        breakdown["self_report_boost"] = {"value": workout_readiness, "note": "Floored at 65"}

    # Pain >= 6 cannot be Green
    if pain_level is not None and pain_level >= 6:
        base = min(base, 59)

    score = round(max(0.0, min(100.0, base)), 1)

    if score >= 80:
        category = "Green"
        recommendation = "Ready to progress — high readiness indicators. Coach may consider progressive overload."
    elif score >= 60:
        category = "Yellow"
        recommendation = "Maintain current training load. Monitor recovery and check-in data."
    elif score >= 40:
        category = "Orange"
        recommendation = "Reduce training intensity. Prioritise recovery and address any pain or fatigue."
    else:
        category = "Red"
        recommendation = "Recovery or coach review needed. Do not progress load. Assess pain, sleep and stress."

    return {
        "score": score,
        "category": category,
        "recommendation_summary": recommendation,
        "score_breakdown_json": json.dumps(breakdown),
    }


# ── Recovery Score ────────────────────────────────────────────────────

def calculate_recovery_score(
    sleep_hours: Optional[float] = None,
    sleep_quality: Optional[str] = None,
    stress_level: Optional[str] = None,
    muscle_soreness: Optional[str] = None,
    pain_level: Optional[int] = None,
) -> dict:
    """
    Calculate a recovery score from 0–100.
    Focused purely on recovery indicators (sleep, stress, soreness, pain).
    """
    base = 65.0
    breakdown = {}

    # Sleep hours
    if sleep_hours is not None:
        if sleep_hours >= 8:
            delta = 18
        elif sleep_hours >= 7:
            delta = 10
        elif sleep_hours >= 6:
            delta = 3
        elif sleep_hours >= 5:
            delta = -10
        else:
            delta = -20
        base += delta
        breakdown["sleep_hours"] = {"value": sleep_hours, "delta": delta}

    # Sleep quality
    sq_map = {"Excellent": 18, "Good": 8, "Fair": -8, "Poor": -18}
    if sleep_quality and sleep_quality in sq_map:
        delta = sq_map[sleep_quality]
        base += delta
        breakdown["sleep_quality"] = {"value": sleep_quality, "delta": delta}

    # Stress
    st_map = {"Low": 15, "Medium": 0, "High": -15, "Very High": -20}
    if stress_level and stress_level in st_map:
        delta = st_map[stress_level]
        base += delta
        breakdown["stress_level"] = {"value": stress_level, "delta": delta}

    # Soreness
    so_map = {"None": 12, "Mild": 5, "Moderate": -8, "Severe": -15}
    if muscle_soreness and muscle_soreness in so_map:
        delta = so_map[muscle_soreness]
        base += delta
        breakdown["muscle_soreness"] = {"value": muscle_soreness, "delta": delta}

    # Pain
    if pain_level is not None:
        if pain_level == 0:
            delta = 10
        elif pain_level <= 2:
            delta = 5
        elif pain_level <= 5:
            delta = -5
        elif pain_level <= 7:
            delta = -15
        else:
            delta = -20
        base += delta
        breakdown["pain_level"] = {"value": pain_level, "delta": delta}

    score = round(max(0.0, min(100.0, base)), 1)

    if score >= 80:
        category = "Excellent Recovery"
    elif score >= 60:
        category = "Good Recovery"
    elif score >= 40:
        category = "Moderate Recovery"
    elif score >= 20:
        category = "Poor Recovery"
    else:
        category = "Recovery Risk"

    return {
        "score": score,
        "category": category,
        "score_breakdown_json": json.dumps(breakdown),
    }


# ── Adherence Category ────────────────────────────────────────────────

def adherence_category(pct: float) -> str:
    if pct >= 85:
        return "Excellent"
    elif pct >= 70:
        return "Good"
    elif pct >= 50:
        return "Moderate"
    elif pct >= 30:
        return "Low"
    else:
        return "At Risk"
