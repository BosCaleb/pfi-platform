// ── Check-In Dashboard (Phase 3.1) ───────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { request } from "../utils/api.js";

const READINESS_COLOR = { Green: "lime", Yellow: "gold", Orange: "warn", Red: "danger" };
const READINESS_ICON  = { Green: "🟢", Yellow: "🟡", Orange: "🟠", Red: "🔴" };

const ENERGY_OPTS    = ["Very Low", "Low", "Moderate", "High", "Very High"];
const SLEEP_Q_OPTS   = ["Poor", "Fair", "Good", "Excellent"];
const STRESS_OPTS    = ["Low", "Medium", "High", "Very High"];
const SORENESS_OPTS  = ["None", "Mild", "Moderate", "Severe"];
const MOOD_OPTS      = ["Poor", "Okay", "Good", "Great"];
const MOTIVATION_OPTS= ["Low", "Medium", "High"];
const HYDRATION_OPTS = ["Poor", "Moderate", "Good"];
const NUTR_OPTS      = ["Poor", "Moderate", "Good", "Excellent"];
const SUPP_OPTS      = ["Not Applicable", "Missed", "Partial", "Complete"];
const READINESS_OPTS = ["Not Ready", "Light Session Only", "Ready", "Ready to Push"];

// ── Daily check-in form ───────────────────────────────────────────────
function DailyCheckInForm({ members, token, onDone }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    member_id: "", check_in_date: today,
    energy_level: "Moderate", sleep_hours: "", sleep_quality: "Good",
    stress_level: "Low", muscle_soreness: "None", pain_level: "0",
    pain_location: "", mood: "Good", motivation_level: "Medium",
    hydration_status: "Good", nutrition_adherence: "Moderate",
    supplement_adherence: "Not Applicable", workout_readiness: "Ready",
    new_injury_reported: "No", injury_notes: "", member_notes: "",
    submitted_by: "Admin",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.member_id) { setMsg("Select a member."); return; }
    setLoading(true); setMsg("Saving…");
    try {
      const r = await request("/api/check-ins/", token, {
        method: "POST",
        body: JSON.stringify({ ...form, pain_level: Number(form.pain_level) || 0 }),
      });
      setMsg(`✓ Check-in saved — Readiness: ${r.readiness_category} (${r.readiness_score}), Recovery: ${r.recovery_category} (${r.recovery_score})`);
      if (onDone) onDone(r);
    } catch (err) { setMsg("⚠ " + err.message); }
    setLoading(false);
  }

  const sel = (label, key, opts) => (
    <label className="ci-field" key={key}>
      {label}
      <select value={form[key]} onChange={e => set(key, e.target.value)}>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

  return (
    <form className="ci-form panel" onSubmit={submit}>
      <h3 className="ci-form-title">⚡ Daily Check-In</h3>
      <p className="ci-disclaimer muted text-xs">
        Check-ins are used for coaching support and progress tracking only.
        They are not medical assessments. If you experience severe symptoms,
        stop exercising and seek medical assistance immediately.
      </p>

      <div className="ci-grid">
        <label className="ci-field wide">
          Member *
          <select required value={form.member_id} onChange={e => set("member_id", e.target.value)}>
            <option value="">— Select member —</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select>
        </label>
        <label className="ci-field">
          Check-In Date
          <input type="date" value={form.check_in_date} onChange={e => set("check_in_date", e.target.value)} />
        </label>
        <label className="ci-field">
          Submitted By
          <select value={form.submitted_by} onChange={e => set("submitted_by", e.target.value)}>
            {["Admin", "Member"].map(o => <option key={o}>{o}</option>)}
          </select>
        </label>

        {/* Sleep */}
        <label className="ci-field">
          Sleep Hours
          <input type="number" min="0" max="16" step="0.5" value={form.sleep_hours}
            onChange={e => set("sleep_hours", e.target.value)} placeholder="7.5" />
        </label>
        {sel("Sleep Quality", "sleep_quality", SLEEP_Q_OPTS)}
        {sel("Energy Level",  "energy_level",  ENERGY_OPTS)}
        {sel("Stress Level",  "stress_level",  STRESS_OPTS)}
        {sel("Muscle Soreness","muscle_soreness", SORENESS_OPTS)}
        {sel("Mood",          "mood",          MOOD_OPTS)}
        {sel("Motivation",    "motivation_level", MOTIVATION_OPTS)}

        {/* Pain */}
        <label className="ci-field">
          Pain Level (0–10)
          <input type="number" min="0" max="10" value={form.pain_level}
            onChange={e => set("pain_level", e.target.value)} />
        </label>
        <label className="ci-field">
          Pain Location
          <input type="text" placeholder="e.g. Lower back" value={form.pain_location}
            onChange={e => set("pain_location", e.target.value)} />
        </label>

        {sel("Hydration",    "hydration_status",    HYDRATION_OPTS)}
        {sel("Nutrition Adherence", "nutrition_adherence", NUTR_OPTS)}
        {sel("Supplement Adherence","supplement_adherence",SUPP_OPTS)}
        {sel("Workout Readiness",   "workout_readiness",   READINESS_OPTS)}

        <label className="ci-field">
          New Injury Reported?
          <select value={form.new_injury_reported} onChange={e => set("new_injury_reported", e.target.value)}>
            {["No","Yes"].map(o => <option key={o}>{o}</option>)}
          </select>
        </label>

        {form.new_injury_reported === "Yes" && (
          <label className="ci-field wide">
            Injury Notes
            <textarea rows={2} value={form.injury_notes}
              onChange={e => set("injury_notes", e.target.value)} />
          </label>
        )}

        <label className="ci-field wide">
          Member Notes
          <textarea rows={2} value={form.member_notes}
            onChange={e => set("member_notes", e.target.value)} placeholder="Any additional notes…" />
        </label>
      </div>

      {msg && <p className={`message text-sm ${msg.startsWith("✓") ? "ok" : msg === "Saving…" ? "" : "error"}`} style={{ marginTop: 10 }}>{msg}</p>}
      <div style={{ marginTop: 14 }}>
        <button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Submit Check-In →"}
        </button>
      </div>
    </form>
  );
}

