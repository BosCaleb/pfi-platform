from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text, ForeignKey, Sequence, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, timezone


def _utcnow() -> datetime:
    """Return current UTC time as a timezone-aware datetime.

    Used as a SQLAlchemy column default in place of the deprecated
    ``datetime.utcnow``.
    """
    return datetime.now(tz=timezone.utc)


def id_column(table_name: str):
    return Column(Integer, Sequence(f"{table_name}_id_seq"), primary_key=True, index=True)


class Admin(Base):
    __tablename__ = "admins"
    id = id_column(__tablename__)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    name = Column(String)
    created_at = Column(DateTime, default=_utcnow)

class Member(Base):
    __tablename__ = "members"
    id = id_column(__tablename__)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    date_of_birth = Column(Date)
    age = Column(Integer)
    gender = Column(String, nullable=True)
    emergency_contact_name = Column(String)
    emergency_contact_phone = Column(String)
    occupation = Column(String, nullable=True)
    location = Column(String, nullable=True)
    preferred_training_time = Column(String, nullable=True)
    status = Column(String, default="Active")
    registration_date = Column(DateTime, default=_utcnow)
    primary_goal = Column(String)
    fitness_level = Column(String)
    risk_level = Column(String, default="Low")
    # Consent fields — existing
    privacy_consent = Column(Boolean, default=False)              # data processing
    medical_disclaimer_accepted = Column(Boolean, default=False)  # exercise risk
    marketing_consent = Column(Boolean, default=False)            # optional marketing
    # Consent fields — extended registration pack
    consent_info_accuracy        = Column(Boolean, default=False)
    consent_no_medical_advice    = Column(Boolean, default=False)
    consent_nutrition_disclaimer = Column(Boolean, default=False)
    consent_medical_clearance    = Column(Boolean, default=False)
    consent_ai_recommendations   = Column(Boolean, default=False)
    consent_terms_accepted       = Column(Boolean, default=False)
    consent_signed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    physical_metrics = relationship("MemberPhysicalMetrics", back_populates="member", uselist=False, cascade="all, delete-orphan")
    health_profile = relationship("MemberHealthProfile", back_populates="member", uselist=False, cascade="all, delete-orphan")
    lifestyle_profile = relationship("MemberLifestyleProfile", back_populates="member", uselist=False, cascade="all, delete-orphan")
    goals = relationship("MemberGoals", back_populates="member", uselist=False, cascade="all, delete-orphan")
    motivation_profile = relationship("MemberMotivationProfile", back_populates="member", uselist=False, cascade="all, delete-orphan")
    assessments = relationship("Assessment", back_populates="member", cascade="all, delete-orphan")
    progress_entries = relationship("ProgressEntry", back_populates="member", cascade="all, delete-orphan")
    workout_plans = relationship("WorkoutPlan", back_populates="member", cascade="all, delete-orphan")
    nutrition_plans = relationship("NutritionPlan", back_populates="member", cascade="all, delete-orphan")
    supplement_plans = relationship("SupplementPlan", back_populates="member", cascade="all, delete-orphan")

    # Phase 2 — Workout Intelligence
    workout_group_assignments = relationship("MemberWorkoutGroupAssignment", back_populates="member", cascade="all, delete-orphan")
    workout_sessions          = relationship("WorkoutSession", back_populates="member", cascade="all, delete-orphan")
    reassessment_alerts       = relationship("ReassessmentAlert", back_populates="member", cascade="all, delete-orphan")

class MemberPhysicalMetrics(Base):
    __tablename__ = "member_physical_metrics"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id"), unique=True)
    height = Column(Float)
    weight = Column(Float)
    bmi = Column(Float)
    body_fat_percentage = Column(Float, nullable=True)
    waist_measurement = Column(Float, nullable=True)
    resting_heart_rate = Column(Integer, nullable=True)
    blood_pressure = Column(String, nullable=True)
    mobility_score = Column(Integer, nullable=True)
    fitness_level = Column(String)
    created_at = Column(DateTime, default=_utcnow)
    member = relationship("Member", back_populates="physical_metrics")

