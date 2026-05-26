from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app import models, schemas, auth, database

router = APIRouter(prefix="/api/workout-plans", tags=["workout plans"])

@router.post("/", response_model=schemas.WorkoutPlanOut)
def create_plan(data: schemas.WorkoutPlanCreate, db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    plan = models.WorkoutPlan(**data.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan

@router.get("/", response_model=List[schemas.WorkoutPlanOut])
def list_plans(db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    return db.query(models.WorkoutPlan).all()

@router.delete("/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    plan = db.query(models.WorkoutPlan).filter(models.WorkoutPlan.id == plan_id).first()
    if plan:
        db.delete(plan)
        db.commit()
    return {"message": "Deleted"}
