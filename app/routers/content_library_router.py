"""Content & Resource Library — create, assign, and publish coaching resources."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_admin
from app.models import ContentResource, MemberResourceAssignment, Member

router = APIRouter(prefix="/api/content", tags=["content-library"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _res_dict(r: ContentResource) -> dict:
    return {
        "id": r.id, "title": r.title, "resource_type": r.resource_type,
        "category": r.category, "description": r.description,
        "content_body": r.content_body, "external_url": r.external_url,
        "file_url": r.file_url, "linked_exercise_id": r.linked_exercise_id,
        "linked_goal": r.linked_goal, "linked_workout_group_id": r.linked_workout_group_id,
        "visible_to_members": r.visible_to_members, "status": r.status,
        "created_by_admin_id": r.created_by_admin_id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _assign_dict(a: MemberResourceAssignment, db: Session) -> dict:
    m = db.query(Member).filter(Member.id == a.member_id).first()
    r = db.query(ContentResource).filter(ContentResource.id == a.resource_id).first()
    return {
        "id": a.id, "member_id": a.member_id,
        "member_name": f"{m.first_name} {m.last_name}" if m else None,
        "resource_id": a.resource_id,
        "resource_title": r.title if r else None,
        "viewed": a.viewed, "viewed_at": a.viewed_at.isoformat() if a.viewed_at else None,
        "notes": a.notes,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


# ── Resources ──────────────────────────────────────────────────────────

@router.get("/resources")
def list_resources(
    category:     Optional[str] = None,
    resource_type: Optional[str] = None,
    status:       Optional[str] = None,
    visible_only: bool = False,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    q = db.query(ContentResource)
    if category:      q = q.filter(ContentResource.category == category)
    if resource_type: q = q.filter(ContentResource.resource_type == resource_type)
    if status:        q = q.filter(ContentResource.status == status)
    if visible_only:  q = q.filter(ContentResource.visible_to_members == True)
    return [_res_dict(r) for r in q.order_by(ContentResource.created_at.desc()).all()]


@router.post("/resources", status_code=201)
def create_resource(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    body.pop("id", None); body.pop("created_at", None); body.pop("updated_at", None)
    body["created_by_admin_id"] = admin.id
    r = ContentResource(**body)
    db.add(r); db.commit(); db.refresh(r)
    return _res_dict(r)


@router.get("/resources/{rid}")
def get_resource(rid: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    r = db.query(ContentResource).filter(ContentResource.id == rid).first()
    if not r: raise HTTPException(404, "Resource not found")
    return _res_dict(r)


@router.put("/resources/{rid}")
def update_resource(rid: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    r = db.query(ContentResource).filter(ContentResource.id == rid).first()
    if not r: raise HTTPException(404, "Resource not found")
    for k, v in body.items():
        if k not in ("id", "created_at", "created_by_admin_id") and hasattr(r, k):
            setattr(r, k, v)
    r.updated_at = _utcnow(); db.commit(); db.refresh(r)
    return _res_dict(r)


@router.delete("/resources/{rid}", status_code=204)
def delete_resource(rid: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    r = db.query(ContentResource).filter(ContentResource.id == rid).first()
    if not r: raise HTTPException(404, "Resource not found")
    db.delete(r); db.commit()


# ── Assignments ────────────────────────────────────────────────────────

@router.get("/assignments")
def list_assignments(
    member_id:   Optional[int] = None,
    resource_id: Optional[int] = None,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    q = db.query(MemberResourceAssignment)
    if member_id:   q = q.filter(MemberResourceAssignment.member_id == member_id)
    if resource_id: q = q.filter(MemberResourceAssignment.resource_id == resource_id)
    return [_assign_dict(a, db) for a in q.order_by(MemberResourceAssignment.created_at.desc()).all()]


@router.post("/assignments", status_code=201)
def assign_resource(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    member_id   = body.get("member_id")
    resource_id = body.get("resource_id")
    if not member_id or not resource_id:
        raise HTTPException(400, "member_id and resource_id required")
    if not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(404, "Member not found")
    if not db.query(ContentResource).filter(ContentResource.id == resource_id).first():
        raise HTTPException(404, "Resource not found")
    a = MemberResourceAssignment(
        member_id=member_id, resource_id=resource_id,
        assigned_by_admin_id=admin.id,
        notes=body.get("notes"),
        created_at=_utcnow(),
    )
    db.add(a); db.commit(); db.refresh(a)
    return _assign_dict(a, db)


@router.delete("/assignments/{aid}", status_code=204)
def remove_assignment(aid: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    a = db.query(MemberResourceAssignment).filter(MemberResourceAssignment.id == aid).first()
    if not a: raise HTTPException(404, "Assignment not found")
    db.delete(a); db.commit()