class MemberHealthProfile(Base):
    __tablename__ = "member_health_profiles"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id"), unique=True)
    injuries = Column(Text, nullable=True)
    pain_areas = Column(Text, nullable=True)
    previous_surgeries = Column(Text, nullable=True)
    chronic_conditions = Column(Text, nullable=True)
    medications = Column(Text, nullable=True)
    medical_clearance_required = Column(String, default="No")
    medical_clearance_received = Column(String, default="No")
    notes = Column(Text, nullable=True)
    risk_level = Column(String)
    member = relationship("Member", back_populates="health_profile")

class MemberLifestyleProfile(Base):
    __tablename__ = "member_lifestyle_profiles"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id"), unique=True)
    sleep_hours = Column(Float, nullable=True)
    stress_level = Column(String, nullable=True)
    activity_level = Column(String, nullable=True)
    work_schedule = Column(String, nullable=True)
    travel_frequency = Column(String, nullable=True)
    water_intake = Column(Float, nullable=True)
    nutrition_habits = Column(Text, nullable=True)
    smoking = Column(String, nullable=True)
    alcohol = Column(String, nullable=True)
    recovery_capacity = Column(String, nullable=True)
    member = relationship("Member", back_populates="lifestyle_profile")

class MemberGoals(Base):
    __tablename__ = "member_goals"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id"), unique=True)
    primary_goal = Column(String)
    secondary_goals = Column(String, nullable=True)
    fat_loss_pct = Column(Integer, default=0)
    strength_pct = Column(Integer, default=0)
    mobility_pct = Column(Integer, default=0)
    performance_pct = Column(Integer, default=0)
    target_weight = Column(Float, nullable=True)
    target_date = Column(Date, nullable=True)
    coach_notes = Column(Text, nullable=True)
    member = relationship("Member", back_populates="goals")

class MemberMotivationProfile(Base):
    __tablename__ = "member_motivation_profiles"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id"), unique=True)
    motivation_type = Column(String)
    coaching_style = Column(String)
    workout_preference = Column(String, nullable=True)
    training_frequency = Column(Integer, nullable=True)
    session_duration = Column(Integer, nullable=True)
    gamification = Column(String, default="No")
    notification_frequency = Column(String, nullable=True)
    member = relationship("Member", back_populates="motivation_profile")

class Assessment(Base):
    __tablename__ = "assessments"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id"))
    assessment_date = Column(Date)
    pushups = Column(Integer, nullable=True)
    squats = Column(Integer, nullable=True)
    plank_seconds = Column(Integer, nullable=True)
    cardio_test_type = Column(String, default="1km walk/run")
    cardio_result = Column(String, nullable=True)
    mobility_score = Column(String, nullable=True)
    balance_score = Column(String, nullable=True)
    strength_score = Column(String, nullable=True)
    cardio_score = Column(String, nullable=True)
    overall_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    member = relationship("Member", back_populates="assessments")

class ProgressEntry(Base):
    __tablename__ = "progress_entries"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id"))
    date = Column(Date)
    weight = Column(Float, nullable=True)
    waist_measurement = Column(Float, nullable=True)
    body_fat_percentage = Column(Float, nullable=True)
    progress_note = Column(Text, nullable=True)
    coach_note = Column(Text, nullable=True)
    adherence_score = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    member = relationship("Member", back_populates="progress_entries")

class WorkoutPlan(Base):
    __tablename__ = "workout_plans"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id"))
    plan_name = Column(String)
    goal_type = Column(String, nullable=True)
    weekly_frequency = Column(Integer, nullable=True)
    session_duration = Column(Integer, nullable=True)
    intensity_level = Column(String, nullable=True)
    equipment = Column(String, nullable=True)
    injury_considerations = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String, default="Draft")
    created_at = Column(DateTime, default=_utcnow)
    member = relationship("Member", back_populates="workout_plans")

