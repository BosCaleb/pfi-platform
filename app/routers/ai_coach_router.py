"""AI Coach Assistant — draft coaching outputs from member data."""
import json
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.auth import get_current_admin
from app.models import (
    AiCoachOutput, Member, MemberHealthProfile, MemberGoals,
    MemberPhysicalMetrics, MemberLifestyleProfile, MemberMotivationProfile,
    WorkoutSession, MemberCheckIn, ReadinessScore, AttendanceRecord,
    GymSession, MemberMembership, Invoice, CoachTask, WorkoutGroup,
    NutritionAdherenceLog, Assessment, ProgressEntry,
)

router = APIRouter(prefix="/api/ai-coach", tags=["ai-coach"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _today():
    return datetime.now(timezone.utc).date()


# ── Helpers ────────────────────────────────────────────────────────────

def _safe_json(obj):
    try:
        return json.dumps(obj, default=str)
    except Exception:
        return "{}"


def _output_dict(o: AiCoachOutput, db: Session) -> dict:
    member = db.query(Member).filter(Member.id == o.member_id).first() if o.member_id else None
    group  = db.query(WorkoutGroup).filter(WorkoutGroup.id == o.workout_group_id).first() if o.workout_group_id else None
    return {
        "id": o.id,
        "member_id": o.member_id,
        "member_name": f"{member.first_name} {member.last_name}" if member else None,
        "workout_group_id": o.workout_group_id,
        "workout_group_name": group.group_name if group else None,
        "admin_id": o.admin_id,
        "output_type": o.output_type,
        "generated_output": o.generated_output,
        "supporting_data_summary": o.supporting_data_summary,
        "risk_flags": o.risk_flags,
        "status": o.status,
        "admin_notes": o.admin_notes,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


def _compile_member_context(member_id: int, db: Session, days: int = 30) -> dict:
    """Gather all relevant member data for AI generation."""
    m    = db.query(Member).filter(Member.id == member_id).first()
    if not m:
        return {}
    h    = db.query(MemberHealthProfile).filter(MemberHealthProfile.member_id == member_id).first()
    g    = db.query(MemberGoals).filter(MemberGoals.member_id == member_id).first()
    phys = db.query(MemberPhysicalMetrics).filter(MemberPhysicalMetrics.member_id == member_id).first()
    life = db.query(MemberLifestyleProfile).filter(MemberLifestyleProfile.member_id == member_id).first()
    mot  = db.query(MemberMotivationProfile).filter(MemberMotivationProfile.member_id == member_id).first()

    since = _today() - timedelta(days=days)

    sessions = db.query(WorkoutSession).filter(
        WorkoutSession.member_id == member_id,
        WorkoutSession.session_date >= since,
    ).order_by(WorkoutSession.session_date.desc()).all()

    checkins = db.query(MemberCheckIn).filter(
        MemberCheckIn.member_id == member_id,
        MemberCheckIn.check_in_date >= since,
    ).order_by(MemberCheckIn.check_in_date.desc()).all()

    readiness = db.query(ReadinessScore).filter(
        ReadinessScore.member_id == member_id,
    ).order_by(ReadinessScore.created_at.desc()).limit(10).all()

    attendance = db.query(AttendanceRecord).filter(
        AttendanceRecord.member_id == member_id,
    ).order_by(AttendanceRecord.created_at.desc()).limit(20).all()

    assessments = db.query(Assessment).filter(
        Assessment.member_id == member_id,
    ).order_by(Assessment.assessment_date.desc()).limit(3).all()

    progress = db.query(ProgressEntry).filter(
        ProgressEntry.member_id == member_id,
        ProgressEntry.date >= since,
    ).order_by(ProgressEntry.date.desc()).all()

    membership = db.query(MemberMembership).filter(
        MemberMembership.member_id == member_id,
        MemberMembership.membership_status == "Active",
    ).first()

    invoices = db.query(Invoice).filter(
        Invoice.member_id == member_id,
        Invoice.invoice_status.in_(["Overdue", "Unpaid"]),
    ).all()

    return {
        "member": {
            "id": m.id, "name": f"{m.first_name} {m.last_name}",
            "fitness_level": m.fitness_level, "risk_level": m.risk_level,
            "primary_goal": m.primary_goal, "status": m.status,
        },
        "health": {
            "injuries": h.injuries if h else None,
            "pain_areas": h.pain_areas if h else None,
            "chronic_conditions": h.chronic_conditions if h else None,
            "medical_clearance_required": h.medical_clearance_required if h else "No",
            "medical_clearance_received": h.medical_clearance_received if h else "No",
            "risk_level": h.risk_level if h else "Low",
        },
        "goals": {
            "primary_goal": g.primary_goal if g else m.primary_goal,
            "secondary_goals": g.secondary_goals if g else None,
            "target_weight": g.target_weight if g else None,
            "target_date": str(g.target_date) if g and g.target_date else None,
            "strength_pct": g.strength_pct if g else 0,
            "fat_loss_pct": g.fat_loss_pct if g else 0,
        },
        "physical": {
            "weight": phys.weight if phys else None,
            "height": phys.height if phys else None,
            "bmi": phys.bmi if phys else None,
            "body_fat_percentage": phys.body_fat_percentage if phys else None,
        },
        "lifestyle": {
            "sleep_hours": life.sleep_hours if life else None,
            "stress_level": life.stress_level if life else None,
            "activity_level": life.activity_level if life else None,
            "recovery_capacity": life.recovery_capacity if life else None,
        },
        "motivation": {
            "motivation_type": mot.motivation_type if mot else None,
            "coaching_style": mot.coaching_style if mot else None,
            "training_frequency": mot.training_frequency if mot else None,
        },
        "sessions_period": len(sessions),
        "sessions_completed": sum(1 for s in sessions if s.completion_status == "Completed"),
        "avg_completion_pct": round(
            sum(s.completion_percentage or 0 for s in sessions) / max(len(sessions), 1), 1
        ),
        "avg_rpe": round(
            sum(s.overall_rpe or 0 for s in sessions if s.overall_rpe) /
            max(sum(1 for s in sessions if s.overall_rpe), 1), 1
        ),
        "pain_flags_count": sum(1 for s in sessions if s.pain_flag),
        "checkins_count": len(checkins),
        "avg_energy": _mode([c.energy_level for c in checkins if c.energy_level]),
        "avg_motivation": _mode([c.motivation_level for c in checkins if c.motivation_level]),
        "avg_readiness_score": round(
            sum(r.score for r in readiness) / max(len(readiness), 1), 1
        ) if readiness else None,
        "readiness_category": readiness[0].category if readiness else None,
        "attendance_rate": _attendance_rate(attendance),
        "no_show_count": sum(1 for a in attendance if a.attendance_status == "No-Show"),
        "latest_assessment": {
            "date": str(assessments[0].assessment_date),
            "pushups": assessments[0].pushups,
            "squats": assessments[0].squats,
            "plank_seconds": assessments[0].plank_seconds,
        } if assessments else None,
        "progress_entries": len(progress),
        "latest_weight": progress[0].weight if progress else phys.weight if phys else None,
        "membership_status": membership.membership_status if membership else "No Active Membership",
        "payment_status": membership.payment_status if membership else None,
        "overdue_invoices": len(invoices),
    }


def _mode(lst: list):
    if not lst:
        return None
    return max(set(lst), key=lst.count)


def _attendance_rate(records: list) -> float:
    if not records:
        return 0.0
    attended = sum(1 for r in records if r.attendance_status == "Attended")
    return round(attended / len(records) * 100, 1)


# ── Generation engine ──────────────────────────────────────────────────

def _generate(output_type: str, ctx: dict, config: dict) -> dict:
    """Rule-based intelligence engine — compiles real member data into structured coaching drafts.
    Replace _generate() with an LLM call to upgrade to full AI generation."""

    m   = ctx.get("member", {})
    h   = ctx.get("health", {})
    g   = ctx.get("goals", {})
    lf  = ctx.get("lifestyle", {})
    mot = ctx.get("motivation", {})
    name = m.get("name", "the member")
    goal = g.get("primary_goal", m.get("primary_goal", "General Fitness"))
    level = m.get("fitness_level", "Intermediate")
    risk  = m.get("risk_level", "Low")

    # Build risk flags
    risk_flags_list = []
    if h.get("injuries"):
        risk_flags_list.append(f"• Reported injuries: {h['injuries']}")
    if h.get("pain_areas"):
        risk_flags_list.append(f"• Pain areas: {h['pain_areas']}")
    if h.get("chronic_conditions"):
        risk_flags_list.append(f"• Chronic conditions: {h['chronic_conditions']}")
    if h.get("medical_clearance_required") == "Yes" and h.get("medical_clearance_received") == "No":
        risk_flags_list.append("• ⚠️  Medical clearance required but NOT yet received")
    if risk in ("High",):
        risk_flags_list.append(f"• Member risk level is HIGH — exercise selection must be conservative")
    if ctx.get("overdue_invoices", 0) > 0:
        risk_flags_list.append(f"• {ctx['overdue_invoices']} overdue invoice(s) — financial follow-up needed")
    if ctx.get("no_show_count", 0) >= 3:
        risk_flags_list.append(f"• {ctx['no_show_count']} no-shows recently — attendance risk")
    risk_flags = "\n".join(risk_flags_list) if risk_flags_list else "No significant risk flags identified."

    # Supporting data
    supporting = (
        f"Member: {name} | Level: {level} | Goal: {goal} | Risk: {risk}\n"
        f"Sessions (period): {ctx.get('sessions_period', 0)} | "
        f"Completed: {ctx.get('sessions_completed', 0)} | "
        f"Avg completion: {ctx.get('avg_completion_pct', 0)}%\n"
        f"Check-ins: {ctx.get('checkins_count', 0)} | "
        f"Avg energy: {ctx.get('avg_energy', 'N/A')} | "
        f"Avg motivation: {ctx.get('avg_motivation', 'N/A')}\n"
        f"Readiness score: {ctx.get('avg_readiness_score', 'N/A')} ({ctx.get('readiness_category', 'N/A')})\n"
        f"Attendance rate: {ctx.get('attendance_rate', 0)}% | "
        f"No-shows: {ctx.get('no_show_count', 0)}\n"
        f"Membership: {ctx.get('membership_status', 'Unknown')} | "
        f"Payment: {ctx.get('payment_status', 'Unknown')}"
    )

    # Output by type
    if output_type == "Generate Member Coaching Summary":
        output = _summary(name, goal, level, risk, ctx, lf, mot)
        suggested = "Review summary, add coach context, then approve to share or use in report."

    elif output_type == "Draft Workout Adjustment":
        output = _workout_adjustment(name, goal, level, risk, ctx, h)
        suggested = "Review suggested adjustments, verify against exercise library, approve to apply."

    elif output_type == "Draft Deload Recommendation":
        output = _deload(name, ctx, h)
        suggested = "Confirm deload week is appropriate. Adjust intensity targets if needed, then approve."

    elif output_type == "Draft Exercise Substitutions":
        output = _substitutions(name, h, level)
        suggested = "Verify substitutions against available equipment and member capacity before approving."

    elif output_type == "Draft Monthly Progress Report":
        output = _monthly_report(name, goal, ctx)
        suggested = "Add coach observations, check data completeness, then save as final and share."

    elif output_type == "Draft Reassessment Summary":
        output = _reassessment(name, ctx)
        suggested = "Compare with previous assessment, add benchmark context, then approve."

    elif output_type == "Draft Coach Message":
        output = _coach_message(name, goal, ctx, mot)
        suggested = "Personalise the message tone, verify accuracy, then send via Communications."

    elif output_type == "Draft Nutrition Review":
        output = _nutrition_review(name, goal, ctx, h)
        suggested = "Review against current nutrition plan. Do not prescribe medical dietary changes without professional sign-off."

    elif output_type == "Draft Supplement Safety Review":
        output = _supplement_review(name, h, ctx)
        suggested = "This is a safety check only — not a prescription. Consult member on side effects before approving."

    elif output_type == "Draft Retention Follow-Up":
        output = _retention_followup(name, ctx, mot)
        suggested = "Personalise and send via Communications. Consider booking a call or check-in session."

    else:
        output = f"Draft output for: {output_type}\n\nMember: {name}\nGoal: {goal}\nLevel: {level}"
        suggested = "Review and customise before approving."

    return {
        "generated_output": output,
        "supporting_data_summary": supporting,
        "risk_flags": risk_flags,
        "suggested_action": suggested,
    }


def _summary(name, goal, level, risk, ctx, lf, mot):
    lines = [
        f"# Coaching Summary — {name}",
        "",
        f"**Goal:** {goal}  |  **Level:** {level}  |  **Risk:** {risk}",
        "",
        "## Performance Overview",
        f"Over the recent period, {name} completed {ctx.get('sessions_completed', 0)} of "
        f"{ctx.get('sessions_period', 0)} sessions with an average completion rate of "
        f"{ctx.get('avg_completion_pct', 0)}%.",
        "",
        f"Average RPE: {ctx.get('avg_rpe', 'N/A')}  |  "
        f"Attendance rate: {ctx.get('attendance_rate', 0)}%  |  "
        f"No-shows: {ctx.get('no_show_count', 0)}",
        "",
        "## Readiness & Recovery",
        f"Average readiness score: {ctx.get('avg_readiness_score', 'N/A')} "
        f"({ctx.get('readiness_category', 'N/A')}). "
        f"Member reported average energy: {ctx.get('avg_energy', 'N/A')} "
        f"and motivation: {ctx.get('avg_motivation', 'N/A')}.",
        "",
        "## Lifestyle Factors",
        f"Sleep: {lf.get('sleep_hours', 'N/A')} hrs  |  "
        f"Stress: {lf.get('stress_level', 'N/A')}  |  "
        f"Recovery capacity: {lf.get('recovery_capacity', 'N/A')}",
        "",
        "## Coaching Recommendation",
        f"Based on current data, {name} is {'performing well and may be ready for progression' if ctx.get('avg_completion_pct', 0) >= 80 else 'showing signs that may require coaching attention'}. "
        f"{'Consider advancing plan intensity or setting a new challenge.' if ctx.get('avg_completion_pct', 0) >= 80 else 'Consider a check-in conversation and workload review.'}",
        "",
        "---",
        "_This is a draft generated from member data. Admin review and approval required before use._",
    ]
    return "\n".join(lines)


def _workout_adjustment(name, goal, level, risk, ctx, h):
    completion = ctx.get("avg_completion_pct", 0)
    rpe = ctx.get("avg_rpe", 6)
    pain = ctx.get("pain_flags_count", 0)

    if completion >= 90 and rpe <= 7 and pain == 0:
        direction = "PROGRESSION"
        reason = "High completion rate and manageable RPE suggest readiness to progress."
        actions = [
            "Increase prescribed load by 5–10% on primary compound movements",
            "Add one additional set to main strength exercises",
            "Introduce a new exercise variation to maintain stimulus",
        ]
    elif completion < 60 or rpe >= 9 or pain > 0:
        direction = "REGRESSION / MODIFICATION"
        reason = "Low completion, high RPE, or pain flags indicate current plan may be too demanding."
        actions = [
            "Reduce overall volume by 20–30%",
            "Lower intensity targets (RPE 6–7 max)",
            "Review and remove exercises triggering pain or high RPE",
            "Consider adding a recovery session in place of a high-intensity day",
        ]
    else:
        direction = "MAINTAIN with minor adjustments"
        reason = "Member is within acceptable performance range."
        actions = [
            "Keep current plan with small technique refinements",
            "Monitor RPE trend over next 2 weeks",
        ]

    lines = [
        f"# Workout Adjustment Draft — {name}",
        "",
        f"**Recommended Direction:** {direction}",
        f"**Reason:** {reason}",
        "",
        "## Suggested Adjustments",
        *[f"- {a}" for a in actions],
        "",
        "## Contraindications to Check",
        f"- Injuries on file: {h.get('injuries', 'None')}",
        f"- Pain areas: {h.get('pain_areas', 'None')}",
        f"- Chronic conditions: {h.get('chronic_conditions', 'None')}",
        "",
        "_Admin must verify adjustments against exercise library and approve before applying._",
    ]
    return "\n".join(lines)


def _deload(name, ctx, h):
    lines = [
        f"# Deload Week Recommendation — {name}",
        "",
        "## Why a Deload is Recommended",
        f"Recent data shows: avg RPE {ctx.get('avg_rpe', 'N/A')}, "
        f"pain flags {ctx.get('pain_flags_count', 0)}, "
        f"avg completion {ctx.get('avg_completion_pct', 0)}%.",
        "",
        "## Deload Structure (Draft)",
        "- **Volume:** Reduce by 40–50% across all sessions",
        "- **Intensity:** Work at 60–70% of normal load",
        "- **Sessions:** Keep same frequency but shorten duration by 20 min",
        "- **Focus:** Movement quality, mobility, and technique over load",
        "",
        "## Deload Week Priorities",
        "1. Full body mobility circuit (20 min) each session",
        "2. Light compound movements — focus on form",
        "3. No new exercises or PRs this week",
        "4. Increase recovery emphasis — foam rolling, stretching",
        "",
        "## Health Considerations",
        f"- Injuries: {h.get('injuries', 'None')}",
        f"- Pain areas: {h.get('pain_areas', 'None')}",
        "",
        "_Deload week should last 5–7 days before resuming normal training._",
        "_Admin approval required before communicating to member._",
    ]
    return "\n".join(lines)


def _substitutions(name, h, level):
    injury_notes = []
    if h.get("injuries"):
        injury_notes.append(f"Injury history: {h['injuries']}")
    if h.get("pain_areas"):
        injury_notes.append(f"Pain areas: {h['pain_areas']}")

    lines = [
        f"# Exercise Substitution Suggestions — {name}",
        "",
        "## Member Considerations",
        *(injury_notes and [f"- {n}" for n in injury_notes] or ["- No specific injuries flagged"]),
        f"- Fitness level: {level}",
        "",
        "## Common Substitution Pairs",
        "| Original Exercise | Substitution | Reason |",
        "|---|---|---|",
        "| Barbell Back Squat | Goblet Squat | Lower spinal load |",
        "| Barbell Deadlift | Romanian Deadlift | Reduced lower back demand |",
        "| Overhead Press | Landmine Press | Shoulder-friendly alternative |",
        "| Running | Cycling / Rowing | Low-impact cardio |",
        "| Pull-ups | Lat Pulldown | Adjustable load, same pattern |",
        "| Burpees | Step-to-plank | Lower impact variation |",
        "",
        "## Notes for Admin",
        "- Verify substitutions are available in the Exercise Library",
        "- Confirm member can perform the substitute safely",
        "- Update workout plan version with substitutions applied",
        "",
        "_Admin must map substitutions to Exercise Library records before approving._",
    ]
    return "\n".join(lines)


def _monthly_report(name, goal, ctx):
    lines = [
        f"# Monthly Progress Report — {name}",
        f"**Goal:** {goal}",
        "",
        "## Sessions",
        f"- Sessions completed: {ctx.get('sessions_completed', 0)}",
        f"- Sessions planned: {ctx.get('sessions_period', 0)}",
        f"- Avg completion rate: {ctx.get('avg_completion_pct', 0)}%",
        f"- Avg RPE: {ctx.get('avg_rpe', 'N/A')}",
        "",
        "## Attendance",
        f"- Attendance rate: {ctx.get('attendance_rate', 0)}%",
        f"- No-shows: {ctx.get('no_show_count', 0)}",
        "",
        "## Readiness & Wellbeing",
        f"- Avg readiness: {ctx.get('avg_readiness_score', 'N/A')} ({ctx.get('readiness_category', 'N/A')})",
        f"- Avg energy: {ctx.get('avg_energy', 'N/A')}",
        f"- Avg motivation: {ctx.get('avg_motivation', 'N/A')}",
        f"- Check-ins submitted: {ctx.get('checkins_count', 0)}",
        "",
        "## Body Metrics",
        f"- Current weight: {ctx.get('latest_weight', 'N/A')} kg",
        f"- Progress entries logged: {ctx.get('progress_entries', 0)}",
        "",
        "## Membership",
        f"- Status: {ctx.get('membership_status', 'N/A')}",
        f"- Payment status: {ctx.get('payment_status', 'N/A')}",
        "",
        "## Coaching Observations",
        "_[Admin to complete — add specific performance notes, wins, and areas to focus on]_",
        "",
        "## Next 30-Day Focus",
        "_[Admin to complete — add specific targets for the next period]_",
        "",
        "---",
        "⚠️ _This report is a draft. It must be reviewed and approved by the coach before sharing._",
        "_This report does not constitute medical or nutritional advice._",
    ]
    return "\n".join(lines)


def _reassessment(name, ctx):
    la = ctx.get("latest_assessment")
    lines = [
        f"# Reassessment Summary Draft — {name}",
        "",
        "## Latest Assessment Data",
    ]
    if la:
        lines += [
            f"- Date: {la.get('date', 'N/A')}",
            f"- Push-ups: {la.get('pushups', 'N/A')}",
            f"- Squats: {la.get('squats', 'N/A')}",
            f"- Plank: {la.get('plank_seconds', 'N/A')} seconds",
        ]
    else:
        lines.append("- No assessment data on file")
    lines += [
        "",
        "## Performance Since Last Assessment",
        f"- Sessions completed: {ctx.get('sessions_completed', 0)}",
        f"- Avg completion: {ctx.get('avg_completion_pct', 0)}%",
        f"- Attendance rate: {ctx.get('attendance_rate', 0)}%",
        "",
        "## Coach Observations",
        "_[Admin to add specific comparison notes and benchmark changes]_",
        "",
        "## Recommendation",
        "_[Admin to add: maintain / progress / regress / refer for medical review]_",
        "",
        "_This is a draft — admin review required before use._",
    ]
    return "\n".join(lines)


def _coach_message(name, goal, ctx, mot):
    style = mot.get("coaching_style", "Encouraging")
    completion = ctx.get("avg_completion_pct", 0)

    if completion >= 80:
        tone = f"Hi {name}, fantastic work this period — your consistency is really showing!"
        body = "Your session completion rate has been excellent. Keep pushing — you're on track to hit your goals."
    else:
        tone = f"Hi {name}, I wanted to check in and see how you're doing."
        body = ("I noticed you've had a few sessions where things didn't go as planned. "
                "That's completely normal — let's talk about how we can set you up better for the weeks ahead.")

    lines = [
        f"# Coach Message Draft — {name}",
        "",
        f"**To:** {name}",
        f"**Subject:** Your Progress Check-In",
        "",
        "---",
        "",
        tone,
        "",
        body,
        "",
        f"Your current goal is {goal}, and every session counts toward getting there.",
        "",
        "Please let me know if you need any adjustments to your plan, have any questions, or just want to chat.",
        "",
        "Keep going — you've got this.",
        "",
        "Your Coach",
        "",
        "---",
        f"_Coaching style: {style} — adjust tone to match member preference before sending._",
        "_Send via Communications once approved._",
    ]
    return "\n".join(lines)


def _nutrition_review(name, goal, ctx, h):
    lines = [
        f"# Nutrition Review Draft — {name}",
        "",
        "⚠️ _This is a coaching support draft only — not a medical or dietitian recommendation._",
        "",
        f"**Goal:** {goal}",
        "",
        "## Current Status",
        f"- Check-ins logged: {ctx.get('checkins_count', 0)}",
        "- Reported nutrition adherence pattern: [from check-in data]",
        "",
        "## General Coaching Notes (Non-Medical)",
        "- Ensure adequate protein intake to support training recovery",
        "- Hydration consistency — aim for 2–3L daily minimum during training periods",
        "- Pre/post workout nutrition timing can support session performance",
        "",
        "## Considerations",
        f"- Chronic conditions: {h.get('chronic_conditions', 'None')} — refer to qualified professional if relevant",
        f"- Medications: consult professional before making nutrition changes",
        "",
        "## Next Steps",
        "- Review current nutrition plan with member",
        "- If significant dietary changes needed — refer to registered dietitian",
        "",
        "_Admin review required. Do not share medical nutritional advice without professional sign-off._",
    ]
    return "\n".join(lines)


def _supplement_review(name, h, ctx):
    lines = [
        f"# Supplement Safety Review Draft — {name}",
        "",
        "⚠️ _This is a safety check only — not a prescription or medical recommendation._",
        "",
        "## Health Considerations",
        f"- Chronic conditions: {h.get('chronic_conditions', 'None')}",
        f"- Medications: {h.get('medications', 'None reported')}",
        f"- Injuries: {h.get('injuries', 'None')}",
        "",
        "## Standard Safety Checks",
        "- [ ] Member has no contraindications to current supplements",
        "- [ ] No reported side effects in recent check-ins",
        "- [ ] Supplement timing aligns with training schedule",
        "- [ ] Dosages are within standard recommended ranges",
        "",
        "## Admin Action Required",
        "- Review supplement plan against health profile",
        "- If any medication interactions suspected — advise member to consult a doctor",
        "- Update supplement plan status if adjustments are made",
        "",
        "_This draft must be reviewed by a qualified professional if medical relevance exists._",
    ]
    return "\n".join(lines)


def _retention_followup(name, ctx, mot):
    no_shows = ctx.get("no_show_count", 0)
    overdue  = ctx.get("overdue_invoices", 0)
    energy   = ctx.get("avg_energy", "N/A")

    lines = [
        f"# Retention Follow-Up Draft — {name}",
        "",
        "## Risk Indicators Detected",
        f"- No-shows: {no_shows}",
        f"- Overdue invoices: {overdue}",
        f"- Average energy: {energy}",
        f"- Attendance rate: {ctx.get('attendance_rate', 0)}%",
        "",
        "## Suggested Outreach",
        f"Hi {name},",
        "",
        "I just wanted to reach out personally — I've noticed you haven't been in recently and "
        "I want to make sure everything is okay.",
        "",
        "Your progress matters and I'm here to support you. If anything has come up — "
        "whether it's time, energy, or something else — let's talk and figure out the best way forward.",
        "",
        "Would you like to book a quick check-in call or reschedule some sessions?",
        "",
        "Looking forward to hearing from you.",
        "",
        "Your Coach",
        "",
        "---",
        "## Recommended Actions",
        "- [ ] Send personal message (above draft)",
        "- [ ] Book a check-in call",
        "- [ ] Review and adjust session schedule",
        "- [ ] Follow up on overdue invoice" if overdue else "",
        "- [ ] Consider offering a complimentary session to re-engage",
        "",
        "_Approve and send via Communications._",
    ]
    return "\n".join(l for l in lines)


# ── Routes ─────────────────────────────────────────────────────────────

@router.get("/outputs")
def list_outputs(
    member_id:   Optional[int] = None,
    status:      Optional[str] = None,
    output_type: Optional[str] = None,
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    q = db.query(AiCoachOutput)
    if member_id:   q = q.filter(AiCoachOutput.member_id == member_id)
    if status:      q = q.filter(AiCoachOutput.status == status)
    if output_type: q = q.filter(AiCoachOutput.output_type == output_type)
    items = q.order_by(AiCoachOutput.created_at.desc()).all()
    return [_output_dict(o, db) for o in items]


@router.post("/generate", status_code=201)
def generate_output(body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    member_id   = body.get("member_id")
    output_type = body.get("output_type")
    days        = int(body.get("days", 30))

    if not output_type:
        raise HTTPException(400, "output_type is required")
    if member_id and not db.query(Member).filter(Member.id == member_id).first():
        raise HTTPException(404, "Member not found")

    ctx = _compile_member_context(member_id, db, days) if member_id else {}
    result = _generate(output_type, ctx, body)

    obj = AiCoachOutput(
        member_id               = member_id,
        workout_group_id        = body.get("workout_group_id"),
        admin_id                = admin.id,
        output_type             = output_type,
        prompt_context_snapshot = _safe_json(ctx),
        generated_output        = result["generated_output"],
        supporting_data_summary = result["supporting_data_summary"],
        risk_flags              = result["risk_flags"],
        status                  = "Draft",
        created_at              = _utcnow(),
        updated_at              = _utcnow(),
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _output_dict(obj, db)


@router.get("/outputs/{output_id}")
def get_output(output_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    o = db.query(AiCoachOutput).filter(AiCoachOutput.id == output_id).first()
    if not o:
        raise HTTPException(404, "Output not found")
    return _output_dict(o, db)


@router.put("/outputs/{output_id}")
def update_output(output_id: int, body: dict, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    o = db.query(AiCoachOutput).filter(AiCoachOutput.id == output_id).first()
    if not o:
        raise HTTPException(404, "Output not found")
    for k in ("generated_output", "admin_notes", "status", "risk_flags", "supporting_data_summary"):
        if k in body:
            setattr(o, k, body[k])
    o.updated_at = _utcnow()
    db.commit()
    db.refresh(o)
    return _output_dict(o, db)


@router.delete("/outputs/{output_id}", status_code=204)
def delete_output(output_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    o = db.query(AiCoachOutput).filter(AiCoachOutput.id == output_id).first()
    if not o:
        raise HTTPException(404, "Output not found")
    db.delete(o)
    db.commit()
