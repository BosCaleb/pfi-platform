"""Communications — messages + templates."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CommunicationMessage, MessageTemplate, Member, Admin
from app.auth import get_current_admin

router = APIRouter(prefix="/api/communications", tags=["communications"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _msg_dict(m: CommunicationMessage, db: Session) -> dict:
    member = db.query(Member).filter(Member.id == m.recipient_member_id).first() if m.recipient_member_id else None
    sender = db.query(Admin).filter(Admin.id == m.sender_admin_id).first() if m.sender_admin_id else None
    return {
        "id": m.id,
        "sender_admin_id": m.sender_admin_id,
        "sender_email": sender.email if sender else None,
        "recipient_member_id": m.recipient_member_id,
        "recipient_name": f"{member.first_name} {member.last_name}" if member else None,
        "recipient_group_id": m.recipient_group_id,
        "message_type": m.message_type,
        "subject": m.subject,
        "message_body": m.message_body,
        "visible_in_member_portal": m.visible_in_member_portal,
        "delivery_channel": m.delivery_channel,
        "message_status": m.message_status,
        "sent_at": m.sent_at.isoformat() if m.sent_at else None,
        "read_at": m.read_at.isoformat() if m.read_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def _tpl_dict(t: MessageTemplate) -> dict:
    return {
        "id": t.id,
        "template_name": t.template_name,
        "template_type": t.template_type,
        "subject": t.subject,
        "body": t.body,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


# ── Messages ────────────────────────────────────────────────────────────

@router.get("/messages")
def list_messages(
    member_id: Optional[int] = None,
    message_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(CommunicationMessage)
    if member_id:
        q = q.filter(CommunicationMessage.recipient_member_id == member_id)
    if message_type:
        q = q.filter(CommunicationMessage.message_type == message_type)
    if status:
        q = q.filter(CommunicationMessage.message_status == status)
    items = q.order_by(CommunicationMessage.sent_at.desc()).all()
    return [_msg_dict(m, db) for m in items]


@router.post("/messages", status_code=201)
def send_message(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    if not body.get("message_body"):
        raise HTTPException(400, "message_body is required")
    now = _utcnow()
    msg = CommunicationMessage(
        sender_admin_id=admin.id,
        recipient_member_id=body.get("recipient_member_id"),
        recipient_group_id=body.get("recipient_group_id"),
        message_type=body.get("message_type", "Direct Message"),
        subject=body.get("subject"),
        message_body=body["message_body"],
        visible_in_member_portal=body.get("visible_in_member_portal", True),
        delivery_channel=body.get("delivery_channel", "In-App"),
        message_status=body.get("message_status", "Sent"),
        sent_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _msg_dict(msg, db)


@router.patch("/messages/{msg_id}")
def update_message(msg_id: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    m = db.query(CommunicationMessage).filter(CommunicationMessage.id == msg_id).first()
    if not m:
        raise HTTPException(404, "Message not found")
    for k, v in body.items():
        if k not in ("id", "created_at", "sender_admin_id") and hasattr(m, k):
            setattr(m, k, v)
    if body.get("message_status") == "Read" and not m.read_at:
        m.read_at = _utcnow()
    m.updated_at = _utcnow()
    db.commit()
    db.refresh(m)
    return _msg_dict(m, db)


@router.delete("/messages/{msg_id}", status_code=204)
def delete_message(msg_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    m = db.query(CommunicationMessage).filter(CommunicationMessage.id == msg_id).first()
    if not m:
        raise HTTPException(404, "Message not found")
    db.delete(m)
    db.commit()


# ── Bulk send ───────────────────────────────────────────────────────────

@router.post("/messages/bulk", status_code=201)
def bulk_send(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    """Send the same message to multiple members."""
    member_ids = body.get("member_ids", [])
    if not member_ids:
        raise HTTPException(400, "member_ids list is required")
    if not body.get("message_body"):
        raise HTTPException(400, "message_body is required")
    now = _utcnow()
    created = []
    for mid in member_ids:
        msg = CommunicationMessage(
            sender_admin_id=admin.id,
            recipient_member_id=mid,
            message_type=body.get("message_type", "Announcement"),
            subject=body.get("subject"),
            message_body=body["message_body"],
            visible_in_member_portal=body.get("visible_in_member_portal", True),
            delivery_channel=body.get("delivery_channel", "In-App"),
            message_status="Sent",
            sent_at=now,
            created_at=now,
            updated_at=now,
        )
        db.add(msg)
        created.append(mid)
    db.commit()
    return {"sent_to": len(created), "member_ids": created}


# ── Templates ───────────────────────────────────────────────────────────

@router.get("/templates")
def list_templates(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    items = db.query(MessageTemplate).order_by(MessageTemplate.template_name).all()
    return [_tpl_dict(t) for t in items]


@router.post("/templates", status_code=201)
def create_template(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    if not body.get("template_name"):
        raise HTTPException(400, "template_name is required")
    body.pop("id", None)
    body.pop("created_at", None)
    body.pop("updated_at", None)
    t = MessageTemplate(**body)
    db.add(t)
    db.commit()
    db.refresh(t)
    return _tpl_dict(t)


@router.put("/templates/{tpl_id}")
def update_template(tpl_id: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    t = db.query(MessageTemplate).filter(MessageTemplate.id == tpl_id).first()
    if not t:
        raise HTTPException(404, "Template not found")
    for k, v in body.items():
        if k not in ("id", "created_at") and hasattr(t, k):
            setattr(t, k, v)
    t.updated_at = _utcnow()
    db.commit()
    db.refresh(t)
    return _tpl_dict(t)


@router.delete("/templates/{tpl_id}", status_code=204)
def delete_template(tpl_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    t = db.query(MessageTemplate).filter(MessageTemplate.id == tpl_id).first()
    if not t:
        raise HTTPException(404, "Template not found")
    db.delete(t)
    db.commit()
