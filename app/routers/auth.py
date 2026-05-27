"""
Authentication router — login, admin seeding, and admin self-management.

Endpoints
---------
POST /api/auth/login            — obtain a JWT (rate-limited)
POST /api/auth/seed             — one-time default admin creation (feature-flagged)
GET  /api/auth/me               — current admin profile (requires token)
POST /api/auth/change-password  — update own password (requires token)
POST /api/auth/create-admin     — create an additional admin account (requires token)
GET  /api/auth/admins           — list all admin accounts (requires token)
DELETE /api/auth/admins/{id}    — delete an admin account (requires token, cannot delete self)
"""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app import auth, database, models
from app.config import admin_seed_enabled
from app.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Seed credentials (env-driven, never hard-coded) ──────────────────
_DEFAULT_ADMIN_EMAIL    = os.getenv("DEFAULT_ADMIN_EMAIL",    "admin@pfi-platform.local")
_DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")

# ── Request / response schemas ────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class CreateAdminRequest(BaseModel):
    email: str
    password: str
    name: str = "Admin"


# ── Endpoints ─────────────────────────────────────────────────────────

@router.post("/login", summary="Obtain a JWT access token")
@limiter.limit("10/minute")
def login(
    request: Request,
    credentials: LoginRequest,
    db: Session = Depends(database.get_db),
):
    """Authenticate an admin and return a JWT bearer token."""
    admin = db.query(models.Admin).filter(
        models.Admin.email == credentials.email
    ).first()
    if not admin or not auth.verify_password(credentials.password, admin.password):
        logger.warning("Failed login attempt for email: %s", credentials.email)
        raise HTTPException(status_code=400, detail="Invalid credentials")

    token = auth.create_access_token({"sub": str(admin.id)})
    logger.info("Admin %s logged in (id=%s)", admin.email, admin.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "admin": {"id": admin.id, "email": admin.email, "name": admin.name},
    }


@router.post("/seed", summary="Create the default admin account (one-time setup)")
def seed_admin(db: Session = Depends(database.get_db)):
    """Create the default admin account if it does not already exist.

    Only active when ALLOW_ADMIN_SEED=true.  Disable after initial setup.
    """
    if not admin_seed_enabled():
        raise HTTPException(status_code=403, detail="Admin seeding is disabled.")

    if not _DEFAULT_ADMIN_PASSWORD or _DEFAULT_ADMIN_PASSWORD in ("admin123", "CHANGE_ME_strong_password"):
        logger.warning(
            "Seeding with a placeholder password. "
            "Set DEFAULT_ADMIN_PASSWORD in your environment."
        )

    existing = db.query(models.Admin).filter(
        models.Admin.email == _DEFAULT_ADMIN_EMAIL
    ).first()
    if existing:
        return {"message": f"Admin already exists ({_DEFAULT_ADMIN_EMAIL})"}

    admin = models.Admin(
        email=_DEFAULT_ADMIN_EMAIL,
        password=auth.get_password_hash(_DEFAULT_ADMIN_PASSWORD),
        name="Platform Admin",
    )
    db.add(admin)
    db.commit()
    logger.info("Default admin seeded: %s", _DEFAULT_ADMIN_EMAIL)
    return {"message": f"Admin created — email: {_DEFAULT_ADMIN_EMAIL}"}


@router.get("/me", summary="Current admin profile")
def get_me(
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    """Return the authenticated admin's profile."""
    return {
        "id":         admin.id,
        "email":      admin.email,
        "name":       admin.name,
        "created_at": admin.created_at,
    }


@router.post("/change-password", summary="Change own password")
def change_password(
    data: ChangePasswordRequest,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    """Update the currently authenticated admin's password."""
    if not auth.verify_password(data.current_password, admin.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")

    db_admin = db.query(models.Admin).filter(models.Admin.id == admin.id).first()
    db_admin.password = auth.get_password_hash(data.new_password)
    db.commit()
    logger.info("Admin %s changed their password.", admin.email)
    return {"message": "Password updated successfully."}


@router.post("/create-admin", summary="Create an additional admin account")
def create_admin(
    data: CreateAdminRequest,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    """Create a new admin account.  Requires an existing valid session."""
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    existing = db.query(models.Admin).filter(models.Admin.email == data.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="An admin with that email already exists.")

    new_admin = models.Admin(
        email=data.email,
        password=auth.get_password_hash(data.password),
        name=data.name,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    logger.info("Admin %s created new admin account: %s", admin.email, data.email)
    return {
        "id":    new_admin.id,
        "email": new_admin.email,
        "name":  new_admin.name,
    }


@router.get("/admins", summary="List all admin accounts")
def list_admins(
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    """Return all admin accounts (passwords excluded)."""
    admins = db.query(models.Admin).order_by(models.Admin.id).all()
    return [
        {
            "id":         a.id,
            "email":      a.email,
            "name":       a.name,
            "created_at": a.created_at,
            "is_self":    a.id == admin.id,
        }
        for a in admins
    ]


@router.delete("/admins/{admin_id}", summary="Delete an admin account")
def delete_admin(
    admin_id: int,
    admin=Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db),
):
    """Delete an admin account.  An admin cannot delete their own account."""
    if admin_id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    target = db.query(models.Admin).filter(models.Admin.id == admin_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found.")

    db.delete(target)
    db.commit()
    logger.info("Admin %s deleted admin account id=%s (%s)", admin.email, admin_id, target.email)
    return {"message": f"Admin {target.email} deleted."}
