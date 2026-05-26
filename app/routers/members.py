from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from app import models, schemas, auth, database, computed

router = APIRouter(prefix="/api/members", tags=["members"])

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

    age = computed.calculate_age(data.personal.date_of_birth)
    member = models.Member(
        first_name=data.personal.first_name,
        last_name=data.personal.last_name,
        email=data.personal.email,
        phone=data.personal.phone,
        date_of_birth=data.personal.date_of_birth,
        age=age,
        gender=data.personal.gender,
        emergency_contact_name=data.personal.emergency_contact_name,
        emergency_contact_phone=data.personal.emergency_contact_phone,
        occupation=data.personal.occupation,
        location=data.personal.location,
        preferred_training_time=data.personal.preferred_training_time,
        status=data.personal.status,
        primary_goal=data.goals.primary_goal,
        fitness_level=data.physical.fitness_level,
        risk_level=data.health.risk_level,
    )
    db.add(member)
    db.flush()

    bmi = computed.calculate_bmi(data.physical.height, data.physical.weight)
    db.add(models.MemberPhysicalMetrics(
        member_id=member.id,
        height=data.physical.height,
        weight=data.physical.weight,
        bmi=bmi,
        body_fat_percentage=data.physical.body_fat_percentage,
        waist_measurement=data.physical.waist_measurement,
        resting_heart_rate=data.physical.resting_heart_rate,
        blood_pressure=data.physical.blood_pressure,
        mobility_score=data.physical.mobility_score,
        fitness_level=data.physical.fitness_level,
    ))

    db.add(models.MemberHealthProfile(
        member_id=member.id,
        injuries=data.health.injuries,
        pain_areas=data.health.pain_areas,
        previous_surgeries=data.health.previous_surgeries,
        chronic_conditions=data.health.chronic_conditions,
        medications=data.health.medications,
        medical_clearance_required=data.health.medical_clearance_required,
        medical_clearance_received=data.health.medical_clearance_received,
        notes=data.health.notes,
        risk_level=data.health.risk_level,
    ))

    db.add(models.MemberLifestyleProfile(
        member_id=member.id,
        sleep_hours=data.lifestyle.sleep_hours,
        stress_level=data.lifestyle.stress_level,
        activity_level=data.lifestyle.activity_level,
        work_schedule=data.lifestyle.work_schedule,
        travel_frequency=data.lifestyle.travel_frequency,
        water_intake=data.lifestyle.water_intake,
        nutrition_habits=data.lifestyle.nutrition_habits,
        smoking=data.lifestyle.smoking,
        alcohol=data.lifestyle.alcohol,
        recovery_capacity=data.lifestyle.recovery_capacity,
    ))

    db.add(models.MemberGoals(
        member_id=member.id,
        primary_goal=data.goals.primary_goal,
        secondary_goals=",".join(data.goals.secondary_goals) if data.goals.secondary_goals else None,
        fat_loss_pct=data.goals.fat_loss_pct,
        strength_pct=data.goals.strength_pct,
        mobility_pct=data.goals.mobility_pct,
        performance_pct=data.goals.performance_pct,
        target_weight=data.goals.target_weight,
        target_date=data.goals.target_date,
        coach_notes=data.goals.coach_notes,
    ))

    db.add(models.MemberMotivationProfile(
        member_id=member.id,
        motivation_type=data.behavior.motivation_type,
        coaching_style=data.behavior.coaching_style,
        workout_preference=data.behavior.workout_preference,
        training_frequency=data.behavior.training_frequency,
        session_duration=data.behavior.session_duration,
        gamification=data.behavior.gamification,
        notification_frequency=data.behavior.notification_frequency,
    ))

    db.add(models.Assessment(
        member_id=member.id,
        assessment_date=data.assessment.assessment_date,
        pushups=data.assessment.pushups,
        squats=data.assessment.squats,
        plank_seconds=data.assessment.plank_seconds,
        cardio_result=data.assessment.cardio_result,
        mobility_score=f"{data.assessment.hamstring_flexibility} / {data.assessment.shoulder_mobility}",
        balance_score=data.assessment.balance_test,
        overall_notes=data.assessment.overall_notes,
    ))

    db.commit()
    db.refresh(member)
    return member

@router.get("/{member_id}", response_model=schemas.MemberDetailOut)
def get_member(member_id: int, db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    physical = member.physical_metrics
    health = member.health_profile
    lifestyle = member.lifestyle_profile
    motivation = member.motivation_profile
    assessments = member.assessments

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
    db.delete(member)
    db.commit()
    return {"message": "Member deleted"}