class NutritionPlan(Base):
    __tablename__ = "nutrition_plans"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id"))
    nutrition_goal = Column(String, nullable=True)
    calories_target = Column(Integer, nullable=True)
    protein_target = Column(Integer, nullable=True)
    meal_preference = Column(Text, nullable=True)
    dietary_restrictions = Column(String, nullable=True)
    hydration_target = Column(Float, nullable=True)
    coach_notes = Column(Text, nullable=True)
    status = Column(String, default="Draft")
    created_at = Column(DateTime, default=_utcnow)
    member = relationship("Member", back_populates="nutrition_plans")

class SupplementPlan(Base):
    __tablename__ = "supplement_plans"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id"))
    supplement_name = Column(String)
    purpose = Column(String, nullable=True)
    suggested_timing = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    safety_notes = Column(Text, nullable=True)
    status = Column(String, default="Draft")
    created_at = Column(DateTime, default=_utcnow)
    member = relationship("Member", back_populates="supplement_plans")


# ══════════════════════════════════════════════════════════
#  PHASE 2 — Workout Intelligence Models
# ══════════════════════════════════════════════════════════

class WorkoutGroup(Base):
    __tablename__ = "workout_groups"
    id = id_column(__tablename__)
    group_name               = Column(String, nullable=False)
    description              = Column(Text, nullable=True)
    target_fitness_level     = Column(String, nullable=True)   # Beginner/Intermediate/Advanced/Athlete
    primary_goal             = Column(String, nullable=True)
    allowed_risk_level       = Column(String, default="Low")   # Low/Medium/High with caution
    default_weekly_frequency = Column(Integer, nullable=True)
    default_session_duration = Column(Integer, nullable=True)  # minutes
    default_intensity_range  = Column(String, nullable=True)   # Low/Moderate/High
    equipment_required       = Column(Text, nullable=True)
    injury_restrictions      = Column(Text, nullable=True)
    group_notes              = Column(Text, nullable=True)
    status                   = Column(String, default="Active") # Draft/Active/Archived
    created_at               = Column(DateTime, default=_utcnow)
    updated_at               = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    members          = relationship("MemberWorkoutGroupAssignment", back_populates="workout_group", cascade="all, delete-orphan")
    plan_assignments = relationship("WorkoutGroupPlanAssignment",   back_populates="workout_group", cascade="all, delete-orphan")


