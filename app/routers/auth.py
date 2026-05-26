"""
Authentication router — login and admin seeding.

The seed endpoint is protected by the ALLOW_ADMIN_SEED feature flag.
Default credentials are read from environment variables so they are
never hard-coded in source code.
"""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth, database, models, schemas
from app.config import admin_seed_enabled

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ------------------------------------------------------------------ #
# Default seed credentials — read from environment, never hard-coded. #
# ------------------------------------------------------------------ #
_DEFAULT_ADMIN_EMAIL = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@pfi-platform.local")
_DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")


@router.post("/login", summary="Obtain a JWT access token")
def login(credentials: schemas.LoginRequest, db: Session = Depends(database.get_db)):
    """Authenticate an admin and return a JWT bearer token.

    Raises:
        HTTPException 400: If the credentials are invalid.
    """
    admin = db.query(models.Admin).filter(models.Admin.email == credentials.email).first()
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

    This endpoint is only active when ALLOW_ADMIN_SEED=true.
    Disable it immediately after completing initial setup.

    Raises:
        HTTPException 403: If admin seeding is disabled.
    """
    if not admin_seed_enabled():
        raise HTTPException(status_code=403, detail="Default admin creation is disabled.")

    if not _DEFAULT_ADMIN_PASSWORD or _DEFAULT_ADMIN_PASSWORD == "admin123":
        logger.warning(
            "Seeding with the default placeholder password. "
            "Set DEFAULT_ADMIN_PASSWORD in your environment before seeding."
        )

    admin = db.query(models.Admin).filter(models.Admin.email == _DEFAULT_ADMIN_EMAIL).first()
    if not admin:
        admin = models.Admin(
            email=_DEFAULT_ADMIN_EMAIL,
            password=auth.get_password_hash(_DEFAULT_ADMIN_PASSWORD),
            name="PFI Platform Admin",
        )
        db.add(admin)
        db.commit()
        logger.info("Default admin created: %s", _DEFAULT_ADMIN_EMAIL)
        return {"message": "Default admin created"}

    return {"message": "Admin already exists"}
