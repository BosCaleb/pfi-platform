"""Member Memberships — assign, manage status, sessions remaining."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MemberMembership, Member, MembershipPackage
from app.auth import get_current_admin

router = APIRouter(prefix="/api/member-memberships", tags=["member-memberships"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _mem_dict(m: MemberMembership, db: Session) -> dict:
    member = db.query(Member).filter(Member.id == m.member_id).first()
    pkg = db.query(MembershipPackage).filter(MembershipPackage.id == m.membership_package_id).first() if m.membership_package_id else None
    return {
        "id": m.id,
        "member_id": m.member_id,
        "member_name": f"{member.first_name} {member.last_name}" if member else None,
        "membership_package_id": m.membership_package_id,
        "package_name": pkg.package_name if pkg else None,
        "package_price": pkg.price if pkg else None,
        "start_date": m.start_date.isoformat() if m.start_date else None,
        "end_date": m.end_date.isoformat() if m.end_date else None,
        "renewal_date": m.renewal_date.isoformat() if m.renewal_date else None,
        "membership_status": m.membership_status,
        "payment_status": m.payment_status,
        "sessions_remaining": m.sessions_remaining,
        "auto_renew": m.auto_renew,
        "cancellation_reason": m.cancellation_reason,
        "pause_reason": m.pause_reason,
        "admin_notes": m.admin_notes,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


@router.get("/")
def list_memberships(
    member_id: Optional[int] = None,
    membership_status: Optional[str] = None,
    payment_status: Optional[str] = None,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(MemberMembership)
    if member_id:
        q = q.filter(MemberMembership.member_id == member_id)
    if membership_status:
        q = q.filter(MemberMembership.membership_status == membership_status)
    if payment_status:
        q = q.filter(MemberMembership.payment_status == payment_status)
    items = q.order_by(MemberMembership.created_at.desc()).all()
    return [_mem_dict(m, db) for m in items]


@router.post("/", status_code=201)
def create_membership(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    member_id = body.get("member_id")
    if not member_id:
        raise HTTPException(400, "member_id is required")
    if not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(404, "Member not found")
    body.pop("id", None)
    body.pop("created_at", None)
    body.pop("updated_at", None)
    # parse date strings
    for date_field in ("start_date", "end_date", "renewal_date"):
        if body.get(date_field) and isinstance(body[date_field], str):
            from datetime import date
            body[date_field] = date.fromisoformat(body[date_field])
    mem = MemberMembership(**body)
    db.add(mem)
    db.commit()
    db.refresh(mem)
    return _mem_dict(mem, db)


@router.get("/{mem_id}")
def get_membership(mem_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    m = db.query(MemberMembership).filter(MemberMembership.id == mem_id).first()
    if not m:
        raise HTTPException(404, "Membership not found")
    return _mem_dict(m, db)


@router.put("/{mem_id}")
def update_membership(mem_id: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    m = db.query(MemberMembership).filter(MemberMembership.id == mem_id).first()
    if not m:
        raise HTTPException(404, "Membership not found")
    for k, v in body.items():
        if k not in ("id", "created_at", "updated_at", "member_id") and hasattr(m, k):
            if k in ("start_date", "end_date", "renewal_date") and isinstance(v, str):
                from datetime import date
                v = date.fromisoformat(v) if v else None
            setattr(m, k, v)
    m.updated_at = _utcnow()
    db.commit()
    db.refresh(m)
    return _mem_dict(m, db)


@router.delete("/{mem_id}", status_code=204)
def delete_membership(mem_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    m = db.query(MemberMembership).filter(MemberMembership.id == mem_id).first()
    if not m:
        raise HTTPException(404, "Membership not found")
    db.delete(m)
    db.commit()


@router.post("/{mem_id}/deduct-session")
def deduct_session(mem_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    """Decrement sessions_remaining by 1 for session-pack memberships."""
    m = db.query(MemberMembership).filter(MemberMembership.id == mem_id).first()
    if not m:
        raise HTTPException(404, "Membership not found")
    if m.sessions_remaining is None:
        raise HTTPException(400, "This membership does not track session credits")
    if m.sessions_remaining <= 0:
        raise HTTPException(400, "No sessions remaining")
    m.sessions_remaining = m.sessions_remaining - 1
    m.updated_at = _utcnow()
    db.commit()
    return {"sessions_remaining": m.sessions_remaining}
