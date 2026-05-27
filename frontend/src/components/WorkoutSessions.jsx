// ── Workout Sessions ──────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { request }     from "../utils/api.js";
import { today }       from "../utils/helpers.js";

const STATUS_COLOR = {
  Completed: "low", "Partially Completed": "medium",
  "Not Started": "draft", Skipped: "draft",
};

export function WorkoutSessions({ token, members }) {
  const [memberId,  setMemberId]  = useState("");
  const [sessions,  setSessions]  = useState([]);
  const [selected,  setSelected]  = useState(null);  // full session detail
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState({ session_date: today(), member_notes: "" });
  const [msg,       setMsg]       = useState("");

  const loadSessions = useCallback(async () => {
    if (!memberId) return;
    try {
      setSessions(await request(`/api/workout-sessions/member/${memberId}`, token));
      setSelected(null);
    } catch { setSessions([]); }
  }, [token, memberId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  async function loadSession(id) {
    try {
      const s = await request(`/api/workout-sessions/${id}`, token);
      setSelected(s);
    } catch (err) { alert(err.message); }
  }

  async function createSession(e) {
    e.preventDefault();
    if (!memberId) { setMsg("Select a member first."); return; }
    setMsg("Creating session…");
    try {
      const payload = {
        member_id: parseInt(memberId),
        session_date: form.session_date,
        member_notes: form.member_notes || null,
      };
      await request("/api/workout-sessions/", token, {
        method: "POST", body: JSON.stringify(payload),
      });
      setMsg("✓ Session created.");
      setShowForm(false);
      setForm({ session_date: today(), member_notes: "" });
      await loadSessions();
    } catch (err) { setMsg(err.message); }
  }

  async function completeSession(id) {
    if (!confirm("Mark this session as complete?")) return;
    try {
      await request(`/api/workout-sessions/${id}/complete`, token, { method: "POST" });
      await loadSessions();
      await loadSession(id);
    } catch (err) { alert(err.message); }
  }

  async function logExercise(sessionId, exData) {
    try {
      await request(`/api/workout-sessions/${sessionId}/exercises/`, token, {
        method: "POST", body: JSON.stringify(exData),
      });
      await loadSession(sessionId);
      await loadSessions();
    } catch (err) { alert(err.message); }
  }

  const memberName = (id) => {
    const m = members.find(m => String(m.id) === String(id));
    return m ? `${m.first_name} ${m.last_name}` : `Member ${id}`;
  };

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>🎯 Workout Sessions</h2>
          <p className="muted text-sm" style={{ marginTop: 4 }}>
            Track individual workout session performance
          </p>
        </div>
        <div className="section-title-right">
          {msg && <span className="message">{msg}</span>}
          {memberId && (
            <button type="button" onClick={() => { setShowForm(s => !s); setMsg(""); }}>
              {showForm ? "Cancel" : "+ New Session"}
            </button>
          )}
        </div>
      </div>

      {/* Member selector */}
      <div className="panel" style={{ marginBottom: 18, padding: "14px 18px" }}>
        <label>Select Member
          <select value={memberId} onChange={e => { setMemberId(e.target.value); setSelected(null); setShowForm(false); }}
            style={{ maxWidth: 360 }}>
            <option value="">— Choose a member —</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.first_name} {m.last_name}
                {m.fitness_level ? ` (${m.fitness_level})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* New session form */}
      {showForm && (
        <form className="panel" style={{ marginBottom: 18 }} onSubmit={createSession}>
          <h3>New Session for {memberName(memberId)}</h3>
          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <label>Session Date *
              <input type="date" required value={form.session_date}
                onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))} />
            </label>
            <label>Member Notes
              <input value={form.member_notes} placeholder="Optional pre-session notes"
                onChange={e => setForm(f => ({ ...f, member_notes: e.target.value }))} />
            </label>
          </div>
          <div style={{ marginTop: 14 }}><button type="submit">Create Session</button></div>
        </form>
      )}

      {!memberId ? (
        <div className="empty-state">
          <span className="empty-state-icon">🎯</span>
          Select a member above to view and track their sessions.
        </div>
      ) : (
        <div className="p2-two-col">
          {/* Session list */}
          <div className="p2-left-list">
            <div className="plan-section-label">
              Sessions ({sessions.length})
            </div>
            {sessions.length === 0 && (
              <div className="empty-state" style={{ minHeight: 100 }}>
                <span className="empty-state-icon">📋</span>
                No sessions yet.
              </div>
            )}
            {sessions.map(s => (
              <div
                key={s.id}
                className={`session-card ${selected?.id === s.id ? "active" : ""}`}
                onClick={() => loadSession(s.id)}
                role="button" tabIndex={0}
                onKeyDown={e => e.key === "Enter" && loadSession(s.id)}
              >
                <div className="session-card-top">
                  <span className="session-date">{s.session_date}</span>
                  <span className={`badge ${STATUS_COLOR[s.completion_status] || "draft"}`}>
                    {s.completion_status}
                  </span>
                </div>

                {/* Completion bar */}
                <div className="completion-bar-wrap">
                  <div className="score-track" style={{ height: 5, marginTop: 6 }}>
                    <div
                      className="score-fill lime"
                      style={{ width: `${s.completion_percentage || 0}%` }}
                    />
                  </div>
                  <span className="completion-label">
                    {(s.completion_percentage || 0).toFixed(0)}%
                    {s.exercises_completed != null && s.total_exercises != null && (
                      <> · {s.exercises_completed}/{s.total_exercises} exercises</>
                    )}
                  </span>
                </div>

                <div className="session-chips">
                  {s.overall_rpe  != null && <span className="history-chip">RPE {s.overall_rpe}</span>}
                  {s.energy_level != null && <span className="history-chip">Energy {s.energy_level}/5</span>}
                  {s.pain_flag && <span className="history-chip" style={{ color: "var(--danger)" }}>⚠ Pain ≥6</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Session detail */}
          <div className="p2-right-detail">
            {!selected ? (
              <div className="empty-state">
                <span className="empty-state-icon">👈</span>
                Select a session to view details.
              </div>
            ) : (
              <SessionDetail
                session={selected}
                token={token}
                onComplete={() => completeSession(selected.id)}
                onLogExercise={ex => logExercise(selected.id, ex)}
                onRefresh={() => loadSession(selected.id)}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Session detail ────────────────────────────────────────────────────

function SessionDetail({ session, token, onComplete, onLogExercise, onRefresh }) {
  const [showLog,   setShowLog]   = useState(false);
  const [logForm,   setLogForm]   = useState({
    exercise_name_snapshot: "", actual_sets: "", actual_reps: "",
    actual_weight: "", pain_score: "", rpe: "", completed: true, notes: "",
  });
  const [updating, setUpdating]   = useState(null);  // exercise id being updated

  async function submitLog(e) {
    e.preventDefault();
    const payload = {
      exercise_name_snapshot:  logForm.exercise_name_snapshot || "Manual Entry",
      actual_sets:             logForm.actual_sets    ? parseInt(logForm.actual_sets)        : null,
      actual_reps:             logForm.actual_reps    || null,
      actual_weight:           logForm.actual_weight  ? parseFloat(logForm.actual_weight)    : null,
      pain_score:              logForm.pain_score     ? parseInt(logForm.pain_score)          : null,
      rpe:                     logForm.rpe            ? parseInt(logForm.rpe)                 : null,
      completed:               logForm.completed,
      notes:                   logForm.notes || null,
    };
    await onLogExercise(payload);
    setShowLog(false);
    setLogForm({ exercise_name_snapshot: "", actual_sets: "", actual_reps: "", actual_weight: "", pain_score: "", rpe: "", completed: true, notes: "" });
  }

  async function toggleExerciseComplete(ex) {
    setUpdating(ex.id);
    try {
      await request(`/api/workout-sessions/${session.id}/exercises/${ex.id}`, token, {
        method: "PUT",
        body: JSON.stringify({
          exercise_name_snapshot: ex.exercise_name_snapshot || "Unknown",
          completed: !ex.completed,
          actual_sets: ex.actual_sets, actual_reps: ex.actual_reps,
          actual_weight: ex.actual_weight, pain_score: ex.pain_score,
          rpe: ex.rpe, notes: ex.notes,
        }),
      });
      await onRefresh();
    } catch (err) { alert(err.message); }
    setUpdating(null);
  }

  const exercises = session.exercises || [];
  const isPct = v => typeof v === "number";

  return (
    <>
      <div className="section-title" style={{ marginBottom: 14 }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>{session.session_date}</h3>
          <span className={`badge ${STATUS_COLOR[session.completion_status] || "draft"}`}>
            {session.completion_status}
          </span>
        </div>
        {session.completion_status === "Not Started" && (
          <button type="button" onClick={onComplete}>✓ Complete</button>
        )}
      </div>

      {/* Stats */}
      <div className="p2-stats-row" style={{ marginBottom: 16 }}>
        {[
          ["Complete", `${(session.completion_percentage || 0).toFixed(0)}%`, "lime"],
          ["RPE",      session.overall_rpe  ?? "—", "purple"],
          ["Energy",   session.energy_level != null ? `${session.energy_level}/5` : "—", "cyan"],
          ["Pain",     session.highest_pain_score  ?? "—", session.pain_flag ? "danger" : "cyan"],
        ].map(([l, v, c]) => (
          <div key={l} className={`stat-card ${c}`} style={{ padding: "12px 14px" }}>
            <div className="stat-card-top"><span className="stat-card-label">{l}</span></div>
            <div className="stat-value" style={{ fontSize: 24 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Exercises */}
      <div className="plan-section-label">Exercises ({exercises.length})</div>
      {exercises.length === 0 ? (
        <p className="muted text-sm" style={{ marginBottom: 12 }}>No exercises logged yet.</p>
      ) : (
        <div className="session-exercise-list">
          {exercises.map(ex => (
            <div
              key={ex.id}
              className={`session-exercise-row ${ex.completed ? "completed" : ""}`}
            >
              <button
                className={ex.completed ? "" : "ghost"}
                type="button"
                style={{ minHeight: 28, padding: "4px 10px", fontSize: 12 }}
                disabled={updating === ex.id}
                onClick={() => toggleExerciseComplete(ex)}
              >
                {ex.completed ? "✓" : "○"}
              </button>
              <div className="session-ex-info">
                <div className="session-ex-name">
                  {ex.exercise_name_snapshot || "Exercise"}
                </div>
                <div className="session-ex-chips">
                  {ex.actual_sets   && <span className="history-chip">{ex.actual_sets} sets</span>}
                  {ex.actual_reps   && <span className="history-chip">{ex.actual_reps} reps</span>}
                  {ex.actual_weight && <span className="history-chip">{ex.actual_weight}kg</span>}
                  {ex.rpe           && <span className="history-chip">RPE {ex.rpe}</span>}
                  {ex.pain_score    && <span className="history-chip" style={{ color: ex.pain_score >= 6 ? "var(--danger)" : "inherit" }}>Pain {ex.pain_score}</span>}
                  {/* Prescribed values */}
                  {ex.prescribed_sets && (
                    <span className="history-chip" style={{ color: "var(--dim)" }}>
                      Rx: {ex.prescribed_sets}×{ex.prescribed_reps}
                      {ex.prescribed_weight ? `@${ex.prescribed_weight}kg` : ""}
                    </span>
                  )}
                </div>
                {ex.notes && <p className="history-row-note" style={{ marginTop: 2 }}>{ex.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual exercise log */}
      {!showLog ? (
        <button className="ghost" type="button" style={{ marginTop: 14, fontSize: 12 }}
          onClick={() => setShowLog(true)}>
          + Log Exercise
        </button>
      ) : (
        <form style={{ marginTop: 14 }} onSubmit={submitLog}>
          <h4>Log Exercise</h4>
          <div className="form-grid-2" style={{ marginTop: 8 }}>
            <label>Exercise Name
              <input value={logForm.exercise_name_snapshot}
                onChange={e => setLogForm(f => ({ ...f, exercise_name_snapshot: e.target.value }))}
                placeholder="e.g. Back Squat" />
            </label>
            <label>Completed?
              <select value={logForm.completed ? "yes" : "no"}
                onChange={e => setLogForm(f => ({ ...f, completed: e.target.value === "yes" }))}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <label>Sets<input type="number" min="1" value={logForm.actual_sets}
              onChange={e => setLogForm(f => ({ ...f, actual_sets: e.target.value }))} /></label>
            <label>Reps<input value={logForm.actual_reps}
              onChange={e => setLogForm(f => ({ ...f, actual_reps: e.target.value }))} /></label>
            <label>Weight (kg)<input type="number" step="0.5" value={logForm.actual_weight}
              onChange={e => setLogForm(f => ({ ...f, actual_weight: e.target.value }))} /></label>
            <label>RPE (1–10)<input type="number" min="1" max="10" value={logForm.rpe}
              onChange={e => setLogForm(f => ({ ...f, rpe: e.target.value }))} /></label>
            <label>Pain Score (1–10)<input type="number" min="1" max="10" value={logForm.pain_score}
              onChange={e => setLogForm(f => ({ ...f, pain_score: e.target.value }))} /></label>
            <label>Notes<input value={logForm.notes}
              onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} /></label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="submit">Log</button>
            <button className="ghost" type="button" onClick={() => setShowLog(false)}>Cancel</button>
          </div>
        </form>
      )}

      {session.member_notes && (
        <div className="form-note info" style={{ marginTop: 16 }}>
          Member note: {session.member_notes}
        </div>
      )}
    </>
  );
}
