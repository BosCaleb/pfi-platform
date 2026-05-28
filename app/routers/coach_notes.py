"""
Coach Notes router — Phase 3.2
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_admin
from app import models

router = APIRouter(prefix="/api/coach-notes", tags=["coach-notes"])


class NoteCreate(BaseModel):
    member_id: int
    recommendation_id: Optional[int] = None
    note_type: str = "Internal"   # Internal / Member Visible
    note_text: str


class NoteUpdate(BaseModel):
    note_type: Optional[str] = None
    note_text: Optional[str] = None


def _note_dict(n: models.CoachNote) -> dict:
    return {c.name: getattr(n, c.name) for c in n.__table__.columns}


@router.post("/", status_code=201)
def create_note(
    body: NoteCreate,
    db: Session = Depends(get_db),
    admin: models.Admin = Depends(get_current_admin),
):
    note = models.CoachNote(
        member_id=body.member_id,
        recommendation_id=body.recommendation_id,
        admin_id=admin.id,
        note_type=body.note_type,
        note_text=body.note_text,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_dict(note)


@router.get("/")
def list_notes(
    member_id:         Optional[int] = Query(None),
    recommendation_id: Optional[int] = Query(None),
    note_type:         Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    q = db.query(models.CoachNote)
    if member_id:         q = q.filter(models.CoachNote.member_id == member_id)
    if recommendation_id: q = q.filter(models.CoachNote.recommendation_id == recommendation_id)
    if note_type:         q = q.filter(models.CoachNote.note_type == note_type)
    notes = q.order_by(models.CoachNote.created_at.desc()).all()
    return [_note_dict(n) for n in notes]


@router.patch("/{note_id}")
def update_note(
    note_id: int,
    body: NoteUpdate,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    n = db.query(models.CoachNote).filter(models.CoachNote.id == note_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Note not found")
    if body.note_type: setattr(n, "note_type", body.note_type)
    if body.note_text: setattr(n, "note_text", body.note_text)
    db.commit()
    db.refresh(n)
    return _note_dict(n)


@router.delete("/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    n = db.query(models.CoachNote).filter(models.CoachNote.id == note_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(n)
    db.commit()
    return {"deleted": note_id}
