"""
Unit tests for app/computed.py — pure business logic, no I/O.

All functions are tested in isolation using simple mock objects so
these tests run without a database connection.
"""

import pytest
from datetime import date
from unittest.mock import MagicMock

from app.computed import (
    calculate_age,
    calculate_bmi,
    compute_cardio_score,
    compute_compliance_probability,
    compute_fitness_age,
    compute_injury_risk,
    compute_member_segment,
    compute_mobility_rating,
    compute_recovery_score,
    compute_strength_index,
)


# ================================================================== #
# calculate_age                                                        #
# ================================================================== #


class TestCalculateAge:
    def test_returns_zero_for_none(self):
        assert calculate_age(None) == 0

    def test_correct_age_before_birthday_this_year(self):
        today = date.today()
        dob = date(today.year - 25, today.month, today.day + 1) if today.day < 28 else date(today.year - 25, today.month - 1, 1)
        assert calculate_age(dob) == 24

    def test_correct_age_on_birthday(self):
        today = date.today()
        dob = date(today.year - 30, today.month, today.day)
        assert calculate_age(dob) == 30


# ================================================================== #
# calculate_bmi                                                        #
# ================================================================== #


class TestCalculateBMI:
    def test_standard_value(self):
        # 70 kg / (1.75 m)^2 = 22.9
        assert calculate_bmi(175, 70) == 22.9

    def test_returns_zero_for_missing_height(self):
        assert calculate_bmi(0, 70) == 0.0

    def test_returns_zero_for_missing_weight(self):
        assert calculate_bmi(175, 0) == 0.0

    def test_obese_range(self):
        bmi = calculate_bmi(170, 120)
        assert bmi > 30

    def test_underweight_range(self):
        bmi = calculate_bmi(180, 50)
        assert bmi < 18.5


# ================================================================== #
# compute_recovery_score                                               #
# ================================================================== #


class TestComputeRecoveryScore:
    def _lifestyle(self, **kwargs):
        m = MagicMock()
        m.sleep_hours = kwargs.get("sleep_hours", None)
        m.stress_level = kwargs.get("stress_level", None)
        m.activity_level = kwargs.get("activity_level", None)
        m.recovery_capacity = kwargs.get("recovery_capacity", None)
        return m

    def test_returns_50_for_none(self):
        assert compute_recovery_score(None) == 50

    def test_excellent_lifestyle_near_max(self):
        ls = self._lifestyle(sleep_hours=9, stress_level="Low", activity_level="Very Active", recovery_capacity="High")
        score = compute_recovery_score(ls)
        assert score >= 90

    def test_poor_lifestyle_near_min(self):
        ls = self._lifestyle(sleep_hours=4, stress_level="High", activity_level="Sedentary", recovery_capacity="Low")
        score = compute_recovery_score(ls)
        assert score <= 30

    def test_score_clamped_to_0_100(self):
        ls = self._lifestyle(sleep_hours=1, stress_level="High", activity_level="Sedentary", recovery_capacity="Low")
        score = compute_recovery_score(ls)
        assert 0 <= score <= 100


# ================================================================== #
# compute_injury_risk                                                  #
# ================================================================== #


class TestComputeInjuryRisk:
    def _health(self, **kwargs):
        m = MagicMock()
        m.injuries = kwargs.get("injuries", "")
        m.pain_areas = kwargs.get("pain_areas", "")
        m.chronic_conditions = kwargs.get("chronic_conditions", "")
        m.medical_clearance_required = kwargs.get("medical_clearance_required", "No")
        m.medical_clearance_received = kwargs.get("medical_clearance_received", "No")
        return m

    def test_returns_20_for_none(self):
        assert compute_injury_risk(None) == 20

    def test_no_issues_stays_at_20(self):
        h = self._health()
        assert compute_injury_risk(h) == 20

    def test_all_risk_factors_present(self):
        h = self._health(
            injuries="ACL",
            pain_areas="knee",
            chronic_conditions="diabetes",
            medical_clearance_required="Yes",
            medical_clearance_received="No",
        )
        assert compute_injury_risk(h) == 100  # 20+25+15+20+20 = 100

    def test_clamped_to_100(self):
        h = self._health(
            injuries="multiple",
            pain_areas="everywhere",
            chronic_conditions="several",
            medical_clearance_required="Yes",
            medical_clearance_received="No",
        )
        assert compute_injury_risk(h) <= 100


