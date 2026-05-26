from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app import models, schemas, auth, database

router = APIRouter(prefix="/api/progress", tags=["progress"])

@router.post("/", response_model=schemas.ProgressEntryOut)
def create_progress(data: schemas.ProgressEntryCreate, db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    entry = models.ProgressEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

@router.get("/member/{member_id}", response_model=List[schemas.ProgressEntryOut])
def list_progress(member_id: int, db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    return db.query(models.ProgressEntry).filter(models.ProgressEntry.member_id == member_id).order_by(models.ProgressEntry.date.desc()).all()