// ── Weekly check-in form ──────────────────────────────────────────────
function WeeklyCheckInForm({ members, token, onDone }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    member_id: "", week_start_date: today, week_end_date: today,
    average_energy: "Moderate", average_sleep_hours: "",
    average_stress: "Low", average_soreness: "None", average_pain: "",
    weight_update: "", waist_update: "",
    perceived_progress: "Slight Progress",
    workout_adherence_self_rating: "Good",
    nutrition_adherence_self_rating: "Moderate",
    supplement_adherence_self_rating: "Not Applicable",
    biggest_win_this_week: "", biggest_challenge_this_week: "",
    coach_support_needed: "No", member_notes: "", submitted_by: "Admin",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.member_id) { setMsg("Select a member."); return; }
    setLoading(true); setMsg("Saving…");
    try {
      const r = await request("/api/weekly-check-ins/", token, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          average_pain: form.average_pain ? Number(form.average_pain) : null,
          average_sleep_hours: form.average_sleep_hours ? Number(form.average_sleep_hours) : null,
          weight_update: form.weight_update ? Number(form.weight_update) : null,
          waist_update: form.waist_update ? Number(form.waist_update) : null,
        }),
      });
      setMsg("✓ Weekly check-in saved.");
      if (onDone) onDone(r);
    } catch (err) { setMsg("⚠ " + err.message); }
    setLoading(false);
  }

  const sel = (label, key, opts) => (
    <label className="ci-field" key={key}>
      {label}
      <select value={form[key]} onChange={e => set(key, e.target.value)}>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

  return (
    <form className="ci-form panel" onSubmit={submit}>
      <h3 className="ci-form-title">📆 Weekly Check-In</h3>
      <div className="ci-grid">
        <label className="ci-field wide">
          Member *
          <select required value={form.member_id} onChange={e => set("member_id", e.target.value)}>
            <option value="">— Select member —</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select>
        </label>
        <label className="ci-field">
          Week Start
          <input type="date" value={form.week_start_date} onChange={e => set("week_start_date", e.target.value)} />
        </label>
        <label className="ci-field">
          Week End
          <input type="date" value={form.week_end_date} onChange={e => set("week_end_date", e.target.value)} />
        </label>

        {sel("Average Energy",   "average_energy",   ENERGY_OPTS)}
        <label className="ci-field">
          Avg Sleep Hours
          <input type="number" min="0" max="16" step="0.5" value={form.average_sleep_hours}
            onChange={e => set("average_sleep_hours", e.target.value)} placeholder="7.0" />
        </label>
        {sel("Average Stress",   "average_stress",   STRESS_OPTS)}
        {sel("Average Soreness", "average_soreness", SORENESS_OPTS)}
        <label className="ci-field">
          Average Pain (0–10)
          <input type="number" min="0" max="10" step="0.5" value={form.average_pain}
            onChange={e => set("average_pain", e.target.value)} />
        </label>
        <label className="ci-field">
          Weight Update (kg)
          <input type="number" step="0.1" value={form.weight_update}
            onChange={e => set("weight_update", e.target.value)} />
        </label>
        <label className="ci-field">
          Waist Update (cm)
          <input type="number" step="0.1" value={form.waist_update}
            onChange={e => set("waist_update", e.target.value)} />
        </label>

        {sel("Perceived Progress",      "perceived_progress",            ["Going Backwards","No Change","Slight Progress","Good Progress","Excellent Progress"])}
        {sel("Workout Adherence",       "workout_adherence_self_rating",  ["Poor","Moderate","Good","Excellent"])}
        {sel("Nutrition Adherence",     "nutrition_adherence_self_rating",["Poor","Moderate","Good","Excellent"])}
        {sel("Supplement Adherence",    "supplement_adherence_self_rating",["Not Applicable","Poor","Moderate","Good","Excellent"])}
        {sel("Coach Support Needed?",   "coach_support_needed",          ["No","Yes"])}

        <label className="ci-field wide">
          Biggest Win This Week
          <textarea rows={2} value={form.biggest_win_this_week}
            onChange={e => set("biggest_win_this_week", e.target.value)} />
        </label>
        <label className="ci-field wide">
          Biggest Challenge
          <textarea rows={2} value={form.biggest_challenge_this_week}
            onChange={e => set("biggest_challenge_this_week", e.target.value)} />
        </label>
        <label className="ci-field wide">
          Member Notes
          <textarea rows={2} value={form.member_notes}
            onChange={e => set("member_notes", e.target.value)} />
        </label>
      </div>

      {msg && <p className={`message text-sm ${msg.startsWith("✓") ? "ok" : msg === "Saving…" ? "" : "error"}`} style={{ marginTop: 10 }}>{msg}</p>}
      <div style={{ marginTop: 14 }}>
        <button type="submit" disabled={loading}>{loading ? "Saving…" : "Submit Weekly Check-In →"}</button>
      </div>
    </form>
  );
}

