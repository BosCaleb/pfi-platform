from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app import models, schemas, auth, database

router = APIRouter(prefix="/api/nutrition-plans", tags=["nutrition plans"])

@router.post("/", response_model=schemas.NutritionPlanOut)
def create_plan(data: schemas.NutritionPlanCreate, db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    plan = models.NutritionPlan(**data.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan

@router.get("/", response_model=List[schemas.NutritionPlanOut])
def list_plans(db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    return db.query(models.NutritionPlan).all()

@router.delete("/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    plan = db.query(models.NutritionPlan).filter(models.NutritionPlan.id == plan_id).first()
    if plan:
        db.delete(plan)
        db.commit()
    return {"message": "Deleted"}
