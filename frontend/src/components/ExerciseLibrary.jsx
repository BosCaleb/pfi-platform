// ── Exercise Library ──────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { request } from "../utils/api.js";

const CATEGORIES  = ["Warm-up","Strength","Cardio","Mobility","Core","Conditioning","Cool-down","Sport-specific"];
const DIFFICULTIES = ["Beginner","Intermediate","Advanced","All Levels"];
const IMPACTS     = ["Low","Medium","High"];
const EQUIPMENT   = [
  "Barbell","Dumbbell","Machine","Bodyweight","Kettlebell",
  "Resistance Band","Cable","Cardio Machine","Mat","Bench",
  "Pull-up Bar","Box","None","Other",
];

const SAFETY_FLAGS = [
  ["avoid_if_knee_injury",           "⚠ Avoid — Knee Injury"],
  ["avoid_if_lower_back_pain",       "⚠ Avoid — Lower Back Pain"],
  ["avoid_if_shoulder_injury",       "⚠ Avoid — Shoulder Injury"],
  ["avoid_if_high_blood_pressure",   "⚠ Avoid — High Blood Pressure"],
  ["avoid_if_pregnant",              "⚠ Avoid — Pregnant"],
  ["low_impact",                     "✓ Low Impact"],
  ["beginner_friendly",              "✓ Beginner Friendly"],
  ["medical_clearance_recommended",  "🚨 Medical Clearance Required"],
];

const TRACKING_FLAGS = [
  ["track_reps","Reps"],["track_sets","Sets"],["track_weight","Weight"],
  ["track_time","Time"],["track_distance","Distance"],["track_rpe","RPE"],
  ["track_heart_rate","Heart Rate"],["track_pain_score","Pain Score"],
];

const EMPTY_EX = {
  exercise_name: "", category: "Strength", description: "",
  muscle_groups_primary: "", muscle_groups_secondary: "",
  equipment_required: "Bodyweight", difficulty_level: "Beginner",
  impact_level: "Medium", movement_pattern: "", coach_notes: "",
  avoid_if_knee_injury: false, avoid_if_lower_back_pain: false,
  avoid_if_shoulder_injury: false, avoid_if_high_blood_pressure: false,
  avoid_if_pregnant: false, low_impact: false, beginner_friendly: true,
  medical_clearance_recommended: false,
  track_reps: true, track_sets: true, track_weight: false,
  track_time: false, track_distance: false, track_rpe: true,
  track_heart_rate: false, track_pain_score: true,
};

const DIFF_COLOR   = { Beginner: "lime", Intermediate: "cyan", Advanced: "purple", "All Levels": "cyan" };
const IMPACT_COLOR = { Low: "lime", Medium: "cyan", High: "danger" };

