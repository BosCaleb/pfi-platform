"""Progress router — create, list, and delete member progress entries."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import auth, database, models, schemas

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.post("/", response_model=schemas.ProgressEntryOut)
def create_progress(
    data: schemas.ProgressEntryCreate,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    entry = models.ProgressEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    logger.info("Progress entry created for member_id=%s", data.member_id)
    return entry


@router.get("/member/{member_id}", response_model=List[schemas.ProgressEntryOut])
def list_progress(
    member_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    return (
        db.query(models.ProgressEntry)
        .filter(models.ProgressEntry.member_id == member_id)
        .order_by(models.ProgressEntry.date.desc())
        .all()
    )


@router.delete("/{entry_id}")
def delete_progress(
    entry_id: int,
    db: Session = Depends(database.get_db),
    admin=Depends(auth.get_current_admin),
):
    """Delete a single progress entry by ID."""
    record = db.query(models.ProgressEntry).filter(models.ProgressEntry.id == entry_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Progress entry not found")
    db.delete(record)
    db.commit()
    logger.info("Progress entry %s deleted", entry_id)
    return {"message": "Progress entry deleted"}
