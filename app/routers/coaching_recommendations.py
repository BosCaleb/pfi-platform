"""
Coaching Recommendations router — Phase 3.2
Handles rule-based recommendation generation, listing, detail and status updates.
"""
import json
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_admin
from app import models
from app.recommendation_engine import generate_for_member

router = APIRouter(prefix="/api/coaching-recommendations", tags=["coaching-recommendations"])


def _rec_to_dict(r: models.CoachingRecommendation) -> dict:
    data = {c.name: getattr(r, c.name) for c in r.__table__.columns}
    try:
        data["supporting_data"] = json.loads(r.supporting_data_json) if r.supporting_data_json else {}
    except Exception:
        data["supporting_data"] = {}
    return data


# ── Dashboard summary ─────────────────────────────────────────────────────────

@router.get("/dashboard")
def recommendations_dashboard(
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    total     = db.query(models.CoachingRecommendation).count()
    approved  = db.query(models.CoachingRecommendation).filter(
        models.CoachingRecommendation.status == "Approved").count()
    critical  = db.query(models.CoachingRecommendation).filter(
        models.CoachingRecommendation.severity == "Critical",
        models.CoachingRecommendation.status.notin_(["Rejected", "Archived", "Applied"])).count()
    safety    = db.query(models.CoachingRecommendation).filter(
        models.CoachingRecommendation.recommendation_type == "Safety Review",
        models.CoachingRecommendation.status.notin_(["Rejected", "Archived"])).count()
    progress  = db.query(models.CoachingRecommendation).filter(
        models.CoachingRecommendation.recommendation_type == "Workout Progression",
        models.CoachingRecommendation.status == "Approved").count()
    deload    = db.query(models.CoachingRecommendation).filter(
        models.CoachingRecommendation.recommendation_type == "Deload",
        models.CoachingRecommendation.status == "Approved").count()
    applied   = db.query(models.CoachingRecommendation).filter(
        models.CoachingRecommendation.status == "Applied").count()
    return {
        "total": total,
        "approved": approved,
        "critical": critical,
        "safety_reviews": safety,
        "progression_ready": progress,
        "deload_recommended": deload,
        "applied": applied,
    }


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/")
def list_recommendations(
    member_id:   Optional[int] = Query(None),
    rec_type:    Optional[str] = Query(None, alias="type"),
    severity:    Optional[str] = Query(None),
    status:      Optional[str] = Query(None),
    generated_by:Optional[str] = Query(None),
    limit:       int = Query(200, le=500),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    q = db.query(models.CoachingRecommendation)
    if member_id:   q = q.filter(models.CoachingRecommendation.member_id == member_id)
    if rec_type:    q = q.filter(models.CoachingRecommendation.recommendation_type == rec_type)
    if severity:    q = q.filter(models.CoachingRecommendation.severity == severity)
    if status:      q = q.filter(models.CoachingRecommendation.status == status)
    if generated_by:q = q.filter(models.CoachingRecommendation.generated_by == generated_by)
    recs = q.order_by(models.CoachingRecommendation.created_at.desc()).limit(limit).all()
    return [_rec_to_dict(r) for r in recs]


# ── Generate for member ───────────────────────────────────────────────────────

@router.post("/generate/{member_id}")
def generate_recommendations(
    member_id: int,
    db: Session = Depends(get_db),
    admin: models.Admin = Depends(get_current_admin),
):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    created = generate_for_member(member_id, db)
    return {
        "generated": len(created),
        "recommendations": [_rec_to_dict(r) for r in created],
        "message": (
            f"{len(created)} recommendation(s) generated."
            if created
            else "No new recommendations — all rules satisfied or already recent."
        ),
    }


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{rec_id}")
def get_recommendation(
    rec_id: int,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    r = db.query(models.CoachingRecommendation).filter(
        models.CoachingRecommendation.id == rec_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return _rec_to_dict(r)


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{rec_id}")
def update_recommendation(
    rec_id: int,
    body: dict,
    db: Session = Depends(get_db),
    admin: models.Admin = Depends(get_current_admin),
):
    r = db.query(models.CoachingRecommendation).filter(
        models.CoachingRecommendation.id == rec_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    allowed = {
        "status", "admin_edit_notes", "rejection_reason",
        "severity", "title", "summary", "detailed_reason",
    }
    for k, v in body.items():
        if k in allowed:
            setattr(r, k, v)

    if body.get("status") in ("Approved", "Rejected", "Applied", "Archived"):
        setattr(r, "reviewed_by_admin_id", admin.id)
        setattr(r, "reviewed_at", datetime.now(tz=timezone.utc))

        # Audit trail
        action = models.RecommendationAction(
            recommendation_id=rec_id,
            admin_id=admin.id,
            action_type=body["status"],
            action_notes=body.get("admin_edit_notes") or body.get("rejection_reason") or "",
        )
        db.add(action)

    db.commit()
    db.refresh(r)
    return _rec_to_dict(r)


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{rec_id}")
def delete_recommendation(
    rec_id: int,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    r = db.query(models.CoachingRecommendation).filter(
        models.CoachingRecommendation.id == rec_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(r)
    db.commit()
    return {"deleted": rec_id}
