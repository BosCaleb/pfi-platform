"""Membership Packages — CRUD + stats."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import MembershipPackage, MemberMembership
from app.auth import get_current_admin

router = APIRouter(prefix="/api/membership-packages", tags=["membership-packages"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Helpers ────────────────────────────────────────────────────────────

def _pkg_dict(p: MembershipPackage) -> dict:
    return {
        "id": p.id,
        "package_name": p.package_name,
        "package_type": p.package_type,
        "price": p.price,
        "billing_frequency": p.billing_frequency,
        "sessions_per_week": p.sessions_per_week,
        "sessions_per_month": p.sessions_per_month,
        "total_sessions_in_pack": p.total_sessions_in_pack,
        "includes_workout_plan": p.includes_workout_plan,
        "includes_nutrition_guidance": p.includes_nutrition_guidance,
        "includes_supplement_guidance": p.includes_supplement_guidance,
        "includes_member_portal": p.includes_member_portal,
        "includes_reassessments": p.includes_reassessments,
        "package_status": p.package_status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


# ── Routes ─────────────────────────────────────────────────────────────

@router.get("/")
def list_packages(
    status: Optional[str] = None,
    package_type: Optional[str] = None,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(MembershipPackage)
    if status:
        q = q.filter(MembershipPackage.package_status == status)
    if package_type:
        q = q.filter(MembershipPackage.package_type == package_type)
    pkgs = q.order_by(MembershipPackage.package_name).all()
    # add member count
    result = []
    for p in pkgs:
        d = _pkg_dict(p)
        d["active_member_count"] = (
            db.query(func.count(MemberMembership.id))
            .filter(
                MemberMembership.membership_package_id == p.id,
                MemberMembership.membership_status == "Active",
            )
            .scalar() or 0
        )
        result.append(d)
    return result


@router.post("/", status_code=201)
def create_package(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    body.pop("id", None)
    body.pop("created_at", None)
    body.pop("updated_at", None)
    pkg = MembershipPackage(**body)
    db.add(pkg)
    db.commit()
    db.refresh(pkg)
    return _pkg_dict(pkg)


@router.get("/{pkg_id}")
def get_package(pkg_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    pkg = db.query(MembershipPackage).filter(MembershipPackage.id == pkg_id).first()
    if not pkg:
        raise HTTPException(404, "Package not found")
    return _pkg_dict(pkg)


@router.put("/{pkg_id}")
def update_package(pkg_id: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    pkg = db.query(MembershipPackage).filter(MembershipPackage.id == pkg_id).first()
    if not pkg:
        raise HTTPException(404, "Package not found")
    for k, v in body.items():
        if k not in ("id", "created_at", "updated_at") and hasattr(pkg, k):
            setattr(pkg, k, v)
    pkg.updated_at = _utcnow()
    db.commit()
    db.refresh(pkg)
    return _pkg_dict(pkg)


@router.delete("/{pkg_id}", status_code=204)
def delete_package(pkg_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    pkg = db.query(MembershipPackage).filter(MembershipPackage.id == pkg_id).first()
    if not pkg:
        raise HTTPException(404, "Package not found")
    db.delete(pkg)
    db.commit()