class ExerciseLibrary(Base):
    __tablename__ = "exercise_library"
    id = id_column(__tablename__)
    exercise_name               = Column(String, nullable=False)
    exercise_category           = Column(String)        # Warm-up/Mobility/Strength/Cardio/Core/Conditioning/Finisher/Cool-down/Recovery
    primary_muscle_group        = Column(String, nullable=True)
    secondary_muscle_groups     = Column(String, nullable=True)
    movement_type               = Column(String, nullable=True)
    equipment_needed            = Column(String, nullable=True)
    difficulty_level            = Column(String, nullable=True)   # Beginner/Intermediate/Advanced
    impact_level                = Column(String, nullable=True)   # Low/Medium/High
    default_sets                = Column(Integer, nullable=True)
    default_reps                = Column(Integer, nullable=True)
    default_duration_seconds    = Column(Integer, nullable=True)
    default_distance            = Column(String, nullable=True)
    default_rest_seconds        = Column(Integer, nullable=True)
    default_tempo               = Column(String, nullable=True)
    instructions                = Column(Text, nullable=True)
    coach_cues                  = Column(Text, nullable=True)
    common_mistakes             = Column(Text, nullable=True)
    video_url                   = Column(String, nullable=True)
    image_url                   = Column(String, nullable=True)
    safety_notes                = Column(Text, nullable=True)
    contraindications           = Column(Text, nullable=True)
    avoid_if_knee_injury        = Column(Boolean, default=False)
    avoid_if_shoulder_injury    = Column(Boolean, default=False)
    avoid_if_lower_back_pain    = Column(Boolean, default=False)
    avoid_if_high_blood_pressure= Column(Boolean, default=False)
    avoid_if_pregnant           = Column(Boolean, default=False)
    low_impact                  = Column(Boolean, default=False)
    beginner_friendly           = Column(Boolean, default=True)
    medical_clearance_recommended = Column(Boolean, default=False)
    track_reps                  = Column(Boolean, default=True)
    track_sets                  = Column(Boolean, default=True)
    track_weight                = Column(Boolean, default=False)
    track_time                  = Column(Boolean, default=False)
    track_distance              = Column(Boolean, default=False)
    track_rpe                   = Column(Boolean, default=True)
    track_heart_rate            = Column(Boolean, default=False)
    track_pain_score            = Column(Boolean, default=False)
    status                      = Column(String, default="Active")  # Active/Archived
    created_at                  = Column(DateTime, default=_utcnow)
    updated_at                  = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class WorkoutPlanTemplate(Base):
    __tablename__ = "workout_plan_templates"
    id = id_column(__tablename__)
    plan_name                  = Column(String, nullable=False)
    description                = Column(Text, nullable=True)
    target_goal                = Column(String, nullable=True)
    target_fitness_level       = Column(String, nullable=True)
    target_risk_level          = Column(String, nullable=True)
    default_frequency_per_week = Column(Integer, nullable=True)
    default_duration_minutes   = Column(Integer, nullable=True)
    status                     = Column(String, default="Draft")  # Draft/Active/Archived
    created_at                 = Column(DateTime, default=_utcnow)
    updated_at                 = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    versions          = relationship("WorkoutPlanVersion", back_populates="plan", cascade="all, delete-orphan")
    group_assignments = relationship("WorkoutGroupPlanAssignment", back_populates="plan")


class WorkoutPlanVersion(Base):
    __tablename__ = "workout_plan_versions"
    id              = id_column(__tablename__)
    workout_plan_id = Column(Integer, ForeignKey("workout_plan_templates.id"))
    version_number  = Column(Integer, default=1)
    version_notes   = Column(Text, nullable=True)
    is_active       = Column(Boolean, default=False)
    created_at      = Column(DateTime, default=_utcnow)
    published_at    = Column(DateTime, nullable=True)

    plan  = relationship("WorkoutPlanTemplate", back_populates="versions")
    weeks = relationship("WorkoutPlanWeek", back_populates="version", cascade="all, delete-orphan")


class WorkoutPlanWeek(Base):
    __tablename__ = "workout_plan_weeks"
    id              = id_column(__tablename__)
    plan_version_id = Column(Integer, ForeignKey("workout_plan_versions.id"))
    week_number     = Column(Integer)
    week_focus      = Column(String, nullable=True)
    notes           = Column(Text, nullable=True)

    version = relationship("WorkoutPlanVersion", back_populates="weeks")
    days    = relationship("WorkoutPlanDay", back_populates="week", cascade="all, delete-orphan")


class WorkoutPlanDay(Base):
    __tablename__ = "workout_plan_days"
    id                          = id_column(__tablename__)
    week_id                     = Column(Integer, ForeignKey("workout_plan_weeks.id"))
    day_number                  = Column(Integer)
    day_name                    = Column(String, nullable=True)
    day_focus                   = Column(String, nullable=True)
    estimated_duration_minutes  = Column(Integer, nullable=True)
    intensity_level             = Column(String, nullable=True)
    notes                       = Column(Text, nullable=True)

    week     = relationship("WorkoutPlanWeek", back_populates="days")
    sections = relationship("WorkoutSection", back_populates="day", cascade="all, delete-orphan")


