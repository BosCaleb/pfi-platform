import { useState, useEffect } from "react";

export default function PortalPlans({ token }) {
  const [plans,   setPlans]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("workout");

  useEffect(() => {
    fetch("/api/member/plans", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setPlans(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="mp-page"><div className="mp-loading">Loading…</div></div>;

  const { workout, nutrition, supplement } = plans || {};
  const available = [workout && "workout", nutrition && "nutrition", supplement && "supplement"].filter(Boolean);
  if (available.length && !available.includes(tab)) setTab(available[0]);

  return (
    <div className="mp-page">
      <h2 className="mp-page-title">📋 My Plan</h2>

      <div className="mp-tab-pills">
        {[["workout","🏋️ Workout"], ["nutrition","🥗 Nutrition"], ["supplement","💊 Supplements"]].map(([id, label]) => (
          <button key={id} className={`mp-pill ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "workout" && (
        workout ? (
          <div className="mp-card">
            <div className="mp-card-header">
              <span className="mp-card-title">{workout.plan_name || "Workout Plan"}</span>
              {workout.created_at && (
                <span className="mp-card-date">
                  {new Date(workout.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
            </div>
            <div className="mp-plan-meta">
              {workout.goal && <span className="mp-plan-chip">🎯 {workout.goal}</span>}
              {workout.weeks && <span className="mp-plan-chip">📅 {workout.weeks} weeks</span>}
              {workout.sessions_per_week && <span className="mp-plan-chip">⚡ {workout.sessions_per_week}×/week</span>}
            </div>
            {workout.plan_details && (
              <div className="mp-plan-body">
                <pre className="mp-plan-text">{workout.plan_details}</pre>
              </div>
            )}
          </div>
        ) : <NoPlan type="workout plan" emoji="🏋️" />
      )}

      {tab === "nutrition" && (
        nutrition ? (
          <div className="mp-card">
            <div className="mp-card-header">
              <span className="mp-card-title">{nutrition.plan_name || "Nutrition Plan"}</span>
            </div>
            <div className="mp-nutrition-targets">
              {[
                ["Calories", nutrition.calories_target, "kcal"],
                ["Protein",  nutrition.protein_target,  "g"],
                ["Carbs",    nutrition.carbs_target,     "g"],
                ["Fat",      nutrition.fat_target,       "g"],
              ].filter(([, v]) => v).map(([label, val, unit]) => (
                <div key={label} className="mp-macro-card">
                  <div className="mp-macro-val">{val}<span className="mp-macro-unit">{unit}</span></div>
                  <div className="mp-macro-label">{label}</div>
                </div>
              ))}
            </div>
            {nutrition.meal_timing && (
              <div className="mp-plan-section">
                <div className="mp-plan-section-label">Meal Timing</div>
                <p>{nutrition.meal_timing}</p>
              </div>
            )}
            {nutrition.dietary_notes && (
              <div className="mp-plan-section">
                <div className="mp-plan-section-label">Dietary Notes</div>
                <p>{nutrition.dietary_notes}</p>
              </div>
            )}
          </div>
        ) : <NoPlan type="nutrition plan" emoji="🥗" />
      )}

      {tab === "supplement" && (
        supplement ? (
          <div className="mp-card">
            <div className="mp-card-header">
              <span className="mp-card-title">{supplement.plan_name || "Supplement Plan"}</span>
            </div>
            {supplement.supplements && (
              <div className="mp-plan-body">
                <pre className="mp-plan-text">{supplement.supplements}</pre>
              </div>
            )}
            {supplement.timing_notes && (
              <div className="mp-plan-section">
                <div className="mp-plan-section-label">Timing Notes</div>
                <p>{supplement.timing_notes}</p>
              </div>
            )}
          </div>
        ) : <NoPlan type="supplement plan" emoji="💊" />
      )}
    </div>
  );
}

function NoPlan({ type, emoji }) {
  return (
    <div className="mp-card mp-empty-plan">
      <div className="mp-empty-icon">{emoji}</div>
      <p>Your {type} hasn't been assigned yet. Your coach will set this up for you.</p>
    </div>
  );
}
