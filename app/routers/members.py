import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from app import models, schemas, auth, database, computed
from app.audit import log_health_access

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/members", tags=["members"])


def set_attrs(target, values: dict):
    for key, value in values.items():
        setattr(target, key, value)


def get_or_create(db: Session, current, model, member_id: int):
    if current:
        return current
    instance = model(member_id=member_id)
    db.add(instance)
    return instance


def latest_assessment(member: models.Member):
    if not member.assessments:
        return None
    return sorted(member.assessments, key=lambda item: item.assessment_date)[-1]


def apply_member_registration(member: models.Member, data: schemas.MemberRegistration, db: Session):
    member.first_name = data.personal.first_name
    member.last_name = data.personal.last_name
    member.email = data.personal.email
    member.phone = data.personal.phone
    member.date_of_birth = data.personal.date_of_birth
    member.age = computed.calculate_age(data.personal.date_of_birth)
    member.gender = data.personal.gender
    member.emergency_contact_name = data.personal.emergency_contact_name
    member.emergency_contact_phone = data.personal.emergency_contact_phone
    member.occupation = data.personal.occupation
    member.location = data.personal.location
    member.preferred_training_time = data.personal.preferred_training_time
    member.status = data.personal.status
    member.primary_goal = data.goals.primary_goal
    member.fitness_level = data.physical.fitness_level
    member.risk_level = data.health.risk_level
    member.privacy_consent = data.consent.privacy_consent
    member.medical_disclaimer_accepted = data.consent.medical_disclaimer_accepted
    member.marketing_consent = data.consent.marketing_consent
    if data.consent.privacy_consent and data.consent.medical_disclaimer_accepted:
        member.consent_signed_at = member.consent_signed_at or datetime.utcnow()

    bmi = computed.calculate_bmi(data.physical.height, data.physical.weight)
    physical = get_or_create(db, member.physical_metrics, models.MemberPhysicalMetrics, member.id)
    set_attrs(physical, {
        "height": data.physical.height,
        "weight": data.physical.weight,
        "bmi": bmi,
        "body_fat_percentage": data.physical.body_fat_percentage,
        "waist_measurement": data.physical.waist_measurement,
        "resting_heart_rate": data.physical.resting_heart_rate,
        "blood_pressure": data.physical.blood_pressure,
        "mobility_score": data.physical.mobility_score,
        "fitness_level": data.physical.fitness_level,
    })

    health = get_or_create(db, member.health_profile, models.MemberHealthProfile, member.id)
    set_attrs(health, {
        "injuries": data.health.injuries,
        "pain_areas": data.health.pain_areas,
        "previous_surgeries": data.health.previous_surgeries,
        "chronic_conditions": data.health.chronic_conditions,
        "medications": data.health.medications,
        "medical_clearance_required": data.health.medical_clearance_required,
        "medical_clearance_received": data.health.medical_clearance_received,
        "notes": data.health.notes,
        "risk_level": data.health.risk_level,
    })

    lifestyle = get_or_create(db, member.lifestyle_profile, models.MemberLifestyleProfile, member.id)
    set_attrs(lifestyle, {
        "sleep_hours": data.lifestyle.sleep_hours,
        "stress_level": data.lifestyle.stress_level,
        "activity_level": data.lifestyle.activity_level,
        "work_schedule": data.lifestyle.work_schedule,
        "travel_frequency": data.lifestyle.travel_frequency,
        "water_intake": data.lifestyle.water_intake,
        "nutrition_habits": data.lifestyle.nutrition_habits,
        "smoking": data.lifestyle.smoking,
        "alcohol": data.lifestyle.alcohol,
        "recovery_capacity": data.lifestyle.recovery_capacity,
    })

    goals = get_or_create(db, member.goals, models.MemberGoals, member.id)
    set_attrs(goals, {
        "primary_goal": data.goals.primary_goal,
        "secondary_goals": ",".join(data.goals.secondary_goals) if data.goals.secondary_goals else None,
        "fat_loss_pct": data.goals.fat_loss_pct,
        "strength_pct": data.goals.strength_pct,
        "mobility_pct": data.goals.mobility_pct,
        "performance_pct": data.goals.performance_pct,
        "target_weight": data.goals.target_weight,
        "target_date": data.goals.target_date,
        "coach_notes": data.goals.coach_notes,
    })

    motivation = get_or_create(db, member.motivation_profile, models.MemberMotivationProfile, member.id)
    set_attrs(motivation, {
        "motivation_type": data.behavior.motivation_type,
        "coaching_style": data.behavior.coaching_style,
        "workout_preference": data.behavior.workout_preference,
        "training_frequency": data.behavior.training_frequency,
        "session_duration": data.behavior.session_duration,
        "gamification": data.behavior.gamification,
        "notification_frequency": data.behavior.notification_frequency,
    })

    assessment = latest_assessment(member)
    if not assessment:
        assessment = models.Assessment(member_id=member.id)
        db.add(assessment)
    set_attrs(assessment, {
        "assessment_date": data.assessment.assessment_date,
        "pushups": data.assessment.pushups,
        "squats": data.assessment.squats,
        "plank_seconds": data.assessment.plank_seconds,
        "cardio_result": data.assessment.cardio_result,
        "mobility_score": f"{data.assessment.hamstring_flexibility} / {data.assessment.shoulder_mobility}",
        "balance_score": data.assessment.balance_test,
        "overall_notes": data.assessment.overall_notes,
    })

