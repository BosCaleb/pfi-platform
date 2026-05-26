from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app import models, auth, database

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/stats")
def get_stats(db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    members = db.query(models.Member).all()
    total = len(members)
    active = sum(1 for m in members if m.status == "Active")
    now = datetime.now()
    new_this_month = sum(1 for m in members if m.registration_date and m.registration_date.month == now.month and m.registration_date.year == now.year)
    high_risk = sum(1 for m in members if m.risk_level == "High")

    goals, levels = {}, {}
    for m in members:
        goals[m.primary_goal] = goals.get(m.primary_goal, 0) + 1
        levels[m.fitness_level] = levels.get(m.fitness_level, 0) + 1

    recent = sorted(members, key=lambda m: m.registration_date or datetime.min, reverse=True)[:5]

    return {
        "total_members": total,
        "active_members": active,
        "new_this_month": new_this_month,
        "high_risk": high_risk,
        "by_goal": goals,
        "by_level": levels,
        "recent": [{"id": m.id, "name": f"{m.first_name} {m.last_name}", "goal": m.primary_goal, "level": m.fitness_level, "date": m.registration_date.isoformat() if m.registration_date else None, "risk": m.risk_level} for m in recent]
    }

@router.get("/reassessments")
def get_reassessments(db: Session = Depends(database.get_db), admin=Depends(auth.get_current_admin)):
    members = db.query(models.Member).all()
    result = []
    for m in members:
        if m.assessments:
            last = max(a.assessment_date for a in m.assessments)
            due = last + timedelta(days=30)
            if due <= datetime.now().date():
                result.append({"member_id": m.id, "name": f"{m.first_name} {m.last_name}", "last_assessment": last.isoformat(), "due_date": due.isoformat()})
    return result
