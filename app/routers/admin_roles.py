"""Admin Roles — role management and admin listing."""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AdminRole, AdminUserRole, Admin
from app.auth import get_current_admin

router = APIRouter(prefix="/api/admin-roles", tags=["admin-roles"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _role_dict(r: AdminRole) -> dict:
    perms = []
    if r.permissions_json:
        try:
            perms = json.loads(r.permissions_json)
        except Exception:
            perms = []
    return {
        "id": r.id,
        "role_name": r.role_name,
        "description": r.description,
        "permissions": perms,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _user_role_dict(ur: AdminUserRole, db: Session) -> dict:
    adm = db.query(Admin).filter(Admin.id == ur.admin_id).first()
    role = db.query(AdminRole).filter(AdminRole.id == ur.role_id).first()
    assigner = db.query(Admin).filter(Admin.id == ur.assigned_by_admin_id).first() if ur.assigned_by_admin_id else None
    return {
        "id": ur.id,
        "admin_id": ur.admin_id,
        "admin_email": adm.email if adm else None,
        "role_id": ur.role_id,
        "role_name": role.role_name if role else None,
        "assigned_by_admin_id": ur.assigned_by_admin_id,
        "assigned_by_email": assigner.email if assigner else None,
        "created_at": ur.created_at.isoformat() if ur.created_at else None,
    }


# ── Roles CRUD ──────────────────────────────────────────────────────────

@router.get("/roles")
def list_roles(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    roles = db.query(AdminRole).order_by(AdminRole.role_name).all()
    return [_role_dict(r) for r in roles]


@router.post("/roles", status_code=201)
def create_role(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    if not body.get("role_name"):
        raise HTTPException(400, "role_name is required")
    permissions = body.get("permissions", [])
    role = AdminRole(
        role_name=body["role_name"],
        description=body.get("description"),
        permissions_json=json.dumps(permissions),
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return _role_dict(role)


@router.put("/roles/{role_id}")
def update_role(role_id: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    role = db.query(AdminRole).filter(AdminRole.id == role_id).first()
    if not role:
        raise HTTPException(404, "Role not found")
    if "role_name" in body:
        role.role_name = body["role_name"]
    if "description" in body:
        role.description = body["description"]
    if "permissions" in body:
        role.permissions_json = json.dumps(body["permissions"])
    role.updated_at = _utcnow()
    db.commit()
    db.refresh(role)
    return _role_dict(role)


@router.delete("/roles/{role_id}", status_code=204)
def delete_role(role_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    role = db.query(AdminRole).filter(AdminRole.id == role_id).first()
    if not role:
        raise HTTPException(404, "Role not found")
    db.delete(role)
    db.commit()


# ── Admin User Role assignments ─────────────────────────────────────────

@router.get("/assignments")
def list_assignments(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    items = db.query(AdminUserRole).all()
    return [_user_role_dict(ur, db) for ur in items]


@router.post("/assignments", status_code=201)
def assign_role(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    admin_id = body.get("admin_id")
    role_id = body.get("role_id")
    if not admin_id or not role_id:
        raise HTTPException(400, "admin_id and role_id are required")
    if not db.query(Admin).filter(Admin.id == admin_id).first():
        raise HTTPException(404, "Admin not found")
    if not db.query(AdminRole).filter(AdminRole.id == role_id).first():
        raise HTTPException(404, "Role not found")
    # Prevent duplicate
    existing = (
        db.query(AdminUserRole)
        .filter(AdminUserRole.admin_id == admin_id, AdminUserRole.role_id == role_id)
        .first()
    )
    if existing:
        raise HTTPException(400, "This admin already has this role")
    ur = AdminUserRole(
        admin_id=admin_id,
        role_id=role_id,
        assigned_by_admin_id=admin.id,
        created_at=_utcnow(),
    )
    db.add(ur)
    db.commit()
    db.refresh(ur)
    return _user_role_dict(ur, db)


@router.delete("/assignments/{assignment_id}", status_code=204)
def remove_assignment(assignment_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    ur = db.query(AdminUserRole).filter(AdminUserRole.id == assignment_id).first()
    if not ur:
        raise HTTPException(404, "Assignment not found")
    db.delete(ur)
    db.commit()


# ── Admin listing ───────────────────────────────────────────────────────

@router.get("/admins")
def list_admins(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    admins = db.query(Admin).all()
    result = []
    for a in admins:
        roles = (
            db.query(AdminRole)
            .join(AdminUserRole, AdminUserRole.role_id == AdminRole.id)
            .filter(AdminUserRole.admin_id == a.id)
            .all()
        )
        result.append({
            "id": a.id,
            "email": a.email,
            "is_super_admin": a.is_super_admin,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "roles": [r.role_name for r in roles],
        })
    return result
