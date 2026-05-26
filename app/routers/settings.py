from fastapi import APIRouter, Depends
from app import auth
from app.config import admin_seed_enabled

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/public")
def public_settings():
    return {
        "platform_name": "Personalized Fitness Intelligence Platform",
        "short_name": "PFI Platform",
        "admin_seed_enabled": admin_seed_enabled(),
    }


@router.get("/")
def admin_settings(admin=Depends(auth.get_current_admin)):
    return {
        "platform_name": "Personalized Fitness Intelligence Platform",
        "short_name": "PFI Platform",
        "admin_email": admin.email,
        "admin_seed_enabled": admin_seed_enabled(),
        "member_login_enabled": False,
        "ai_recommendations_enabled": False,
    }
