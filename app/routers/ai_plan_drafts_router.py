"""AI-Assisted Plan Generation — draft workout plans requiring admin review."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_admin
from app.models import AiGeneratedPlanDraft, Member, WorkoutPlan, WorkoutSession, MemberCheckIn, ReadinessScore, Assessment

router = APIRouter(prefix="/api/ai-plans", tags=["ai-plan-drafts"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _draft_dict(d: AiGeneratedPlanDraft, db: Session) -> dict:
    m = db.query(Member).filter(Member.id == d.member_id).first()
    return {
        "id": d.id,
        "member_id": d.member_id,
        "member_name": f"{m.first_name} {m.last_name}" if m else None,
        "plan_type": d.plan_type,
        "draft_content": d.draft_content,
        "rationale": d.rationale,
        "status": d.status,
        "admin_notes": d.admin_notes,
        "approved_plan_id": d.approved_plan_id,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "reviewed_at": d.reviewed_at.isoformat() if d.reviewed_at else None,
    }


def _generate_plan_draft(member_id: int, plan_type: str, db: Session) -> tuple[str, str]:
    """Generate a structured draft workout plan from member data."""
    m = db.query(Member).filter(Member.id == member_id).first()
    if not m:
        return "", ""

    goal      = m.primary_goal or "General Fitness"
    level     = m.fitness_level or "Intermediate"
    name      = f"{m.first_name} {m.last_name}"

    # Pull recent context
    sessions  = db.query(WorkoutSession).filter(
        WorkoutSession.member_id == member_id,
        WorkoutSession.completion_status == "Completed",
    ).order_by(WorkoutSession.session_date.desc()).limit(20).all()
    total_done = len(sessions)
    avg_comp   = round(sum(s.completion_percentage or 0 for s in sessions) / max(total_done, 1), 1)

    recent_checkin = db.query(MemberCheckIn).filter(
        MemberCheckIn.member_id == member_id
    ).order_by(MemberCheckIn.check_in_date.desc()).first()

    readiness_avg = None
    r_scores = db.query(ReadinessScore).filter(
        ReadinessScore.member_id == member_id
    ).order_by(ReadinessScore.created_at.desc()).limit(7).all()
    if r_scores:
        readiness_avg = round(sum(r.score for r in r_scores) / len(r_scores), 1)

    latest_assess = db.query(Assessment).filter(
        Assessment.member_id == member_id
    ).order_by(Assessment.assessment_date.desc()).first()

    # Determine training parameters
    if level == "Beginner":
        days_per_week, intensity, volume = 3, "Low-Moderate", "2–3 sets × 10–12 reps"
    elif level == "Advanced":
        days_per_week, intensity, volume = 5, "High", "4–5 sets × 5–8 reps"
    else:
        days_per_week, intensity, volume = 4, "Moderate-High", "3–4 sets × 8–10 reps"

    if avg_comp < 60:
        days_per_week = max(days_per_week - 1, 2)
        intensity = "Moderate"

    # Build day structure based on goal
    if goal in ("Weight Loss", "Fat Loss"):
        structure = [
            ("Day 1 – Full Body Strength A", ["Goblet Squat", "Push-Up / Bench Press", "Dumbbell Row", "Plank"]),
            ("Day 2 – Cardio / HIIT", ["Interval Treadmill (20 min)", "Battle Ropes", "Box Step-Ups", "Jump Rope"]),
            ("Day 3 – Rest / Active Recovery", ["Light Walk (30 min)", "Stretching"]),
            ("Day 4 – Full Body Strength B", ["Romanian Deadlift", "Dumbbell Shoulder Press", "Cable Row", "Bicycle Crunches"]),
            ("Day 5 – Cardio / Conditioning", ["Rowing Machine (20 min)", "Kettlebell Swings", "Mountain Climbers"]),
        ][:days_per_week]
    elif goal in ("Muscle Gain", "Strength"):
        structure = [
            ("Day 1 – Chest & Triceps", ["Bench Press", "Incline Dumbbell Press", "Cable Fly", "Tricep Pushdown", "Skull Crushers"]),
            ("Day 2 – Back & Biceps", ["Deadlift", "Pull-Up / Lat Pulldown", "Seated Cable Row", "Barbell Curl", "Hammer Curl"]),
            ("Day 3 – Legs", ["Squat", "Leg Press", "Romanian Deadlift", "Leg Curl", "Calf Raise"]),
            ("Day 4 – Shoulders & Core", ["Overhead Press", "Lateral Raise", "Face Pull", "Plank", "Cable Woodchop"]),
            ("Day 5 – Arms & Conditioning", ["Close-Grip Bench", "Preacher Curl", "Dip", "Concentration Curl", "Farmer's Carry"]),
        ][:days_per_week]
    else:  # General Fitness / Endurance
        structure = [
            ("Day 1 – Total Body Circuit", ["Squat to Press", "Renegade Row", "Burpee", "Plank Hold (60s)"]),
            ("Day 2 – Cardio Endurance", ["Treadmill 35 min (Zone 2)", "Core Circuit"]),
            ("Day 3 – Functional Strength", ["Deadlift", "Push-Up", "TRX Row", "Lateral Lunge", "Russian Twist"]),
            ("Day 4 – Active Recovery / Mobility", ["Yoga Flow (30 min)", "Foam Rolling"]),
        ][:days_per_week]

    # Build draft content
    lines = [
        f"# {plan_type} — {name}",
        f"**Goal:** {goal}  |  **Level:** {level}  |  **Intensity:** {intensity}  |  **Volume:** {volume}",
        f"**Training Days:** {days_per_week}×/week",
        "",
        "---",
        "",
        "## Weekly Structure",
        "",
    ]
    for day_title, exercises in structure:
        lines.append(f"### {day_title}")
        for ex in exercises:
            lines.append(f"- {ex} — {volume}")
        lines.append("")

    lines += [
        "---",
        "",
        "## General Guidelines",
        "- Warm-up: 5–10 min light cardio + dynamic stretching before each session.",
        "- Cool-down: 5 min static stretching post-session.",
        "- Rest between sets: 60–90 sec (strength), 30–45 sec (circuits).",
        "- Progress load by 2.5–5% when all reps are achieved with good form.",
        "- Log RPE after each session in the app.",
        "",
        "---",
        "",
        "⚠️ *This plan was AI-drafted from member data. It requires coach review and approval before being assigned to the member.*",
    ]

    # Build rationale
    rationale_parts = [
        f"Plan generated for {name} targeting **{goal}** at **{level}** level.",
        f"Recent data: {total_done} completed sessions (avg {avg_comp}% completion).",
    ]
    if readiness_avg:
        trend = "good recovery" if readiness_avg >= 65 else "recovery concerns"
        rationale_parts.append(f"7-day avg readiness: {readiness_avg}/100 — indicating {trend}.")
    if recent_checkin:
        rationale_parts.append(f"Latest check-in energy: {recent_checkin.energy_level or 'N/A'}, stress: {recent_checkin.stress_level or 'N/A'}.")
    if avg_comp < 60:
        rationale_parts.append("Volume reduced by 1 training day due to below-average completion rate.")
    if latest_assess:
        rationale_parts.append(f"Last assessment: {latest_assess.assessment_date}.")

    return "\n".join(lines), " ".join(rationale_parts)


# ── Routes ─────────────────────────────────────────────────────────────

@router.get("/")
def list_drafts(
    member_id: Optional[int] = None,
    status:    Optional[str] = None,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    q = db.query(AiGeneratedPlanDraft)
    if member_id: q = q.filter(AiGeneratedPlanDraft.member_id == member_id)
    if status:    q = q.filter(AiGeneratedPlanDraft.status == status)
    return [_draft_dict(d, db) for d in q.order_by(AiGeneratedPlanDraft.created_at.desc()).all()]


@router.post("/generate", status_code=201)
def generate_plan_draft(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    member_id = body.get("member_id")
    plan_type = body.get("plan_type", "Monthly Workout Plan")
    if not member_id:
        raise HTTPException(400, "member_id required")
    if not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(404, "Member not found")

    content, rationale = _generate_plan_draft(member_id, plan_type, db)

    d = AiGeneratedPlanDraft(
        member_id     = member_id,
        plan_type     = plan_type,
        draft_content = content,
        rationale     = rationale,
        status        = "Draft",
        created_at    = _utcnow(),
    )
    db.add(d); db.commit(); db.refresh(d)
    return _draft_dict(d, db)


@router.get("/{did}")
def get_draft(did: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    d = db.query(AiGeneratedPlanDraft).filter(AiGeneratedPlanDraft.id == did).first()
    if not d: raise HTTPException(404, "Draft not found")
    return _draft_dict(d, db)


@router.put("/{did}")
def update_draft(did: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    d = db.query(AiGeneratedPlanDraft).filter(AiGeneratedPlanDraft.id == did).first()
    if not d: raise HTTPException(404, "Draft not found")

    for k in ("draft_content", "rationale", "admin_notes", "status", "approved_plan_id"):
        if k in body: setattr(d, k, body[k])

    new_status = body.get("status", "")
    if new_status in ("Approved", "Rejected", "Applied") and not d.reviewed_at:
        d.reviewed_at = _utcnow()

    db.commit(); db.refresh(d)
    return _draft_dict(d, db)


@router.delete("/{did}", status_code=204)
def delete_draft(did: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    d = db.query(AiGeneratedPlanDraft).filter(AiGeneratedPlanDraft.id == did).first()
    if not d: raise HTTPException(404, "Draft not found")
    db.delete(d); db.commit()
