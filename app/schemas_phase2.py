"""Pydantic schemas for Phase 2 — Workout Intelligence."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


# ── Workout Groups ──────────────────────────────────────────────────────

class WorkoutGroupCreate(BaseModel):
    group_name:               str
    description:              Optional[str] = None
    target_fitness_level:     Optional[str] = None
    primary_goal:             Optional[str] = None
    allowed_risk_level:       str = "Low"
    default_weekly_frequency: Optional[int] = None
    default_session_duration: Optional[int] = None
    default_intensity_range:  Optional[str] = None
    equipment_required:       Optional[str] = None
    injury_restrictions:      Optional[str] = None
    group_notes:              Optional[str] = None
    status:                   str = "Active"

class WorkoutGroupUpdate(WorkoutGroupCreate):
    pass

class WorkoutGroupOut(BaseModel):
    id:                       int
    group_name:               str
    description:              Optional[str] = None
    target_fitness_level:     Optional[str] = None
    primary_goal:             Optional[str] = None
    allowed_risk_level:       Optional[str] = None
    default_weekly_frequency: Optional[int] = None
    default_session_duration: Optional[int] = None
    default_intensity_range:  Optional[str] = None
    equipment_required:       Optional[str] = None
    injury_restrictions:      Optional[str] = None
    group_notes:              Optional[str] = None
    status:                   str
    created_at:               Optional[datetime] = None
    member_count:             Optional[int] = None
    class Config: from_attributes = True


# ── Exercise Library ────────────────────────────────────────────────────

class ExerciseCreate(BaseModel):
    exercise_name:                str
    exercise_category:            Optional[str] = None
    primary_muscle_group:         Optional[str] = None
    secondary_muscle_groups:      Optional[str] = None
    movement_type:                Optional[str] = None
    equipment_needed:             Optional[str] = None
    difficulty_level:             Optional[str] = None
    impact_level:                 Optional[str] = None
    default_sets:                 Optional[int] = None
    default_reps:                 Optional[int] = None
    default_duration_seconds:     Optional[int] = None
    default_distance:             Optional[str] = None
    default_rest_seconds:         Optional[int] = None
    default_tempo:                Optional[str] = None
    instructions:                 Optional[str] = None
    coach_cues:                   Optional[str] = None
    common_mistakes:              Optional[str] = None
    safety_notes:                 Optional[str] = None
    contraindications:            Optional[str] = None
    avoid_if_knee_injury:         bool = False
    avoid_if_shoulder_injury:     bool = False
    avoid_if_lower_back_pain:     bool = False
    avoid_if_high_blood_pressure: bool = False
    avoid_if_pregnant:            bool = False
    low_impact:                   bool = False
    beginner_friendly:            bool = True
    medical_clearance_recommended:bool = False
    track_reps:                   bool = True
    track_sets:                   bool = True
    track_weight:                 bool = False
    track_time:                   bool = False
    track_distance:               bool = False
    track_rpe:                    bool = True
    track_heart_rate:             bool = False
    track_pain_score:             bool = False
    status:                       str = "Active"

class ExerciseUpdate(ExerciseCreate):
    pass

class ExerciseOut(ExerciseCreate):
    id:         int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True


# ── Workout Plan Builder ────────────────────────────────────────────────

class PlanTemplateCreate(BaseModel):
    plan_name:                  str
    description:                Optional[str] = None
    target_goal:                Optional[str] = None
    target_fitness_level:       Optional[str] = None
    target_risk_level:          Optional[str] = None
    default_frequency_per_week: Optional[int] = None
    default_duration_minutes:   Optional[int] = None
    status:                     str = "Draft"

class PlanTemplateOut(PlanTemplateCreate):
    id:         int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class PlanVersionCreate(BaseModel):
    version_notes: Optional[str] = None

class PlanVersionOut(BaseModel):
    id:             int
    workout_plan_id:int
    version_number: int
    version_notes:  Optional[str] = None
    is_active:      bool
    created_at:     Optional[datetime] = None
    published_at:   Optional[datetime] = None
    class Config: from_attributes = True

class WeekCreate(BaseModel):
    week_number: int
    week_focus:  Optional[str] = None
    notes:       Optional[str] = None

class WeekOut(WeekCreate):
    id:              int
    plan_version_id: int
    class Config: from_attributes = True

class DayCreate(BaseModel):
    day_number:                 int
    day_name:                   Optional[str] = None
    day_focus:                  Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    intensity_level:            Optional[str] = None
    notes:                      Optional[str] = None

class DayOut(DayCreate):
    id:      int
    week_id: int
    class Config: from_attributes = True

class SectionCreate(BaseModel):
    section_name:  str
    section_type:  str
    display_order: int = 0
    notes:         Optional[str] = None

class SectionOut(SectionCreate):
    id:             int
    workout_day_id: int
    class Config: from_attributes = True

class PlanExerciseCreate(BaseModel):
    exercise_id:                int
    display_order:              int = 0
    prescribed_sets:            Optional[int] = None
    prescribed_reps:            Optional[str] = None
    prescribed_weight:          Optional[str] = None
    prescribed_duration_seconds:Optional[int] = None
    prescribed_distance:        Optional[str] = None
    prescribed_rest_seconds:    Optional[int] = None
    prescribed_tempo:           Optional[str] = None
    prescribed_rpe:             Optional[str] = None
    coach_notes:                Optional[str] = None
    is_optional:                bool = False
    substitution_allowed:       bool = True

class PlanExerciseOut(PlanExerciseCreate):
    id:                 int
    workout_section_id: int
    exercise_name:      Optional[str] = None   # denormalized for convenience
    class Config: from_attributes = True


# ── Group Plan Assignment ───────────────────────────────────────────────

class GroupPlanAssignCreate(BaseModel):
    workout_plan_id: int
    plan_version_id: Optional[int] = None


# ── Member Group Assignment ─────────────────────────────────────────────

class MemberGroupAssignCreate(BaseModel):
    member_id:            int
    workout_group_id:     int
    assignment_reason:    Optional[str] = None
    recommendation_score: Optional[int] = None
    is_system_recommended:bool = False
    start_date:           Optional[date] = None
    notes:                Optional[str] = None

class MemberGroupAssignOut(BaseModel):
    id:                   int
    member_id:            int
    workout_group_id:     int
    assignment_reason:    Optional[str] = None
    recommendation_score: Optional[int] = None
    is_system_recommended:bool
    start_date:           Optional[date] = None
    end_date:             Optional[date] = None
    status:               str
    notes:                Optional[str] = None
    created_at:           Optional[datetime] = None
    group_name:           Optional[str] = None
    class Config: from_attributes = True

class RecommendationOut(BaseModel):
    group_id:   int
    group_name: str
    score:      int
    reason:     str


# ── Workout Sessions ────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    member_id:               int
    session_date:            date
    workout_group_id:        Optional[int] = None
    workout_plan_id:         Optional[int] = None
    workout_plan_version_id: Optional[int] = None
    workout_day_id:          Optional[int] = None
    member_notes:            Optional[str] = None

class SessionUpdate(BaseModel):
    completion_status:     Optional[str] = None
    overall_rpe:           Optional[int] = None
    energy_level:          Optional[str] = None
    exercises_completed:   Optional[int] = None
    total_exercises:       Optional[int] = None
    pain_flag:             Optional[bool] = None
    highest_pain_score:    Optional[int] = None
    coach_feedback:        Optional[str] = None
    member_notes:          Optional[str] = None

class SessionOut(BaseModel):
    id:                      int
    member_id:               int
    session_date:            date
    workout_group_id:        Optional[int] = None
    workout_plan_id:         Optional[int] = None
    workout_plan_version_id: Optional[int] = None
    workout_day_id:          Optional[int] = None
    completion_status:       str
    total_exercises:         int
    exercises_completed:     int
    completion_percentage:   float
    overall_rpe:             Optional[int] = None
    energy_level:            Optional[str] = None
    pain_flag:               bool
    highest_pain_score:      Optional[int] = None
    coach_feedback:          Optional[str] = None
    member_notes:            Optional[str] = None
    started_at:              Optional[datetime] = None
    completed_at:            Optional[datetime] = None
    created_at:              Optional[datetime] = None
    class Config: from_attributes = True

class SessionExerciseCreate(BaseModel):
    planned_exercise_id:        Optional[int] = None
    actual_exercise_id:         Optional[int] = None
    exercise_name_snapshot:     str
    prescribed_sets:            Optional[int] = None
    prescribed_reps:            Optional[str] = None
    prescribed_weight:          Optional[str] = None
    prescribed_duration_seconds:Optional[int] = None
    prescribed_distance:        Optional[str] = None
    prescribed_rest_seconds:    Optional[int] = None
    actual_sets_completed:      Optional[int] = None
    actual_reps_completed:      Optional[str] = None
    actual_weight_used:         Optional[float] = None
    actual_duration_seconds:    Optional[int] = None
    actual_distance:            Optional[str] = None
    actual_rpe:                 Optional[int] = None
    pain_score:                 Optional[int] = None
    completed:                  bool = False
    skipped:                    bool = False
    substituted:                bool = False
    substitution_reason:        Optional[str] = None
    member_notes:               Optional[str] = None
    coach_notes:                Optional[str] = None

class SessionExerciseOut(SessionExerciseCreate):
    id:                 int
    workout_session_id: int
    class Config: from_attributes = True


# ── Reassessment Alerts ─────────────────────────────────────────────────

class AlertOut(BaseModel):
    id:              int
    member_id:       int
    trigger_type:    str
    trigger_message: str
    severity:        str
    status:          str
    created_at:      Optional[datetime] = None
    reviewed_at:     Optional[datetime] = None
    member_name:     Optional[str] = None
    class Config: from_attributes = True


# ── Safety ──────────────────────────────────────────────────────────────

class SafetyCheckRequest(BaseModel):
    member_id:    int
    exercise_ids: List[int]

class SafetyWarning(BaseModel):
    exercise_id:   int
    exercise_name: str
    warning_type:  str
    message:       str
    severity:      str  # info/warning/critical

class SafetyCheckResponse(BaseModel):
    member_id: int
    warnings:  List[SafetyWarning]

class SafetyOverrideCreate(BaseModel):
    member_id:       int
    exercise_id:     Optional[int] = None
    warning_type:    str
    override_reason: str