@router.get("/", response_model=List[schemas.MemberOut])
def list_members(
    search: Optional[str] = None,
    goal: Optional[str] = None,
    level: Optional[str] = None,
    risk: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin)
):
    query = db.query(models.Member)
    if goal:
        query = query.filter(models.Member.primary_goal == goal)
    if level:
        query = query.filter(models.Member.fitness_level == level)
    if risk:
        query = query.filter(models.Member.risk_level == risk)
    if status:
        query = query.filter(models.Member.status == status)

    members = query.all()
    if search:
        s = search.lower()
        members = [m for m in members if s in f"{m.first_name} {m.last_name} {m.email} {m.primary_goal}".lower()]
    return members

@router.post("/", response_model=schemas.MemberOut)
def create_member(data: schemas.MemberRegistration, db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    if db.query(models.Member).filter(models.Member.email == data.personal.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    member = models.Member(
        first_name=data.personal.first_name,
        last_name=data.personal.last_name,
        email=data.personal.email,
        status=data.personal.status,
    )
    db.add(member)
    db.flush()
    apply_member_registration(member, data, db)
    db.commit()
    db.refresh(member)
    return member


@router.put("/{member_id}", response_model=schemas.MemberOut)
def update_member(member_id: int, data: schemas.MemberRegistration, db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    duplicate = db.query(models.Member).filter(models.Member.email == data.personal.email, models.Member.id != member_id).first()
    if duplicate:
        raise HTTPException(status_code=400, detail="Email already registered")
    apply_member_registration(member, data, db)
    db.commit()
    db.refresh(member)
    return member

@router.get("/{member_id}", response_model=schemas.MemberDetailOut)
def get_member(member_id: int, db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    physical   = member.physical_metrics
    health     = member.health_profile
    lifestyle  = member.lifestyle_profile
    motivation = member.motivation_profile
    assessments = member.assessments

    # POPIA audit — log every read of special personal information (health data).
    sensitive_types = ["physical_metrics", "health_profile", "lifestyle_profile", "assessments"]
    log_health_access(
        actor_email=admin.email,
        member_id=member_id,
        data_types=sensitive_types,
    )

    return schemas.MemberDetailOut.model_validate({
        **{c.name: getattr(member, c.name) for c in member.__table__.columns},
        "physical_metrics": physical,
        "health_profile": health,
        "lifestyle_profile": lifestyle,
        "goals": member.goals,
        "motivation_profile": motivation,
        "assessments": member.assessments,
        "progress_entries": member.progress_entries,
        "workout_plans": member.workout_plans,
        "nutrition_plans": member.nutrition_plans,
        "supplement_plans": member.supplement_plans,
        "computed": {
            "fitness_age": computed.compute_fitness_age(member, lifestyle),
            "recovery_score": computed.compute_recovery_score(lifestyle),
            "injury_risk_score": computed.compute_injury_risk(health),
            "strength_index": computed.compute_strength_index(assessments),
            "cardiovascular_score": computed.compute_cardio_score(assessments),
            "mobility_rating": computed.compute_mobility_rating(assessments, physical),
            "compliance_probability": computed.compute_compliance_probability(motivation, lifestyle),
            "member_segment": computed.compute_member_segment(member, motivation),
        }
    })

@router.delete("/{member_id}")
def delete_member(member_id: int, db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # POPIA audit — permanent deletion of all special personal information.
    log_health_access(
        actor_email=admin.email,
        member_id=member_id,
        data_types=["physical_metrics", "health_profile", "lifestyle_profile",
                    "assessments", "progress_entries", "plans"],
        action="DELETE",
    )
    for model in [
        models.SupplementPlan,
        models.NutritionPlan,
        models.WorkoutPlan,
        models.ProgressEntry,
        models.Assessment,
        models.MemberMotivationProfile,
        models.MemberGoals,
        models.MemberLifestyleProfile,
        models.MemberHealthProfile,
        models.MemberPhysicalMetrics,
    ]:
        db.query(model).filter(model.member_id == member_id).delete(synchronize_session=False)
    db.commit()
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        return {"message": "Member deleted"}
    db.delete(member)
    db.commit()
    return {"message": "Member deleted"}
