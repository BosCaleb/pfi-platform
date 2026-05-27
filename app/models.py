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
    privacy_consent = Column(Boolean, default=False)
    medical_disclaimer_accepted = Column(Boolean, default=False)
    marketing_consent = Column(Boolean, default=False)
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
