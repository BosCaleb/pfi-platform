from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime

class LoginRequest(BaseModel):
    email: str
    password: str

class PersonalInfo(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date
    gender: Optional[str] = None
    phone: str
    email: EmailStr
    emergency_contact_name: str
    emergency_contact_phone: str
    occupation: Optional[str] = None
    location: Optional[str] = None
    preferred_training_time: Optional[str] = None
    status: str = "Active"

class PhysicalMetrics(BaseModel):
    height: float
    weight: float
    body_fat_percentage: Optional[float] = None
    waist_measurement: Optional[float] = None
    resting_heart_rate: Optional[int] = None
    blood_pressure: Optional[str] = None
    mobility_score: Optional[int] = None
    fitness_level: str

class HealthProfile(BaseModel):
    injuries: Optional[str] = None
    pain_areas: Optional[str] = None
    previous_surgeries: Optional[str] = None
    chronic_conditions: Optional[str] = None
    medications: Optional[str] = None
    medical_clearance_required: str = "No"
    medical_clearance_received: str = "No"
    notes: Optional[str] = None
    risk_level: str = "Low"

class LifestyleProfile(BaseModel):
    sleep_hours: Optional[float] = None
    stress_level: Optional[str] = None
    activity_level: Optional[str] = None
    work_schedule: Optional[str] = None
    travel_frequency: Optional[str] = None
    water_intake: Optional[float] = None
    nutrition_habits: Optional[str] = None
    smoking: Optional[str] = None
    alcohol: Optional[str] = None
    recovery_capacity: Optional[str] = None

class GoalProfile(BaseModel):
    primary_goal: str
    secondary_goals: Optional[List[str]] = None
    fat_loss_pct: int = 0
    strength_pct: int = 0
    mobility_pct: int = 0
    performance_pct: int = 0
    target_weight: Optional[float] = None
    target_date: Optional[date] = None
    coach_notes: Optional[str] = None

class BehaviorProfile(BaseModel):
    motivation_type: str
    coaching_style: str
    workout_preference: Optional[str] = None
    training_frequency: Optional[int] = None
    session_duration: Optional[int] = None
    gamification: str = "No"
    notification_frequency: Optional[str] = None

class BaselineAssessment(BaseModel):
    pushups: Optional[int] = None
    squats: Optional[int] = None
    plank_seconds: Optional[int] = None
    cardio_result: Optional[str] = None
    heart_recovery_notes: Optional[str] = None
    hamstring_flexibility: Optional[str] = None
    shoulder_mobility: Optional[str] = None
    balance_test: Optional[str] = None
    overall_notes: Optional[str] = None
    assessment_date: date

class ConsentInfo(BaseModel):
    # Core consent fields
    privacy_consent: bool                           # data-processing consent
    medical_disclaimer_accepted: bool               # exercise risk
    marketing_consent: bool = False                 # optional marketing comms
    # Extended registration consent pack
    consent_info_accuracy: bool = False             # info is accurate and complete
    consent_no_medical_advice: bool = False         # platform doesn't provide medical advice
    consent_nutrition_disclaimer: bool = False      # nutrition/supplement guidance is informational
    consent_medical_clearance: bool = False         # understands medical clearance requirement
    consent_ai_recommendations: bool = False        # understands AI recommendations require review
    consent_terms_accepted: bool = False            # accepts T&C, Privacy Policy and Waiver

class MemberRegistration(BaseModel):
    personal: PersonalInfo
    physical: PhysicalMetrics
    health: HealthProfile
    lifestyle: LifestyleProfile
    goals: GoalProfile
    behavior: BehaviorProfile
    assessment: BaselineAssessment
    consent: ConsentInfo

class MemberOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    age: Optional[int] = None
    status: str
    primary_goal: Optional[str] = None
    fitness_level: Optional[str] = None
    risk_level: Optional[str] = None
    registration_date: Optional[datetime] = None
    class Config:
        from_attributes = True

class MemberPhysicalOut(BaseModel):
    height: Optional[float] = None
    weight: Optional[float] = None
    bmi: Optional[float] = None
    body_fat_percentage: Optional[float] = None
    waist_measurement: Optional[float] = None
    resting_heart_rate: Optional[int] = None
    blood_pressure: Optional[str] = None
    mobility_score: Optional[int] = None
    fitness_level: Optional[str] = None
    class Config:
        from_attributes = True

class MemberHealthOut(BaseModel):
    injuries: Optional[str] = None
    pain_areas: Optional[str] = None
    previous_surgeries: Optional[str] = None
    chronic_conditions: Optional[str] = None
    medications: Optional[str] = None
    medical_clearance_required: Optional[str] = None
    medical_clearance_received: Optional[str] = None
    notes: Optional[str] = None
    risk_level: Optional[str] = None
    class Config:
        from_attributes = True

class MemberLifestyleOut(BaseModel):
    sleep_hours: Optional[float] = None
    stress_level: Optional[str] = None
    activity_level: Optional[str] = None
    work_schedule: Optional[str] = None
    travel_frequency: Optional[str] = None
    water_intake: Optional[float] = None
    nutrition_habits: Optional[str] = None
    smoking: Optional[str] = None
    alcohol: Optional[str] = None
    recovery_capacity: Optional[str] = None
    class Config:
        from_attributes = True

class MemberGoalsOut(BaseModel):
    primary_goal: Optional[str] = None
    secondary_goals: Optional[str] = None
    fat_loss_pct: Optional[int] = None
    strength_pct: Optional[int] = None
    mobility_pct: Optional[int] = None
    performance_pct: Optional[int] = None
    target_weight: Optional[float] = None
    target_date: Optional[date] = None
    coach_notes: Optional[str] = None
    class Config:
        from_attributes = True

class MemberMotivationOut(BaseModel):
    motivation_type: Optional[str] = None
    coaching_style: Optional[str] = None
    workout_preference: Optional[str] = None
    training_frequency: Optional[int] = None
    session_duration: Optional[int] = None
    gamification: Optional[str] = None
    notification_frequency: Optional[str] = None
    class Config:
        from_attributes = True

class AssessmentOut(BaseModel):
    id: int
    member_id: int
    assessment_date: date
    pushups: Optional[int] = None
    squats: Optional[int] = None
    plank_seconds: Optional[int] = None
    cardio_result: Optional[str] = None
    mobility_score: Optional[str] = None
    balance_score: Optional[str] = None
    overall_notes: Optional[str] = None
    class Config:
        from_attributes = True

class AssessmentCreate(BaseModel):
    member_id: int
    assessment_date: date
    pushups: Optional[int] = None
    squats: Optional[int] = None
    plank_seconds: Optional[int] = None
    cardio_result: Optional[str] = None
    mobility_score: Optional[str] = None
    balance_score: Optional[str] = None
    overall_notes: Optional[str] = None

class ProgressEntryOut(BaseModel):
    id: int
    member_id: int
    date: date
    weight: Optional[float] = None
    waist_measurement: Optional[float] = None
    body_fat_percentage: Optional[float] = None
    progress_note: Optional[str] = None
    coach_note: Optional[str] = None
    adherence_score: Optional[int] = None
    class Config:
        from_attributes = True

class ProgressEntryCreate(BaseModel):
    member_id: int
    date: date
    weight: Optional[float] = None
    waist_measurement: Optional[float] = None
    body_fat_percentage: Optional[float] = None
    progress_note: Optional[str] = None
    coach_note: Optional[str] = None
    adherence_score: Optional[int] = None

class WorkoutPlanOut(BaseModel):
    id: int
    member_id: int
    plan_name: str
    goal_type: Optional[str] = None
    weekly_frequency: Optional[int] = None
    session_duration: Optional[int] = None
    intensity_level: Optional[str] = None
    equipment: Optional[str] = None
    injury_considerations: Optional[str] = None
    notes: Optional[str] = None
    status: str
    class Config:
        from_attributes = True

class WorkoutPlanCreate(BaseModel):
    member_id: int
    plan_name: str
    goal_type: Optional[str] = None
    weekly_frequency: Optional[int] = None
    session_duration: Optional[int] = None
    intensity_level: Optional[str] = None
    equipment: Optional[str] = None
    injury_considerations: Optional[str] = None
    notes: Optional[str] = None
    status: str = "Draft"

class NutritionPlanOut(BaseModel):
    id: int
    member_id: int
    nutrition_goal: Optional[str] = None
    calories_target: Optional[int] = None
    protein_target: Optional[int] = None
    meal_preference: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    hydration_target: Optional[float] = None
    coach_notes: Optional[str] = None
    status: str
    class Config:
        from_attributes = True

class NutritionPlanCreate(BaseModel):
    member_id: int
    nutrition_goal: Optional[str] = None
    calories_target: Optional[int] = None
    protein_target: Optional[int] = None
    meal_preference: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    hydration_target: Optional[float] = None
    coach_notes: Optional[str] = None
    status: str = "Draft"

class SupplementPlanOut(BaseModel):
    id: int
    member_id: int
    supplement_name: str
    purpose: Optional[str] = None
    suggested_timing: Optional[str] = None
    notes: Optional[str] = None
    safety_notes: Optional[str] = None
    status: str
    class Config:
        from_attributes = True

class SupplementPlanCreate(BaseModel):
    member_id: int
    supplement_name: str
    purpose: Optional[str] = None
    suggested_timing: Optional[str] = None
    notes: Optional[str] = None
    safety_notes: Optional[str] = None
    status: str = "Draft"

class ComputedScores(BaseModel):
    fitness_age: int
    recovery_score: int
    injury_risk_score: int
    strength_index: int
    cardiovascular_score: int
    mobility_rating: int
    compliance_probability: int
    member_segment: str

class MemberDetailOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    occupation: Optional[str] = None
    location: Optional[str] = None
    preferred_training_time: Optional[str] = None
    status: str
    registration_date: Optional[datetime] = None
    primary_goal: Optional[str] = None
    fitness_level: Optional[str] = None
    risk_level: Optional[str] = None
    privacy_consent: Optional[bool] = None
    medical_disclaimer_accepted: Optional[bool] = None
    marketing_consent: Optional[bool] = None
    consent_info_accuracy: Optional[bool] = None
    consent_no_medical_advice: Optional[bool] = None
    consent_nutrition_disclaimer: Optional[bool] = None
    consent_medical_clearance: Optional[bool] = None
    consent_ai_recommendations: Optional[bool] = None
    consent_terms_accepted: Optional[bool] = None
    consent_signed_at: Optional[datetime] = None
    physical_metrics: Optional[MemberPhysicalOut] = None
    health_profile: Optional[MemberHealthOut] = None
    lifestyle_profile: Optional[MemberLifestyleOut] = None
    goals: Optional[MemberGoalsOut] = None
    motivation_profile: Optional[MemberMotivationOut] = None
    assessments: List[AssessmentOut] = []
    progress_entries: List[ProgressEntryOut] = []
    workout_plans: List[WorkoutPlanOut] = []
    nutrition_plans: List[NutritionPlanOut] = []
    supplement_plans: List[SupplementPlanOut] = []
    computed: Optional[ComputedScores] = None
    class Config:
        from_attributes = True
