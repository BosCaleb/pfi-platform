from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text, ForeignKey, Sequence
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime


def id_column(table_name: str):
    return Column(Integer, Sequence(f"{table_name}_id_seq"), primary_key=True, index=True)


class Admin(Base):
    __tablename__ = "admins"
    id = id_column(__tablename__)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    registration_date = Column(DateTime, default=datetime.utcnow)
    primary_goal = Column(String)
    fitness_level = Column(String)
    risk_level = Column(String, default="Low")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
    created_at = Column(DateTime, default=datetime.utcnow)
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
    created_at = Column(DateTime, default=datetime.utcnow)
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
    created_at = Column(DateTime, default=datetime.utcnow)
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
    created_at = Column(DateTime, default=datetime.utcnow)
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
    created_at = Column(DateTime, default=datetime.utcnow)
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
    created_at = Column(DateTime, default=datetime.utcnow)
    member = relationship("Member", back_populates="supplement_plans")
