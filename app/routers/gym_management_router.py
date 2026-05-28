"""Gym & Location Management — multi-gym scaling readiness."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_admin
from app.models import Gym, GymLocation

router = APIRouter(prefix="/api/gyms", tags=["gym-management"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _gym_dict(g: Gym) -> dict:
    return {
        "id": g.id,
        "gym_name": g.gym_name,
        "owner_name": g.owner_name,
        "contact_email": g.contact_email,
        "contact_phone": g.contact_phone,
        "subscription_plan": g.subscription_plan,
        "is_active": g.is_active,
        "created_at": g.created_at.isoformat() if g.created_at else None,
    }


def _location_dict(loc: GymLocation) -> dict:
    return {
        "id": loc.id,
        "gym_id": loc.gym_id,
        "location_name": loc.location_name,
        "address": loc.address,
        "city": loc.city,
        "country": loc.country,
        "is_active": loc.is_active,
        "created_at": loc.created_at.isoformat() if loc.created_at else None,
    }


# ── Gyms ───────────────────────────────────────────────────────────────

@router.get("/")
def list_gyms(
    is_active: Optional[bool] = None,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    q = db.query(Gym)
    if is_active is not None: q = q.filter(Gym.is_active == is_active)
    return [_gym_dict(g) for g in q.order_by(Gym.gym_name).all()]


@router.post("/", status_code=201)
def create_gym(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    gym_name = body.get("gym_name")
    if not gym_name:
        raise HTTPException(400, "gym_name required")
    g = Gym(
        gym_name          = gym_name,
        owner_name        = body.get("owner_name"),
        contact_email     = body.get("contact_email"),
        contact_phone     = body.get("contact_phone"),
        subscription_plan = body.get("subscription_plan", "Starter"),
        is_active         = body.get("is_active", True),
        created_at        = _utcnow(),
    )
    db.add(g); db.commit(); db.refresh(g)
    return _gym_dict(g)


@router.get("/{gid}")
def get_gym(gid: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    g = db.query(Gym).filter(Gym.id == gid).first()
    if not g: raise HTTPException(404, "Gym not found")
    return _gym_dict(g)


@router.put("/{gid}")
def update_gym(gid: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    g = db.query(Gym).filter(Gym.id == gid).first()
    if not g: raise HTTPException(404, "Gym not found")
    for k in ("gym_name", "owner_name", "contact_email", "contact_phone", "subscription_plan", "is_active"):
        if k in body: setattr(g, k, body[k])
    db.commit(); db.refresh(g)
    return _gym_dict(g)


@router.delete("/{gid}", status_code=204)
def delete_gym(gid: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    g = db.query(Gym).filter(Gym.id == gid).first()
    if not g: raise HTTPException(404, "Gym not found")
    db.delete(g); db.commit()


# ── Locations ──────────────────────────────────────────────────────────

@router.get("/{gid}/locations")
def list_locations(gid: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    g = db.query(Gym).filter(Gym.id == gid).first()
    if not g: raise HTTPException(404, "Gym not found")
    locs = db.query(GymLocation).filter(GymLocation.gym_id == gid).order_by(GymLocation.location_name).all()
    return [_location_dict(loc) for loc in locs]


@router.post("/{gid}/locations", status_code=201)
def create_location(gid: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    g = db.query(Gym).filter(Gym.id == gid).first()
    if not g: raise HTTPException(404, "Gym not found")
    loc = GymLocation(
        gym_id        = gid,
        location_name = body.get("location_name", "Main Branch"),
        address       = body.get("address"),
        city          = body.get("city"),
        country       = body.get("country", "South Africa"),
        is_active     = body.get("is_active", True),
        created_at    = _utcnow(),
    )
    db.add(loc); db.commit(); db.refresh(loc)
    return _location_dict(loc)


@router.get("/locations/all")
def list_all_locations(
    is_active: Optional[bool] = None,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    q = db.query(GymLocation)
    if is_active is not None: q = q.filter(GymLocation.is_active == is_active)
    return [_location_dict(loc) for loc in q.order_by(GymLocation.location_name).all()]


@router.put("/locations/{lid}")
def update_location(lid: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    loc = db.query(GymLocation).filter(GymLocation.id == lid).first()
    if not loc: raise HTTPException(404, "Location not found")
    for k in ("location_name", "address", "city", "country", "is_active"):
        if k in body: setattr(loc, k, body[k])
    db.commit(); db.refresh(loc)
    return _location_dict(loc)


@router.delete("/locations/{lid}", status_code=204)
def delete_location(lid: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    loc = db.query(GymLocation).filter(GymLocation.id == lid).first()
    if not loc: raise HTTPException(404, "Location not found")
    db.delete(loc); db.commit()
