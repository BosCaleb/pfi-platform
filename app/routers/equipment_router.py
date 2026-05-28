"""Equipment Management — inventory, status tracking, and availability warnings."""
from datetime import datetime, timezone, date as date_type
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_admin
from app.models import EquipmentInventory

router = APIRouter(prefix="/api/equipment", tags=["equipment"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _equip_dict(e: EquipmentInventory) -> dict:
    return {
        "id": e.id, "equipment_name": e.equipment_name,
        "category": e.category, "quantity": e.quantity, "status": e.status,
        "location": e.location,
        "purchase_date": e.purchase_date.isoformat() if e.purchase_date else None,
        "maintenance_notes": e.maintenance_notes,
        "replacement_notes": e.replacement_notes,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


@router.get("/")
def list_equipment(
    status:   Optional[str] = None,
    category: Optional[str] = None,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    q = db.query(EquipmentInventory)
    if status:   q = q.filter(EquipmentInventory.status == status)
    if category: q = q.filter(EquipmentInventory.category == category)
    return [_equip_dict(e) for e in q.order_by(EquipmentInventory.equipment_name).all()]


@router.post("/", status_code=201)
def create_equipment(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    body.pop("id", None); body.pop("created_at", None); body.pop("updated_at", None)
    if body.get("purchase_date") and isinstance(body["purchase_date"], str):
        body["purchase_date"] = date_type.fromisoformat(body["purchase_date"])
    e = EquipmentInventory(**body)
    db.add(e); db.commit(); db.refresh(e)
    return _equip_dict(e)


@router.get("/unavailable")
def unavailable_equipment(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    items = db.query(EquipmentInventory).filter(
        EquipmentInventory.status.in_(["Maintenance", "Unavailable"])
    ).all()
    return [_equip_dict(e) for e in items]


@router.get("/{eid}")
def get_equipment(eid: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    e = db.query(EquipmentInventory).filter(EquipmentInventory.id == eid).first()
    if not e: raise HTTPException(404, "Equipment not found")
    return _equip_dict(e)


@router.put("/{eid}")
def update_equipment(eid: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    e = db.query(EquipmentInventory).filter(EquipmentInventory.id == eid).first()
    if not e: raise HTTPException(404, "Equipment not found")
    for k, v in body.items():
        if k not in ("id", "created_at") and hasattr(e, k):
            if k == "purchase_date" and isinstance(v, str):
                v = date_type.fromisoformat(v) if v else None
            setattr(e, k, v)
    e.updated_at = _utcnow(); db.commit(); db.refresh(e)
    return _equip_dict(e)


@router.delete("/{eid}", status_code=204)
def delete_equipment(eid: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    e = db.query(EquipmentInventory).filter(EquipmentInventory.id == eid).first()
    if not e: raise HTTPException(404, "Equipment not found")
    db.delete(e); db.commit()
