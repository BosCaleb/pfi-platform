"""Coach Task management router."""
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import auth, database, models

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/coach-tasks", tags=["coach-tasks"])


class TaskCreate(BaseModel):
    member_id: int
    task_type: str = "General"
    title: str
    description: Optional[str] = None
    priority: str = "Medium"
    due_date: Optional[date] = None
    assigned_to_admin_id: Optional[int] = None


class TaskUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    coach_note: Optional[str] = None
    dismiss_reason: Optional[str] = None
    assigned_to_admin_id: Optional[int] = None
    due_date: Optional[date] = None


@router.post("/", summary="Create a coach task manually")
def create_task(
    data: TaskCreate,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    task = models.CoachTask(
        member_id=data.member_id,
        task_type=data.task_type,
        title=data.title,
        description=data.description,
        priority=data.priority,
        status="Open",
        due_date=data.due_date,
        assigned_to_admin_id=data.assigned_to_admin_id,
        created_by_system=False,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _serialize(task)


@router.get("/", summary="List coach tasks")
def list_tasks(
    member_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    task_type: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    q = db.query(models.CoachTask)
    if member_id:
        q = q.filter(models.CoachTask.member_id == member_id)
    if status:
        q = q.filter(models.CoachTask.status == status)
    if priority:
        q = q.filter(models.CoachTask.priority == priority)
    if task_type:
        q = q.filter(models.CoachTask.task_type == task_type)
    rows = q.order_by(models.CoachTask.created_at.desc()).limit(limit).all()
    return [_serialize(r) for r in rows]


@router.patch("/{task_id}", summary="Update a coach task")
def update_task(
    task_id: int,
    data: TaskUpdate,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    task = db.query(models.CoachTask).filter(models.CoachTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found.")
    from datetime import datetime, timezone
    now = datetime.now(tz=timezone.utc)
    if data.status:
        task.status = data.status
        if data.status == "Completed":
            task.completed_at = now
    if data.priority:
        task.priority = data.priority
    if data.coach_note is not None:
        task.coach_note = data.coach_note
    if data.dismiss_reason is not None:
        task.dismiss_reason = data.dismiss_reason
    if data.assigned_to_admin_id is not None:
        task.assigned_to_admin_id = data.assigned_to_admin_id
    if data.due_date is not None:
        task.due_date = data.due_date
    db.commit()
    db.refresh(task)
    return _serialize(task)


@router.delete("/{task_id}", summary="Delete a coach task")
def delete_task(
    task_id: int,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    task = db.query(models.CoachTask).filter(models.CoachTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Not found.")
    db.delete(task)
    db.commit()
    return {"message": "Task deleted."}


def _serialize(t: models.CoachTask) -> dict:
    return {
        "id": t.id,
        "member_id": t.member_id,
        "task_type": t.task_type,
        "title": t.title,
        "description": t.description,
        "priority": t.priority,
        "status": t.status,
        "due_date": str(t.due_date) if t.due_date else None,
        "assigned_to_admin_id": t.assigned_to_admin_id,
        "created_by_system": t.created_by_system,
        "coach_note": t.coach_note,
        "dismiss_reason": t.dismiss_reason,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
    }
