"""Assessment router — create, list, and delete fitness assessments."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import auth, database, models, schemas

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


@router.post("/", response_model=schemas.AssessmentOut)
def create_assessment(
    data: schemas.AssessmentCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    assessment = models.Assessment(**data.model_dump())
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    logger.info("Assessment created for member_id=%s", data.member_id)
    return assessment


@router.get("/member/{member_id}", response_model=List[schemas.AssessmentOut])
def list_assessments(
    member_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    return (
        db.query(models.Assessment)
        .filter(models.Assessment.member_id == member_id)
        .order_by(models.Assessment.assessment_date.desc())
        .all()
    )


@router.delete("/{assessment_id}")
def delete_assessment(
    assessment_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    """Delete a single assessment record by ID."""
    record = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Assessment not found")
    db.delete(record)
    db.commit()
    logger.info("Assessment %s deleted", assessment_id)
    return {"message": "Assessment deleted"}
