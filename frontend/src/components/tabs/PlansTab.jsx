// ── Plans tab ─────────────────────────────────────────────────────────
import { Badge } from "../ui/Badge.jsx";

export function PlansTab({ member, onDeletePlan }) {
  const workout    = member.workout_plans    || [];
  const nutrition  = member.nutrition_plans  || [];
  const supplement = member.supplement_plans || [];
  const id         = member.id;

  if (!workout.length && !nutrition.length && !supplement.length) {
    return (
      <div className="empty-state" style={{ minHeight: "140px" }}>
        <span className="empty-state-icon">📋</span>
        No plans created yet. Use the Tracking tab to add plans.
      </div>
    );
  }

  return (
    <>
      {workout.length > 0 && (
        <div className="intel-section">
          <div className="plan-section-label">💪 Workout Plans ({workout.length})</div>
          <div className="plans-stack">
            {workout.map(p => (
              <div className="plan-card" key={p.id}>
                <div className="plan-card-header">
                  <div>
                    <div className="plan-card-name">{p.plan_name}</div>
                    <div className="plan-card-meta">
                      <Badge value={p.status || "Draft"} />
                      {p.goal_type        && <span className="history-chip">{p.goal_type}</span>}
                      {p.weekly_frequency && <span className="history-chip">{p.weekly_frequency}×/week</span>}
                      {p.intensity_level  && <span className="history-chip">{p.intensity_level}</span>}
                    </div>
                  </div>
                  <button className="delete-btn" type="button" title="Delete plan"
                    onClick={() => onDeletePlan("workout", p.id, id)}>🗑</button>
                </div>
                {p.notes                && <p className="history-row-note">{p.notes}</p>}
                {p.injury_considerations && <p className="history-row-note" style={{ color: "var(--warn)" }}>⚠ {p.injury_considerations}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {nutrition.length > 0 && (
        <div className="intel-section">
          <div className="plan-section-label">🥗 Nutrition Plans ({nutrition.length})</div>
          <div className="plans-stack">
            {nutrition.map(p => (
              <div className="plan-card" key={p.id}>
                <div className="plan-card-header">
                  <div>
                    <div className="plan-card-name">{p.nutrition_goal || "Nutrition Plan"}</div>
                    <div className="plan-card-meta">
                      <Badge value={p.status || "Draft"} />
                      {p.calories_target  && <span className="history-chip">{p.calories_target} kcal</span>}
                      {p.protein_target   && <span className="history-chip">{p.protein_target}g protein</span>}
                      {p.hydration_target && <span className="history-chip">{p.hydration_target}L hydration</span>}
                    </div>
                  </div>
                  <button className="delete-btn" type="button" title="Delete plan"
                    onClick={() => onDeletePlan("nutrition", p.id, id)}>🗑</button>
                </div>
                {p.dietary_restrictions && <p className="history-row-note">Restrictions: {p.dietary_restrictions}</p>}
                {p.coach_notes && <p className="history-row-note" style={{ color: "var(--cyan)" }}>Coach: {p.coach_notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {supplement.length > 0 && (
        <div className="intel-section">
          <div className="plan-section-label">💊 Supplement Plans ({supplement.length})</div>
          <div className="plans-stack">
            {supplement.map(p => (
              <div className="plan-card" key={p.id}>
                <div className="plan-card-header">
                  <div>
                    <div className="plan-card-name">{p.supplement_name}</div>
                    <div className="plan-card-meta">
                      <Badge value={p.status || "Draft"} />
                      {p.suggested_timing && <span className="history-chip">⏱ {p.suggested_timing}</span>}
                      {p.purpose          && <span className="history-chip">{p.purpose}</span>}
                    </div>
                  </div>
                  <button className="delete-btn" type="button" title="Delete plan"
                    onClick={() => onDeletePlan("supplement", p.id, id)}>🗑</button>
                </div>
                {p.safety_notes && <p className="history-row-note" style={{ color: "var(--warn)" }}>⚠ Safety: {p.safety_notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