class WorkoutSection(Base):
    __tablename__ = "workout_sections"
    id              = id_column(__tablename__)
    workout_day_id  = Column(Integer, ForeignKey("workout_plan_days.id"))
    section_name    = Column(String)
    section_type    = Column(String)   # Warm-up/Strength/Core/Cardio/Conditioning/Cool-down/…
    display_order   = Column(Integer, default=0)
    notes           = Column(Text, nullable=True)

    day       = relationship("WorkoutPlanDay", back_populates="sections")
    exercises = relationship("WorkoutPlanExercise", back_populates="section", cascade="all, delete-orphan")


class WorkoutPlanExercise(Base):
    __tablename__ = "workout_plan_exercises"
    id                          = id_column(__tablename__)
    workout_section_id          = Column(Integer, ForeignKey("workout_sections.id"))
    exercise_id                 = Column(Integer, ForeignKey("exercise_library.id"))
    display_order               = Column(Integer, default=0)
    prescribed_sets             = Column(Integer, nullable=True)
    prescribed_reps             = Column(String, nullable=True)    # allows "10-12"
    prescribed_weight           = Column(String, nullable=True)
    prescribed_duration_seconds = Column(Integer, nullable=True)
    prescribed_distance         = Column(String, nullable=True)
    prescribed_rest_seconds     = Column(Integer, nullable=True)
    prescribed_tempo            = Column(String, nullable=True)
    prescribed_rpe              = Column(String, nullable=True)
    coach_notes                 = Column(Text, nullable=True)
    is_optional                 = Column(Boolean, default=False)
    substitution_allowed        = Column(Boolean, default=True)

    section  = relationship("WorkoutSection", back_populates="exercises")
    exercise = relationship("ExerciseLibrary")


class WorkoutGroupPlanAssignment(Base):
    """Tracks which plan (and version) is assigned to a group — keeps history."""
    __tablename__ = "workout_group_plan_assignments"
    id               = id_column(__tablename__)
    workout_group_id = Column(Integer, ForeignKey("workout_groups.id"))
    workout_plan_id  = Column(Integer, ForeignKey("workout_plan_templates.id"))
    plan_version_id  = Column(Integer, ForeignKey("workout_plan_versions.id"), nullable=True)
    is_active        = Column(Boolean, default=True)
    assigned_at      = Column(DateTime, default=_utcnow)

    workout_group = relationship("WorkoutGroup", back_populates="plan_assignments")
    plan          = relationship("WorkoutPlanTemplate", back_populates="group_assignments")
    version       = relationship("WorkoutPlanVersion")


class MemberWorkoutGroupAssignment(Base):
    """Member ↔ WorkoutGroup assignment with history tracking."""
    __tablename__ = "member_workout_group_assignments"
    id                   = id_column(__tablename__)
    member_id            = Column(Integer, ForeignKey("members.id"))
    workout_group_id     = Column(Integer, ForeignKey("workout_groups.id"))
    assigned_by_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    assignment_reason    = Column(Text, nullable=True)
    recommendation_score = Column(Integer, nullable=True)
    is_system_recommended= Column(Boolean, default=False)
    start_date           = Column(Date, nullable=True)
    end_date             = Column(Date, nullable=True)
    status               = Column(String, default="Active")  # Active/Completed/Moved/Archived
    notes                = Column(Text, nullable=True)
    created_at           = Column(DateTime, default=_utcnow)

    member        = relationship("Member", back_populates="workout_group_assignments")
    workout_group = relationship("WorkoutGroup", back_populates="members")


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"
    id                       = id_column(__tablename__)
    member_id                = Column(Integer, ForeignKey("members.id"))
    workout_group_id         = Column(Integer, ForeignKey("workout_groups.id"), nullable=True)
    workout_plan_id          = Column(Integer, ForeignKey("workout_plan_templates.id"), nullable=True)
    workout_plan_version_id  = Column(Integer, ForeignKey("workout_plan_versions.id"), nullable=True)
    workout_day_id           = Column(Integer, ForeignKey("workout_plan_days.id"), nullable=True)
    session_date             = Column(Date)
    started_at               = Column(DateTime, nullable=True)
    completed_at             = Column(DateTime, nullable=True)
    completion_status        = Column(String, default="Not Started")  # Not Started/In Progress/Completed/Partially Completed/Skipped
    total_exercises          = Column(Integer, default=0)
    exercises_completed      = Column(Integer, default=0)
    completion_percentage    = Column(Float, default=0.0)
    overall_rpe              = Column(Integer, nullable=True)
    energy_level             = Column(String, nullable=True)     # Low/Medium/High
    pain_flag                = Column(Boolean, default=False)
    highest_pain_score       = Column(Integer, nullable=True)
    coach_feedback           = Column(Text, nullable=True)
    member_notes             = Column(Text, nullable=True)
    created_at               = Column(DateTime, default=_utcnow)
    updated_at               = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    member    = relationship("Member", back_populates="workout_sessions")
    exercises = relationship("WorkoutSessionExercise", back_populates="session", cascade="all, delete-orphan")


