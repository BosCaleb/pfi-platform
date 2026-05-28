"""
AI Coaching Insights router — Phase 3.2
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_admin
from app import models
from app.ai_copilot import generate_insight

router = APIRouter(prefix="/api/ai-insights", tags=["ai-insights"])


def _insight_to_dict(i: models.AiCoachingInsight) -> dict:
    data = {c.name: getattr(i, c.name) for c in i.__table__.columns}
    try:
        data["source_data"] = json.loads(i.source_data_json) if i.source_data_json else {}
    except Exception:
        data["source_data"] = {}
    return data


@router.post("/generate/{member_id}")
def generate_ai_insight(
    member_id: int,
    db: Session = Depends(get_db),
    admin: models.Admin = Depends(get_current_admin),
):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    insight = generate_insight(member_id=member_id, db=db, admin_id=admin.id)
    return _insight_to_dict(insight)


@router.get("/")
def list_insights(
    member_id: Optional[int] = Query(None),
    status:    Optional[str] = Query(None),
    limit:     int = Query(50, le=200),
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    q = db.query(models.AiCoachingInsight)
    if member_id: q = q.filter(models.AiCoachingInsight.member_id == member_id)
    if status:    q = q.filter(models.AiCoachingInsight.status == status)
    insights = q.order_by(models.AiCoachingInsight.generated_at.desc()).limit(limit).all()
    return [_insight_to_dict(i) for i in insights]


@router.get("/{insight_id}")
def get_insight(
    insight_id: int,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    i = db.query(models.AiCoachingInsight).filter(
        models.AiCoachingInsight.id == insight_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Insight not found")
    return _insight_to_dict(i)


@router.patch("/{insight_id}")
def update_insight(
    insight_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: models.Admin = Depends(get_current_admin),
):
    i = db.query(models.AiCoachingInsight).filter(
        models.AiCoachingInsight.id == insight_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Insight not found")
    for k in ("status", "admin_feedback"):
        if k in body:
            setattr(i, k, body[k])
    db.commit()
    db.refresh(i)
    return _insight_to_dict(i)