# ================================================================== #
# compute_strength_index                                               #
# ================================================================== #


class TestComputeStrengthIndex:
    def _assessment(self, pushups=None, squats=None, plank_seconds=None):
        m = MagicMock()
        m.pushups = pushups
        m.squats = squats
        m.plank_seconds = plank_seconds
        return m

    def test_returns_50_for_empty_list(self):
        assert compute_strength_index([]) == 50

    def test_strong_athlete_near_max(self):
        a = self._assessment(pushups=80, squats=80, plank_seconds=180)
        score = compute_strength_index([a])
        assert score >= 90

    def test_uses_latest_assessment(self):
        old = self._assessment(pushups=5, squats=5, plank_seconds=30)
        new = self._assessment(pushups=60, squats=60, plank_seconds=120)
        score = compute_strength_index([old, new])
        assert score > 70

    def test_clamped_to_100(self):
        a = self._assessment(pushups=1000, squats=1000, plank_seconds=10000)
        assert compute_strength_index([a]) == 100


# ================================================================== #
# compute_cardio_score                                                 #
# ================================================================== #


class TestComputeCardioScore:
    def _assessment(self, cardio_result=None):
        m = MagicMock()
        m.cardio_result = cardio_result
        return m

    def test_returns_50_for_empty(self):
        assert compute_cardio_score([]) == 50

    def test_fast_time_gives_high_score(self):
        a = self._assessment(cardio_result="3:50")  # 230 seconds < 240
        assert compute_cardio_score([a]) == 80

    def test_slow_time_penalised(self):
        a = self._assessment(cardio_result="7:30")  # 450 seconds > 420
        assert compute_cardio_score([a]) == 40

    def test_invalid_format_does_not_crash(self):
        a = self._assessment(cardio_result="not_a_time")
        score = compute_cardio_score([a])
        assert 0 <= score <= 100


# ================================================================== #
# compute_compliance_probability                                       #
# ================================================================== #


class TestComputeComplianceProbability:
    def test_defaults_to_70_with_no_data(self):
        assert compute_compliance_probability(None, None) == 70

    def test_accountability_driven_boosts_score(self):
        m = MagicMock()
        m.motivation_type = "Accountability-driven"
        m.gamification = "Yes"
        score = compute_compliance_probability(m, None)
        assert score == 95  # 70 + 15 + 10

    def test_high_stress_reduces_score(self):
        ls = MagicMock()
        ls.stress_level = "High"
        ls.recovery_capacity = "Low"
        score = compute_compliance_probability(None, ls)
        assert score == 50  # 70 - 10 - 10


# ================================================================== #
# compute_member_segment                                               #
# ================================================================== #


class TestComputeMemberSegment:
    def _member(self, fitness_level="Intermediate", primary_goal="Fat Loss", risk_level="Low"):
        m = MagicMock()
        m.fitness_level = fitness_level
        m.primary_goal = primary_goal
        m.risk_level = risk_level
        return m

    def test_beginner_segment(self):
        assert compute_member_segment(self._member("Beginner"), None) == "Beginner"

    def test_athlete_segment(self):
        assert compute_member_segment(self._member("Athlete"), None) == "Athlete"

    def test_rehabilitation_by_goal(self):
        m = self._member(primary_goal="Rehabilitation")
        assert compute_member_segment(m, None) == "Rehabilitation"

    def test_rehabilitation_by_risk(self):
        m = self._member(risk_level="High")
        assert compute_member_segment(m, None) == "Rehabilitation"

    def test_self_motivated_intermediate_is_busy_professional(self):
        m = self._member("Intermediate")
        mot = MagicMock()
        mot.motivation_type = "Self-motivated"
        assert compute_member_segment(m, mot) == "Busy Professional"

    def test_general_fitness_fallback(self):
        m = self._member("Intermediate")
        mot = MagicMock()
        mot.motivation_type = "Coaching-driven"
        assert compute_member_segment(m, mot) == "General Fitness"