class WorkoutSessionExercise(Base):
    __tablename__ = "workout_session_exercises"
    id                          = id_column(__tablename__)
    workout_session_id          = Column(Integer, ForeignKey("workout_sessions.id"))
    planned_exercise_id         = Column(Integer, ForeignKey("workout_plan_exercises.id"), nullable=True)
    actual_exercise_id          = Column(Integer, ForeignKey("exercise_library.id"), nullable=True)
    exercise_name_snapshot      = Column(String)   # immutable historical record
    prescribed_sets             = Column(Integer, nullable=True)
    prescribed_reps             = Column(String, nullable=True)
    prescribed_weight           = Column(String, nullable=True)
    prescribed_duration_seconds = Column(Integer, nullable=True)
    prescribed_distance         = Column(String, nullable=True)
    prescribed_rest_seconds     = Column(Integer, nullable=True)
    actual_sets_completed       = Column(Integer, nullable=True)
    actual_reps_completed       = Column(String, nullable=True)
    actual_weight_used          = Column(Float, nullable=True)
    actual_duration_seconds     = Column(Integer, nullable=True)
    actual_distance             = Column(String, nullable=True)
    actual_rpe                  = Column(Integer, nullable=True)
    pain_score                  = Column(Integer, nullable=True)
    completed                   = Column(Boolean, default=False)
    skipped                     = Column(Boolean, default=False)
    substituted                 = Column(Boolean, default=False)
    substitution_reason         = Column(String, nullable=True)
    member_notes                = Column(Text, nullable=True)
    coach_notes                 = Column(Text, nullable=True)

    session = relationship("WorkoutSession", back_populates="exercises")


class ExerciseSubstitution(Base):
    __tablename__ = "exercise_substitutions"
    id                    = id_column(__tablename__)
    workout_session_id    = Column(Integer, ForeignKey("workout_sessions.id"), nullable=True)
    member_id             = Column(Integer, ForeignKey("members.id"))
    original_exercise_id  = Column(Integer, ForeignKey("exercise_library.id"))
    substitute_exercise_id= Column(Integer, ForeignKey("exercise_library.id"))
    reason                = Column(String)  # Injury/Pain/Equipment unavailable/Too difficult/Too easy/Coach preference/Member preference
    notes                 = Column(Text, nullable=True)
    created_at            = Column(DateTime, default=_utcnow)


class SafetyOverride(Base):
    __tablename__ = "safety_overrides"
    id             = id_column(__tablename__)
    member_id      = Column(Integer, ForeignKey("members.id"))
    exercise_id    = Column(Integer, ForeignKey("exercise_library.id"), nullable=True)
    admin_id       = Column(Integer, ForeignKey("admins.id"), nullable=True)
    warning_type   = Column(String)
    override_reason= Column(Text)
    created_at     = Column(DateTime, default=_utcnow)


