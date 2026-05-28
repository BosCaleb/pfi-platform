"""Member Portal Authentication — login, registration, password management."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import (
    verify_password, get_password_hash,
    create_member_token, get_current_member, get_current_admin,
)
from app.models import Member

router = APIRouter(prefix="/api/member", tags=["member-portal-auth"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Pydantic schemas ───────────────────────────────────────────────────

class MemberLoginRequest(BaseModel):
    email: str
    password: str

class MemberRegisterRequest(BaseModel):
    email: str
    password: str
    confirm_password: str

class MemberChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

class AdminSetPasswordRequest(BaseModel):
    member_id: int
    password: str
    enable_portal: bool = True


# ── Public: Register / Login ───────────────────────────────────────────

@router.post("/register", status_code=201, summary="Member self-registration")
def member_register(body: MemberRegisterRequest, db: Session = Depends(get_db)):
    """
    A member registers for portal access using the email address already
    on file (created by admin during intake). Admin must have enabled portal
    access for this member first (portal_enabled=True), or the member will
    receive an error directing them to contact their coach.
    """
    if body.password != body.confirm_password:
        raise HTTPException(400, "Passwords do not match")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    member = db.query(Member).filter(Member.email == body.email).first()
    if not member:
        # Deliberately vague — don't reveal whether email exists
        raise HTTPException(400, "No account found for this email. Contact your coach to set up portal access.")

    if not member.portal_enabled:
        raise HTTPException(403, "Portal access has not been enabled for this account. Please contact your coach.")

    if member.portal_password:
        raise HTTPException(409, "Portal account already exists. Use login or contact your coach to reset your password.")

    member.portal_password = get_password_hash(body.password)
    db.commit()
    return {"message": "Portal account created. You can now log in."}


@router.post("/login", summary="Member portal login")
def member_login(body: MemberLoginRequest, db: Session = Depends(get_db)):
    member = db.query(Member).filter(Member.email == body.email).first()
    if not member or not member.portal_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not member.portal_enabled:
        raise HTTPException(403, "Portal access is currently disabled for your account.")
    if not verify_password(body.password, member.portal_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    member.portal_last_login = _utcnow()
    db.commit()

    token = create_member_token(member.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "member": {
            "id": member.id,
            "first_name": member.first_name,
            "last_name": member.last_name,
            "email": member.email,
            "primary_goal": member.primary_goal,
            "fitness_level": member.fitness_level,
        },
    }


# ── Authenticated member endpoints ────────────────────────────────────

@router.get("/me", summary="Current member profile")
def member_me(member: Member = Depends(get_current_member)):
    return {
        "id": member.id,
        "first_name": member.first_name,
        "last_name": member.last_name,
        "email": member.email,
        "phone": member.phone,
        "gender": member.gender,
        "date_of_birth": member.date_of_birth.isoformat() if member.date_of_birth else None,
        "primary_goal": member.primary_goal,
        "fitness_level": member.fitness_level,
        "status": member.status,
        "registration_date": member.registration_date.isoformat() if member.registration_date else None,
        "portal_last_login": member.portal_last_login.isoformat() if member.portal_last_login else None,
    }


@router.post("/change-password", summary="Member changes their own password")
def member_change_password(
    body: MemberChangePasswordRequest,
    member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    if body.new_password != body.confirm_password:
        raise HTTPException(400, "New passwords do not match")
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if not verify_password(body.current_password, member.portal_password or ""):
        raise HTTPException(400, "Current password is incorrect")
    member.portal_password = get_password_hash(body.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


# ── Admin-only: manage member portal access ───────────────────────────

@router.post("/admin/set-password", summary="Admin sets or resets a member's portal password")
def admin_set_member_password(
    body: AdminSetPasswordRequest,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    """Admin sets a member's initial portal password and optionally enables access."""
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    member = db.query(Member).filter(Member.id == body.member_id).first()
    if not member:
        raise HTTPException(404, "Member not found")
    member.portal_password = get_password_hash(body.password)
    if body.enable_portal:
        member.portal_enabled = True
    db.commit()
    return {
        "message": f"Portal password set for {member.first_name} {member.last_name}",
        "portal_enabled": member.portal_enabled,
    }


@router.post("/admin/toggle-access/{member_id}", summary="Admin enables or disables portal access")
def admin_toggle_portal_access(
    member_id: int,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(404, "Member not found")
    member.portal_enabled = not member.portal_enabled
    db.commit()
    state = "enabled" if member.portal_enabled else "disabled"
    return {"message": f"Portal access {state} for {member.first_name} {member.last_name}", "portal_enabled": member.portal_enabled}


@router.get("/admin/portal-status", summary="List all members with portal access status")
def admin_portal_status(db: Session = Depends(get_db), admin = Depends(get_current_admin)):
    members = db.query(Member).order_by(Member.first_name).all()
    return [
        {
            "id": m.id,
            "name": f"{m.first_name} {m.last_name}",
            "email": m.email,
            "portal_enabled": m.portal_enabled,
            "has_password": bool(m.portal_password),
            "portal_last_login": m.portal_last_login.isoformat() if m.portal_last_login else None,
        }
        for m in members
    ]
