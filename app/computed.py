from typing import Optional
from app import models
from datetime import date

def calculate_age(dob: Optional[date]) -> int:
    if not dob:
        return 0
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

def calculate_bmi(height_cm: float, weight_kg: float) -> float:
    if not height_cm or not weight_kg:
        return 0.0
    return round(weight_kg / ((height_cm / 100) ** 2), 1)

def compute_recovery_score(lifestyle: Optional[models.MemberLifestyleProfile]) -> int:
    if not lifestyle:
        return 50
    score = 70
    if lifestyle.sleep_hours:
        s = lifestyle.sleep_hours
        score += 15 if s >= 8 else 5 if s >= 6 else -10 if s >= 5 else -20
    if lifestyle.stress_level == "Low":
        score += 10
    elif lifestyle.stress_level == "High":
        score -= 15
    if lifestyle.activity_level == "Very Active":
        score += 5
    elif lifestyle.activity_level == "Sedentary":
        score -= 10
    if lifestyle.recovery_capacity == "High":
        score += 10
    elif lifestyle.recovery_capacity == "Low":
        score -= 10
    return max(0, min(100, score))

def compute_injury_risk(health: Optional[models.MemberHealthProfile]) -> int:
    if not health:
        return 20
    risk = 20
    if health.injuries and health.injuries.strip():
        risk += 25
    if health.pain_areas and health.pain_areas.strip():
        risk += 15
    if health.chronic_conditions and health.chronic_conditions.strip():
        risk += 20
    if health.medical_clearance_required == "Yes" and health.medical_clearance_received != "Yes":
        risk += 20
    return max(0, min(100, risk))

def compute_strength_index(assessments: list) -> int:
    if not assessments:
        return 50
    latest = assessments[-1]
    score = 50
    if latest.pushups:
        score += min(30, latest.pushups // 2)
    if latest.squats:
        score += min(20, latest.squats // 3)
    if latest.plank_seconds:
        score += min(20, latest.plank_seconds // 30)
    return max(0, min(100, score))

def compute_cardio_score(assessments: list) -> int:
    if not assessments:
        return 50
    latest = assessments[-1]
    score = 50
    if latest.cardio_result:
        parts = latest.cardio_result.split(":")
        if len(parts) == 2:
            try:
                mins, secs = int(parts[0]), int(parts[1])
                total = mins * 60 + secs
                score += 30 if total < 240 else 20 if total < 300 else 10 if total < 360 else 0 if total < 420 else -10
            except:
                pass
    return max(0, min(100, score))

def compute_mobility_rating(assessments: list, physical: Optional[models.MemberPhysicalMetrics]) -> int:
    score = 50
    if physical and physical.mobility_score:
        score = physical.mobility_score * 10
    if assessments:
        latest = assessments[-1]
        if latest.mobility_score and "Excellent" in latest.mobility_score:
            score += 20
        elif latest.mobility_score and "Good" in latest.mobility_score:
            score += 10
        elif latest.mobility_score and "Poor" in latest.mobility_score:
            score -= 20
        if latest.balance_score == "Excellent":
            score += 10
        elif latest.balance_score == "Poor":
            score -= 10
    return max(0, min(100, score))

def compute_compliance_probability(motivation: Optional[models.MemberMotivationProfile], lifestyle: Optional[models.MemberLifestyleProfile]) -> int:
    prob = 70
    if motivation:
        if motivation.motivation_type in ["Accountability-driven", "Coaching-driven"]:
            prob += 15
        if motivation.gamification == "Yes":
            prob += 10
    if lifestyle:
        if lifestyle.stress_level == "High":
            prob -= 10
        if lifestyle.recovery_capacity == "Low":
            prob -= 10
    return max(0, min(100, prob))

def compute_fitness_age(member: models.Member, lifestyle: Optional[models.MemberLifestyleProfile]) -> int:
    base = member.age or 30
    if not lifestyle:
        return base
    adjustment = 0
    if lifestyle.stress_level == "High":
        adjustment += 5
    elif lifestyle.stress_level == "Low":
        adjustment -= 3
    if lifestyle.sleep_hours and lifestyle.sleep_hours < 6:
        adjustment += 4
    return base + adjustment

def compute_member_segment(member: models.Member, motivation: Optional[models.MemberMotivationProfile]) -> str:
    if member.fitness_level == "Beginner":
        return "Beginner"
    if member.fitness_level == "Athlete":
        return "Athlete"
    if motivation and motivation.motivation_type == "Self-motivated" and member.fitness_level in ["Intermediate", "Advanced"]:
        return "Busy Professional"
    if member.primary_goal == "Rehabilitation" or member.risk_level == "High":
        return "Rehabilitation"
    return "General Fitness"