class ReassessmentAlert(Base):
    __tablename__ = "reassessment_alerts"
    id                    = id_column(__tablename__)
    member_id             = Column(Integer, ForeignKey("members.id"))
    trigger_type          = Column(String)   # High adherence/Low adherence/Pain flag/High RPE/Plan completed/Assessment overdue
    trigger_message       = Column(Text)
    severity              = Column(String, default="Low")    # Low/Medium/High
    status                = Column(String, default="Open")   # Open/Reviewed/Closed
    created_at            = Column(DateTime, default=_utcnow)
    reviewed_at           = Column(DateTime, nullable=True)
    reviewed_by_admin_id  = Column(Integer, ForeignKey("admins.id"), nullable=True)

    member = relationship("Member", back_populates="reassessment_alerts")


# ══════════════════════════════════════════════════════════
#  PHASE 3.1 — Check-Ins and Coaching Intelligence
# ══════════════════════════════════════════════════════════

class MemberCheckIn(Base):
    __tablename__ = "member_check_ins"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    check_in_date = Column(Date, nullable=False)
    check_in_type = Column(String, default="Daily")
    energy_level = Column(String)           # Very Low/Low/Moderate/High/Very High
    sleep_hours = Column(Float)
    sleep_quality = Column(String)          # Poor/Fair/Good/Excellent
    stress_level = Column(String)           # Low/Medium/High/Very High
    muscle_soreness = Column(String)        # None/Mild/Moderate/Severe
    pain_level = Column(Integer)            # 0-10
    pain_location = Column(String)
    mood = Column(String)                   # Poor/Okay/Good/Great
    motivation_level = Column(String)       # Low/Medium/High
    hydration_status = Column(String)       # Poor/Moderate/Good
    nutrition_adherence = Column(String)    # Poor/Moderate/Good/Excellent
    supplement_adherence = Column(String)   # Not Applicable/Missed/Partial/Complete
    workout_readiness = Column(String)      # Not Ready/Light Session Only/Ready/Ready to Push
    new_injury_reported = Column(String, default="No")
    injury_notes = Column(Text)
    member_notes = Column(Text)
    submitted_by = Column(String, default="Admin")  # Member/Admin
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

class WeeklyMemberCheckIn(Base):
    __tablename__ = "weekly_member_check_ins"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    week_start_date = Column(Date, nullable=False)
    week_end_date = Column(Date, nullable=False)
    check_in_type = Column(String, default="Weekly")
    average_energy = Column(String)
    average_sleep_hours = Column(Float)
    average_stress = Column(String)
    average_soreness = Column(String)
    average_pain = Column(Float)
    weight_update = Column(Float)
    waist_update = Column(Float)
    progress_photo_url = Column(String)
    perceived_progress = Column(String)     # Going Backwards/No Change/Slight Progress/Good Progress/Excellent Progress
    workout_adherence_self_rating = Column(String)
    nutrition_adherence_self_rating = Column(String)
    supplement_adherence_self_rating = Column(String)
    biggest_win_this_week = Column(Text)
    biggest_challenge_this_week = Column(Text)
    coach_support_needed = Column(String, default="No")
    member_notes = Column(Text)
    submitted_by = Column(String, default="Admin")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

class ReadinessScore(Base):
    __tablename__ = "readiness_scores"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    check_in_id = Column(Integer, ForeignKey("member_check_ins.id", ondelete="SET NULL"), nullable=True)
    score = Column(Float, nullable=False)
    category = Column(String, nullable=False)  # Green/Yellow/Orange/Red
    recommendation_summary = Column(Text)
    score_breakdown_json = Column(Text)         # JSON string
    created_at = Column(DateTime, default=_utcnow)