// ── Recent check-ins list ─────────────────────────────────────────────
function RecentCheckIns({ checkIns, members }) {
  const memberMap = Object.fromEntries(members.map(m => [m.id, `${m.first_name} ${m.last_name}`]));
  if (!checkIns.length) return <p className="muted text-sm">No check-ins yet.</p>;
  return (
    <div className="ci-recent-list">
      {checkIns.map(ci => (
        <div className="ci-recent-row" key={ci.id}>
          <div className="ci-recent-meta">
            <strong>{memberMap[ci.member_id] || `Member #${ci.member_id}`}</strong>
            <span className="muted text-xs">{ci.check_in_date}</span>
          </div>
          <div className="ci-recent-chips">
            {ci.energy_level && <span className="flag-chip">{ci.energy_level}</span>}
            {ci.pain_level != null && ci.pain_level > 0 && (
              <span className={`flag-chip ${ci.pain_level >= 6 ? "danger" : "warn"}`}>Pain {ci.pain_level}</span>
            )}
            {ci.muscle_soreness && ci.muscle_soreness !== "None" && (
              <span className="flag-chip">{ci.muscle_soreness}</span>
            )}
            {ci.new_injury_reported === "Yes" && <span className="flag-chip danger">Injury!</span>}
            {ci.workout_readiness && (
              <span className={`flag-chip ${ci.workout_readiness === "Not Ready" ? "danger" : ci.workout_readiness === "Light Session Only" ? "warn" : "lime"}`}>
                {ci.workout_readiness}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────
export function CheckInDashboard({ token, members }) {
  const [activeForm, setActiveForm]   = useState("daily");
  const [dashboard,  setDashboard]    = useState(null);
  const [recentCIs,  setRecentCIs]    = useState([]);
  const [refreshKey, setRefreshKey]   = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [dash, cis] = await Promise.all([
        request("/api/readiness/dashboard", token),
        request("/api/check-ins/?limit=20", token),
      ]);
      setDashboard(dash);
      setRecentCIs(cis);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh, refreshKey]);

  function onCheckInDone() { setRefreshKey(k => k + 1); }

  const d = dashboard || {};

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>✅ Check-In Command Centre</h2>
          <p className="muted text-sm" style={{ marginTop: 4 }}>
            Daily and weekly check-ins, readiness scoring and coaching intelligence
          </p>
        </div>
        <button className="ghost" type="button" onClick={refresh}>↻ Refresh</button>
      </div>

      {/* Readiness KPIs */}
      <div className="ci-kpi-row">
        <div className="ci-kpi-card cyan">
          <span className="ci-kpi-label">Members Scored</span>
          <strong className="ci-kpi-value">{d.members_scored ?? "—"}</strong>
        </div>
        <div className={`ci-kpi-card ${d.red_count > 0 ? "danger" : "lime"}`}>
          <span className="ci-kpi-label">🔴 Red Readiness</span>
          <strong className="ci-kpi-value">{d.red_count ?? "—"}</strong>
        </div>
        <div className={`ci-kpi-card ${d.orange_count > 0 ? "warn" : "lime"}`}>
          <span className="ci-kpi-label">🟠 Orange Readiness</span>
          <strong className="ci-kpi-value">{d.orange_count ?? "—"}</strong>
        </div>
        <div className="ci-kpi-card purple">
          <span className="ci-kpi-label">Avg Readiness</span>
          <strong className="ci-kpi-value">{d.average_readiness_score != null ? `${d.average_readiness_score}` : "—"}</strong>
        </div>
        <div className={`ci-kpi-card ${d.open_pain_flags > 0 ? "danger" : "lime"}`}>
          <span className="ci-kpi-label">Open Pain Flags</span>
          <strong className="ci-kpi-value">{d.open_pain_flags ?? "—"}</strong>
        </div>
        <div className={`ci-kpi-card ${d.urgent_coach_tasks > 0 ? "danger" : "lime"}`}>
          <span className="ci-kpi-label">Urgent Tasks</span>
          <strong className="ci-kpi-value">{d.urgent_coach_tasks ?? "—"}</strong>
        </div>
      </div>

      {/* Member readiness table */}
      {(d.member_readiness || []).length > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12 }}>Member Readiness (last 7 days)</h3>
          <div className="ci-readiness-table">
            {d.member_readiness.map(r => (
              <div className="ci-readiness-row" key={r.id}>
                <span className="ci-readiness-icon">{READINESS_ICON[r.category] || "⚪"}</span>
                <span className="ci-readiness-member muted text-xs">#{r.member_id}</span>
                <span className={`ci-readiness-score score-${READINESS_COLOR[r.category]}`}>
                  {r.score}
                </span>
                <span className={`flag-chip ${READINESS_COLOR[r.category]}`}>{r.category}</span>
                <span className="ci-readiness-rec muted text-xs">{r.recommendation_summary?.slice(0, 55)}…</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p2-two-col">
        {/* Left: form toggle + form */}
        <div className="p2-left-list">
          {/* Form toggle */}
          <div className="ci-form-toggle">
            <button
              type="button"
              className={activeForm === "daily" ? "active" : "ghost"}
              onClick={() => setActiveForm("daily")}
            >
              Daily Check-In
            </button>
            <button
              type="button"
              className={activeForm === "weekly" ? "active" : "ghost"}
              onClick={() => setActiveForm("weekly")}
            >
              Weekly Check-In
            </button>
          </div>

          {activeForm === "daily"
            ? <DailyCheckInForm  members={members} token={token} onDone={onCheckInDone} />
            : <WeeklyCheckInForm members={members} token={token} onDone={onCheckInDone} />
          }
        </div>

        {/* Right: recent check-ins */}
        <div className="p2-right-detail">
          <div className="panel" style={{ height: "100%" }}>
            <h3 style={{ marginBottom: 12 }}>Recent Check-Ins</h3>
            <RecentCheckIns checkIns={recentCIs} members={members} />
          </div>
        </div>
      </div>
    </section>
  );
}
