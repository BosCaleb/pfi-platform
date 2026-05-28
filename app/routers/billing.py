"""Billing — Invoices, Payments, Billing Dashboard."""
from datetime import datetime, timezone, date as date_type
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from app.database import get_db
from app.models import Invoice, Payment, Member, MembershipPackage, GymSettings
from app.auth import get_current_admin

router = APIRouter(prefix="/api/billing", tags=["billing"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _today():
    return datetime.now(timezone.utc).date()


# ── Invoice number generator ────────────────────────────────────────────

def _next_invoice_number(db: Session) -> str:
    settings = db.query(GymSettings).first()
    prefix = (settings.invoice_prefix if settings and settings.invoice_prefix else "INV")
    year = _today().year
    # Count invoices this year
    count = (
        db.query(func.count(Invoice.id))
        .filter(Invoice.invoice_number.like(f"{prefix}-{year}-%"))
        .scalar() or 0
    )
    return f"{prefix}-{year}-{count + 1:04d}"


# ── Serialisers ─────────────────────────────────────────────────────────

def _inv_dict(inv: Invoice, db: Session) -> dict:
    member = db.query(Member).filter(Member.id == inv.member_id).first()
    pkg = db.query(MembershipPackage).filter(MembershipPackage.id == inv.membership_package_id).first() if inv.membership_package_id else None
    payments = db.query(Payment).filter(Payment.invoice_id == inv.id).all()
    return {
        "id": inv.id,
        "member_id": inv.member_id,
        "member_name": f"{member.first_name} {member.last_name}" if member else None,
        "membership_package_id": inv.membership_package_id,
        "package_name": pkg.package_name if pkg else None,
        "invoice_number": inv.invoice_number,
        "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "amount_due": inv.amount_due,
        "amount_paid": inv.amount_paid or 0,
        "balance_due": inv.balance_due,
        "invoice_status": inv.invoice_status,
        "payment_method": inv.payment_method,
        "payment_reference": inv.payment_reference,
        "admin_notes": inv.admin_notes,
        "payments": [_pay_dict(p) for p in payments],
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
    }


def _pay_dict(p: Payment) -> dict:
    return {
        "id": p.id,
        "invoice_id": p.invoice_id,
        "member_id": p.member_id,
        "payment_date": p.payment_date.isoformat() if p.payment_date else None,
        "amount": p.amount,
        "payment_method": p.payment_method,
        "payment_reference": p.payment_reference,
        "notes": p.notes,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


# ── Dashboard ───────────────────────────────────────────────────────────

@router.get("/dashboard")
def billing_dashboard(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    today = _today()
    month_start = today.replace(day=1)

    # Revenue this month (paid payments)
    revenue_month = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.payment_date >= month_start)
        .scalar() or 0
    )

    # Outstanding (balance_due > 0, status not Paid/Cancelled)
    outstanding_q = db.query(Invoice).filter(
        Invoice.invoice_status.in_(["Sent", "Overdue", "Partially Paid", "Draft"])
    )
    outstanding_invoices = outstanding_q.all()
    outstanding_amount = sum((i.balance_due or 0) for i in outstanding_invoices)

    # Overdue count
    overdue_count = db.query(func.count(Invoice.id)).filter(
        Invoice.invoice_status == "Overdue"
    ).scalar() or 0

    # Paid this month count
    paid_month = (
        db.query(func.count(Invoice.id))
        .filter(Invoice.invoice_status == "Paid", Invoice.invoice_date >= month_start)
        .scalar() or 0
    )

    # Draft invoices
    draft_count = db.query(func.count(Invoice.id)).filter(Invoice.invoice_status == "Draft").scalar() or 0

    # Total outstanding invoices
    outstanding_count = len(outstanding_invoices)

    # Recent payments (last 10)
    recent_payments = (
        db.query(Payment).order_by(Payment.created_at.desc()).limit(10).all()
    )

    return {
        "revenue_this_month": round(revenue_month, 2),
        "outstanding_amount": round(outstanding_amount, 2),
        "outstanding_count": outstanding_count,
        "overdue_count": overdue_count,
        "paid_this_month": paid_month,
        "draft_count": draft_count,
        "recent_payments": [_pay_dict(p) for p in recent_payments],
    }


# ── Invoice CRUD ────────────────────────────────────────────────────────

@router.get("/invoices")
def list_invoices(
    member_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(Invoice)
    if member_id:
        q = q.filter(Invoice.member_id == member_id)
    if status:
        q = q.filter(Invoice.invoice_status == status)
    items = q.order_by(Invoice.created_at.desc()).all()
    return [_inv_dict(i, db) for i in items]


@router.post("/invoices", status_code=201)
def create_invoice(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    if not body.get("member_id"):
        raise HTTPException(400, "member_id is required")
    if not db.query(Member).filter(Member.id == body["member_id"]).first():
        raise HTTPException(404, "Member not found")

    body.pop("id", None)
    body.pop("created_at", None)
    body.pop("updated_at", None)

    # Auto-generate invoice number if not provided
    if not body.get("invoice_number"):
        body["invoice_number"] = _next_invoice_number(db)

    # Parse dates
    for df in ("invoice_date", "due_date"):
        if body.get(df) and isinstance(body[df], str):
            body[df] = date_type.fromisoformat(body[df])

    amount_due = float(body.get("amount_due", 0))
    amount_paid = float(body.get("amount_paid", 0))
    body["balance_due"] = amount_due - amount_paid

    inv = Invoice(**body)
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return _inv_dict(inv, db)


@router.get("/invoices/{inv_id}")
def get_invoice(inv_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    inv = db.query(Invoice).filter(Invoice.id == inv_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return _inv_dict(inv, db)


@router.put("/invoices/{inv_id}")
def update_invoice(inv_id: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    inv = db.query(Invoice).filter(Invoice.id == inv_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    for k, v in body.items():
        if k not in ("id", "created_at", "updated_at", "member_id", "invoice_number") and hasattr(inv, k):
            if k in ("invoice_date", "due_date") and isinstance(v, str):
                v = date_type.fromisoformat(v) if v else None
            setattr(inv, k, v)
    # recalculate balance
    inv.balance_due = (inv.amount_due or 0) - (inv.amount_paid or 0)
    inv.updated_at = _utcnow()
    db.commit()
    db.refresh(inv)
    return _inv_dict(inv, db)


@router.delete("/invoices/{inv_id}", status_code=204)
def delete_invoice(inv_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    inv = db.query(Invoice).filter(Invoice.id == inv_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    db.delete(inv)
    db.commit()


# ── Payment recording ───────────────────────────────────────────────────

@router.post("/payments", status_code=201)
def record_payment(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    inv_id = body.get("invoice_id")
    if not inv_id:
        raise HTTPException(400, "invoice_id is required")
    inv = db.query(Invoice).filter(Invoice.id == inv_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")

    amount = float(body.get("amount", 0))
    if amount <= 0:
        raise HTTPException(400, "Amount must be positive")

    pay_date = body.get("payment_date")
    if pay_date and isinstance(pay_date, str):
        pay_date = date_type.fromisoformat(pay_date)
    else:
        pay_date = _today()

    payment = Payment(
        invoice_id=inv_id,
        member_id=inv.member_id,
        payment_date=pay_date,
        amount=amount,
        payment_method=body.get("payment_method"),
        payment_reference=body.get("payment_reference"),
        recorded_by_admin_id=admin.id,
        notes=body.get("notes"),
        created_at=_utcnow(),
    )
    db.add(payment)

    # Update invoice
    inv.amount_paid = (inv.amount_paid or 0) + amount
    inv.balance_due = (inv.amount_due or 0) - inv.amount_paid
    if inv.balance_due <= 0:
        inv.invoice_status = "Paid"
        inv.balance_due = 0
    else:
        inv.invoice_status = "Partially Paid"
    inv.updated_at = _utcnow()

    db.commit()
    db.refresh(payment)
    return _pay_dict(payment)


@router.get("/payments")
def list_payments(
    member_id: Optional[int] = None,
    invoice_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(Payment)
    if member_id:
        q = q.filter(Payment.member_id == member_id)
    if invoice_id:
        q = q.filter(Payment.invoice_id == invoice_id)
    items = q.order_by(Payment.created_at.desc()).all()
    return [_pay_dict(p) for p in items]


@router.delete("/payments/{pay_id}", status_code=204)
def delete_payment(pay_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    p = db.query(Payment).filter(Payment.id == pay_id).first()
    if not p:
        raise HTTPException(404, "Payment not found")
    # Reverse the invoice update
    inv = db.query(Invoice).filter(Invoice.id == p.invoice_id).first()
    if inv:
        inv.amount_paid = max(0, (inv.amount_paid or 0) - p.amount)
        inv.balance_due = (inv.amount_due or 0) - inv.amount_paid
        if inv.balance_due > 0 and inv.invoice_status in ("Paid",):
            inv.invoice_status = "Partially Paid"
        inv.updated_at = _utcnow()
    db.delete(p)
    db.commit()