class RecoveryScore(Base):
    __tablename__ = "recovery_scores"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    check_in_id = Column(Integer, ForeignKey("member_check_ins.id", ondelete="SET NULL"), nullable=True)
    score = Column(Float, nullable=False)
    category = Column(String, nullable=False)   # Excellent Recovery/Good Recovery/Moderate Recovery/Poor Recovery/Recovery Risk
    score_breakdown_json = Column(Text)
    created_at = Column(DateTime, default=_utcnow)

class MemberAdherenceSummary(Base):
    __tablename__ = "member_adherence_summaries"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    workout_adherence_percentage = Column(Float, default=0.0)
    exercise_completion_percentage = Column(Float, default=0.0)
    nutrition_adherence_rating = Column(String)
    supplement_adherence_rating = Column(String)
    check_in_adherence_percentage = Column(Float, default=0.0)
    adherence_category = Column(String)     # Excellent/Good/Moderate/Low/At Risk
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

class PainRiskFlag(Base):
    __tablename__ = "pain_risk_flags"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    source_type = Column(String)    # Check-In/Workout Session/Exercise Log/Admin Note
    source_id = Column(Integer)
    pain_score = Column(Integer)
    pain_location = Column(String)
    risk_level = Column(String)     # Low/Medium/High/Critical
    flag_message = Column(Text)
    recommended_action = Column(Text)
    status = Column(String, default="Open")     # Open/Reviewed/Closed
    created_at = Column(DateTime, default=_utcnow)
    reviewed_at = Column(DateTime)
    reviewed_by_admin_id = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)

class CoachTask(Base):
    __tablename__ = "coach_tasks"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    related_group_id = Column(Integer, ForeignKey("workout_groups.id", ondelete="SET NULL"), nullable=True)
    related_alert_id = Column(Integer, nullable=True)
    task_type = Column(String)      # Pain Review/Readiness Review/Low Adherence/Reassessment/Nutrition Review/Supplement Review/Injury Review/Coach Follow-Up/General
    title = Column(String, nullable=False)
    description = Column(Text)
    priority = Column(String, default="Medium")     # Low/Medium/High/Urgent
    status = Column(String, default="Open")         # Open/In Progress/Completed/Dismissed
    due_date = Column(Date)
    assigned_to_admin_id = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    created_by_system = Column(Boolean, default=False)
    coach_note = Column(Text)
    dismiss_reason = Column(Text)
    created_at = Column(DateTime, default=_utcnow)
    completed_at = Column(DateTime)

class NutritionAdherenceLog(Base):
    __tablename__ = "nutrition_adherence_logs"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    nutrition_adherence_rating = Column(String)
    hunger_level = Column(String)       # Low/Moderate/High/Very High
    cravings_level = Column(String)     # None/Low/Moderate/High
    water_intake = Column(Float)
    notes = Column(Text)
    created_at = Column(DateTime, default=_utcnow)

class SupplementAdherenceLog(Base):
    __tablename__ = "supplement_adherence_logs"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    supplement_plan_id = Column(Integer, ForeignKey("supplement_plans.id", ondelete="SET NULL"), nullable=True)
    adherence_status = Column(String)   # Complete/Partial/Missed/Not Applicable
    side_effects_reported = Column(Boolean, default=False)
    side_effect_notes = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime, default=_utcnow)

class CheckInAlertEvent(Base):
    __tablename__ = "check_in_alert_events"
    id = id_column(__tablename__)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_type = Column(String)     # Pain/Readiness/Adherence/Recovery/Nutrition/Supplement
    severity = Column(String)       # Info/Warning/High/Critical
    message = Column(Text)
    source_check_in_id = Column(Integer)
    coach_task_id = Column(Integer, ForeignKey("coach_tasks.id", ondelete="SET NULL"), nullable=True)
    pain_flag_id = Column(Integer, ForeignKey("pain_risk_flags.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=_utcnow)
