from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app import models, schemas, auth, database

router = APIRouter(prefix="/api/assessments", tags=["assessments"])

@router.post("/", response_model=schemas.AssessmentOut)
def create_assessment(data: schemas.AssessmentCreate, db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    assessment = models.Assessment(**data.model_dump())
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment

@router.get("/member/{member_id}", response_model=List[schemas.AssessmentOut])
def list_assessments(member_id: int, db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    return db.query(models.Assessment).filter(models.Assessment.member_id == member_id).order_by(models.Assessment.assessment_date.desc()).all()