export function ExerciseLibrary({ token }) {
  const [exercises, setExercises] = useState([]);
  const [expanded,  setExpanded]  = useState(null);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_EX);
  const [msg,       setMsg]       = useState("");
  const [filters,   setFilters]   = useState({
    search: "", category: "", difficulty: "", impact: "", status: "Active",
  });

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
    try {
      setExercises(await request(`/api/exercises/?${p}`, token));
    } catch (err) { console.error(err); }
  }, [token, filters]);

  useEffect(() => { load(); }, [load]);

  function setF(k, v)  { setForm(f => ({ ...f, [k]: v })); }
  function setFl(k, v) { setFilters(f => ({ ...f, [k]: v })); }

  async function saveExercise(e) {
    e.preventDefault();
    setMsg("Saving…");
    try {
      await request("/api/exercises/", token, { method: "POST", body: JSON.stringify(form) });
      setMsg("✓ Exercise added to library.");
      setShowForm(false);
      setForm(EMPTY_EX);
      await load();
    } catch (err) { setMsg(err.message); }
  }

  async function archiveExercise(id, ev) {
    ev.stopPropagation();
    if (!confirm("Archive this exercise? It will be hidden from the library.")) return;
    try {
      await request(`/api/exercises/${id}/archive`, token, { method: "PATCH" });
      setExpanded(null);
      await load();
    } catch (err) { alert(err.message); }
  }

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>📚 Exercise Library</h2>
          <p className="muted text-sm" style={{ marginTop: 4 }}>
            {exercises.length} exercise{exercises.length !== 1 ? "s" : ""} loaded
          </p>
        </div>
        <div className="section-title-right">
          {msg && <span className="message">{msg}</span>}
          <button type="button" onClick={() => { setShowForm(s => !s); setMsg(""); }}>
            {showForm ? "Cancel" : "+ Add Exercise"}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="panel p2-filter-bar" style={{ marginBottom: 18 }}>
        <div className="p2-filter-row">
          <label>Search
            <input value={filters.search} placeholder="Name, muscle…"
              onChange={e => setFl("search", e.target.value)}
              onKeyDown={e => e.key === "Enter" && load()} />
          </label>
          <label>Category
            <select value={filters.category} onChange={e => setFl("category", e.target.value)}>
              <option value="">All</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Difficulty
            <select value={filters.difficulty} onChange={e => setFl("difficulty", e.target.value)}>
              <option value="">All</option>
              {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label>Impact
            <select value={filters.impact} onChange={e => setFl("impact", e.target.value)}>
              <option value="">All</option>
              {IMPACTS.map(i => <option key={i}>{i}</option>)}
            </select>
          </label>
          <label>Status
            <select value={filters.status} onChange={e => setFl("status", e.target.value)}>
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
            </select>
          </label>
          <button className="ghost" type="button" onClick={load} style={{ alignSelf: "flex-end" }}>
            🔍 Search
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form className="panel" style={{ marginBottom: 20 }} onSubmit={saveExercise}>
          <h3>Add Exercise</h3>
          <div className="form-grid-3">
            <label>Exercise Name *
              <input required value={form.exercise_name}
                onChange={e => setF("exercise_name", e.target.value)} />
            </label>
            <label>Category
              <select value={form.category} onChange={e => setF("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>Difficulty
              <select value={form.difficulty_level} onChange={e => setF("difficulty_level", e.target.value)}>
                {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label>Impact Level
              <select value={form.impact_level} onChange={e => setF("impact_level", e.target.value)}>
                {IMPACTS.map(i => <option key={i}>{i}</option>)}
              </select>
            </label>
            <label>Equipment
              <select value={form.equipment_required} onChange={e => setF("equipment_required", e.target.value)}>
                {EQUIPMENT.map(eq => <option key={eq}>{eq}</option>)}
              </select>
            </label>
            <label>Movement Pattern
              <input value={form.movement_pattern} placeholder="e.g. Push, Hinge, Squat"
                onChange={e => setF("movement_pattern", e.target.value)} />
            </label>
            <label>Primary Muscles
              <input value={form.muscle_groups_primary}
                onChange={e => setF("muscle_groups_primary", e.target.value)} />
            </label>
            <label>Secondary Muscles
              <input value={form.muscle_groups_secondary}
                onChange={e => setF("muscle_groups_secondary", e.target.value)} />
            </label>
          </div>
          <label style={{ marginTop: 12 }}>Description
            <textarea rows={3} value={form.description}
              onChange={e => setF("description", e.target.value)} />
          </label>

          <h4 style={{ marginTop: 18 }}>Safety Flags</h4>
          <div className="checkbox-grid">
            {SAFETY_FLAGS.map(([k, label]) => (
              <label key={k} className="checkbox-label">
                <input type="checkbox" checked={form[k]}
                  onChange={e => setF(k, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>

          <h4 style={{ marginTop: 16 }}>Track These Fields During Sessions</h4>
          <div className="checkbox-grid">
            {TRACKING_FLAGS.map(([k, label]) => (
              <label key={k} className="checkbox-label">
                <input type="checkbox" checked={form[k]}
                  onChange={e => setF(k, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>

          <label style={{ marginTop: 14 }}>Coach Notes
            <textarea rows={2} value={form.coach_notes}
              onChange={e => setF("coach_notes", e.target.value)} />
          </label>
          <div style={{ marginTop: 14 }}>
            <button type="submit">Save Exercise</button>
          </div>
        </form>
      )}

      {/* Exercise grid */}
      {exercises.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">📚</span>
          No exercises found. Adjust filters or add one above.
        </div>
      ) : (
        <div className="exercise-grid">
          {exercises.map(ex => (
            <div
              key={ex.id}
              className={`exercise-card ${expanded === ex.id ? "active" : ""}`}
              onClick={() => setExpanded(expanded === ex.id ? null : ex.id)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === "Enter" && setExpanded(expanded === ex.id ? null : ex.id)}
            >
              <div className="exercise-card-top">
                <div>
                  <div className="exercise-card-name">{ex.exercise_name}</div>
                  <div className="exercise-card-cat">{ex.category}</div>
                </div>
                <div className="exercise-card-badges">
                  <span className={`badge ${DIFF_COLOR[ex.difficulty_level] || "cyan"}`}>
                    {ex.difficulty_level}
                  </span>
                  <span className={`badge ${IMPACT_COLOR[ex.impact_level] || "cyan"}`}>
                    {ex.impact_level}
                  </span>
                </div>
              </div>

              <div className="exercise-chips">
                {ex.equipment_required && (
                  <span className="history-chip">🔧 {ex.equipment_required}</span>
                )}
                {ex.muscle_groups_primary && (
                  <span className="history-chip">💪 {ex.muscle_groups_primary}</span>
                )}
                {ex.movement_pattern && (
                  <span className="history-chip">{ex.movement_pattern}</span>
                )}
              </div>

              {/* Expanded detail */}
              {expanded === ex.id && (
                <div className="exercise-detail" onClick={e => e.stopPropagation()}>
                  {ex.description && (
                    <p className="muted text-sm" style={{ marginBottom: 10, lineHeight: 1.6 }}>
                      {ex.description}
                    </p>
                  )}

                  {/* Safety flags */}
                  <div className="exercise-flags">
                    {ex.avoid_if_knee_injury          && <span className="flag-chip warn">⚠ Knee</span>}
                    {ex.avoid_if_lower_back_pain       && <span className="flag-chip warn">⚠ Back</span>}
                    {ex.avoid_if_shoulder_injury       && <span className="flag-chip warn">⚠ Shoulder</span>}
                    {ex.avoid_if_high_blood_pressure   && <span className="flag-chip warn">⚠ HBP</span>}
                    {ex.avoid_if_pregnant              && <span className="flag-chip warn">⚠ Pregnant</span>}
                    {ex.medical_clearance_recommended  && <span className="flag-chip crit">🚨 Clearance</span>}
                    {ex.low_impact                     && <span className="flag-chip ok">✓ Low Impact</span>}
                    {ex.beginner_friendly              && <span className="flag-chip ok">✓ Beginner OK</span>}
                  </div>

                  {/* Tracking fields */}
                  <div className="exercise-flags" style={{ marginTop: 8 }}>
                    {TRACKING_FLAGS.filter(([k]) => ex[k]).map(([k, label]) => (
                      <span key={k} className="flag-chip info">📊 {label}</span>
                    ))}
                  </div>

                  {ex.coach_notes && (
                    <p className="history-row-note" style={{ color: "var(--cyan)", marginTop: 8 }}>
                      Coach: {ex.coach_notes}
                    </p>
                  )}

                  {ex.status !== "Archived" && (
                    <div style={{ marginTop: 12 }}>
                      <button className="danger" type="button"
                        onClick={e => archiveExercise(ex.id, e)}>
                        Archive Exercise
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
