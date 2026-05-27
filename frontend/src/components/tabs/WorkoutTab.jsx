// ── Workout Tab (within MemberDetail) ────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { request } from "../../utils/api.js";
import { Badge }   from "../ui/Badge.jsx";

const SEV_COLOR = { High: "danger", Medium: "medium", Low: "low" };
const STATUS_COLOR = {
  Completed: "low", "Partially Completed": "medium",
  "Not Started": "draft", Skipped: "draft",
};

const LEVEL_COLOR = { Beginner: "lime", Intermediate: "cyan", Advanced: "purple" };

export function WorkoutTab({ member, token }) {
  const mid = member.id;

  const [currentGroup,    setCurrentGroup]    = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [sessions,        setSessions]        = useState([]);
  const [alerts,          setAlerts]          = useState([]);
  const [groups,          setGroups]          = useState([]);    // for assignment
  const [showAssign,      setShowAssign]       = useState(false);
  const [assignGroupId,   setAssignGroupId]    = useState("");
  const [assignReason,    setAssignReason]     = useState("");
  const [msg,             setMsg]             = useState("");
  const [showRecs,        setShowRecs]        = useState(false);
  const [evalMsg,         setEvalMsg]         = useState("");

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      request(`/api/member-groups/member/${mid}/current`,      token),
      request(`/api/workout-sessions/member/${mid}`,           token),
      request(`/api/reassessment-alerts/member/${mid}?status=Open`, token),
      request("/api/workout-groups/?status=Active",            token),
    ]);
    setCurrentGroup(    results[0].status === "fulfilled" ? results[0].value : null);
    setSessions(        results[1].status === "fulfilled" ? results[1].value : []);
    setAlerts(          results[2].status === "fulfilled" ? results[2].value : []);
    setGroups(          results[3].status === "fulfilled" ? results[3].value : []);
  }, [token, mid]);

  useEffect(() => { load(); }, [load]);

  async function loadRecs() {
    setShowRecs(true);
    try {
      const r = await request(`/api/member-groups/member/${mid}/recommendation`, token);
      setRecommendations(r);
    } catch { setRecommendations([]); }
  }

  async function assignGroup(e) {
    e.preventDefault();
    if (!assignGroupId) return;
    setMsg("Assigning…");
    try {
      await request("/api/member-groups/assign", token, {
        method: "POST",
        body: JSON.stringify({
          member_id:       mid,
          workout_group_id: parseInt(assignGroupId),
          assignment_reason: assignReason || null,
          is_system_recommended: false,
        }),
      });
      setMsg("✓ Group assigned.");
      setShowAssign(false);
      setAssignGroupId("");
      setAssignReason("");
      await load();
    } catch (err) { setMsg(err.message); }
  }

  async function removeGroup(assignmentId) {
    if (!confirm("Remove this member from their current group?")) return;
    try {
      await request(`/api/member-groups/${assignmentId}/remove`, token, { method: "PATCH" });
      setMsg("✓ Removed from group.");
      await load();
    } catch (err) { setMsg(err.message); }
  }

  async function evaluateMember() {
    setEvalMsg("Running evaluation…");
    try {
      const r = await request(`/api/reassessment-alerts/evaluate/${mid}`, token, { method: "POST" });
      setEvalMsg(`✓ ${r.new_alerts} new alert${r.new_alerts !== 1 ? "s" : ""} created.`);
      await load();
    } catch (err) { setEvalMsg(err.message); }
  }

  async function reviewAlert(id) {
    try {
      await request(`/api/reassessment-alerts/${id}/review`, token, { method: "PATCH" });
      await load();
    } catch (err) { alert(err.message); }
  }

  async function closeAlert(id) {
    try {
      await request(`/api/reassessment-alerts/${id}/close`, token, { method: "PATCH" });
      await load();
    } catch (err) { alert(err.message); }
  }

  const recent = sessions.slice(0, 5);

  return (
    <div>
      {/* Status messages */}
      {msg && <p className="message" style={{ marginBottom: 12 }}>{msg}</p>}

      {/* ── Group Assignment ── */}
      <div className="intel-section">
        <div className="section-title" style={{ marginBottom: 10 }}>
          <div className="plan-section-label" style={{ margin: 0 }}>🏋️ Group Assignment</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="ghost" type="button"
              style={{ fontSize: 11, padding: "4px 10px", minHeight: 28 }}
              onClick={showRecs ? () => setShowRecs(false) : loadRecs}>
              {showRecs ? "Hide" : "💡 Recommend"}
            </button>
            <button className="ghost" type="button"
              style={{ fontSize: 11, padding: "4px 10px", minHeight: 28 }}
              onClick={() => setShowAssign(s => !s)}>
              {showAssign ? "Cancel" : "+ Assign"}
            </button>
          </div>
        </div>

        {currentGroup ? (
          <div className="plan-card">
            <div className="plan-card-header">
              <div>
                <div className="plan-card-name">{currentGroup.group_name}</div>
                <div className="plan-card-meta">
                  <Badge value="Active" />
                  {currentGroup.start_date && (
                    <span className="history-chip">Since {currentGroup.start_date}</span>
                  )}
                  {currentGroup.is_system_recommended && (
                    <span className="history-chip highlight">AI Pick</span>
                  )}
                </div>
              </div>
              <button className="delete-btn" type="button"
                onClick={() => removeGroup(currentGroup.id)}>✕</button>
            </div>
            {currentGroup.assignment_reason && (
              <p className="history-row-note">{currentGroup.assignment_reason}</p>
            )}
          </div>
        ) : (
          <p className="muted text-sm">No group assigned — use + Assign to add one.</p>
        )}

        {/* Recommendations */}
        {showRecs && recommendations.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="plan-section-label">Top 5 Group Recommendations</div>
            <div className="plans-stack">
              {recommendations.map(r => (
                <div key={r.group_id} className="plan-card">
                  <div className="plan-card-header">
                    <div>
                      <div className="plan-card-name">{r.group_name}</div>
                      <div className="plan-card-meta">
                        <span className="history-chip highlight">Score: {r.score}</span>
                      </div>
                    </div>
                    <button type="button" style={{ fontSize: 11, padding: "4px 10px", minHeight: 28 }}
                      onClick={() => { setAssignGroupId(String(r.group_id)); setAssignReason(r.reason); setShowAssign(true); setShowRecs(false); }}>
                      Assign
                    </button>
                  </div>
                  <p className="history-row-note">{r.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assign form */}
        {showAssign && (
          <form style={{ marginTop: 12 }} onSubmit={assignGroup}>
            <div className="form-grid-2">
              <label>Group *
                <select value={assignGroupId} onChange={e => setAssignGroupId(e.target.value)}>
                  <option value="">Select group…</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.group_name} ({g.target_fitness_level})
                    </option>
                  ))}
                </select>
              </label>
              <label>Reason
                <input value={assignReason}
                  onChange={e => setAssignReason(e.target.value)}
                  placeholder="Optional reason for assignment" />
              </label>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button type="submit">Assign to Group</button>
              <button className="ghost" type="button" onClick={() => setShowAssign(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* ── Recent Sessions ── */}
      <div className="intel-section" style={{ marginTop: 20 }}>
        <div className="plan-section-label">🎯 Recent Sessions ({sessions.length})</div>
        {recent.length === 0 ? (
          <p className="muted text-sm">No sessions recorded yet.</p>
        ) : (
          <div className="history-list">
            {recent.map(s => (
              <div key={s.id} className="history-row">
                <div>
                  <div className="history-row-date">{s.session_date}</div>
                  <div className="history-row-chips">
                    <span className={`badge ${STATUS_COLOR[s.completion_status] || "draft"}`}>
                      {s.completion_status}
                    </span>
                    <span className="history-chip">
                      {(s.completion_percentage || 0).toFixed(0)}% complete
                    </span>
                    {s.overall_rpe  != null && <span className="history-chip">RPE {s.overall_rpe}</span>}
                    {s.energy_level != null && <span className="history-chip">Energy {s.energy_level}/5</span>}
                    {s.pain_flag && (
                      <span className="history-chip" style={{ color: "var(--danger)" }}>⚠ Pain ≥6</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Reassessment Alerts ── */}
      <div className="intel-section" style={{ marginTop: 20 }}>
        <div className="section-title" style={{ marginBottom: 10 }}>
          <div className="plan-section-label" style={{ margin: 0 }}>
            🔔 Open Alerts ({alerts.length})
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {evalMsg && <span className="muted text-xs">{evalMsg}</span>}
            <button className="ghost" type="button"
              style={{ fontSize: 11, padding: "4px 10px", minHeight: 28 }}
              onClick={evaluateMember}>
              Run Evaluation
            </button>
          </div>
        </div>

        {alerts.length === 0 ? (
          <p className="muted text-sm">No open alerts for this member.</p>
        ) : (
          <div className="p2-alert-list">
            {alerts.map(a => (
              <div key={a.id} className={`p2-alert-row sev-${(a.severity || "low").toLowerCase()}`}>
                <div className="alert-urgency-dot" style={{
                  background: a.severity === "High" ? "var(--danger)" : a.severity === "Medium" ? "var(--warn)" : "var(--success)",
                }} />
                <div className="p2-alert-content">
                  <div className="p2-alert-top">
                    <span className="p2-alert-type">{a.trigger_type}</span>
                    <span className={`badge ${SEV_COLOR[a.severity] || "draft"}`}>{a.severity}</span>
                  </div>
                  <p className="p2-alert-message">{a.trigger_message}</p>
                </div>
                <div className="p2-alert-actions">
                  <button className="ghost" type="button"
                    style={{ fontSize: 11, padding: "4px 8px", minHeight: 24 }}
                    onClick={() => reviewAlert(a.id)}>Review</button>
                  <button className="ghost" type="button"
                    style={{ fontSize: 11, padding: "4px 8px", minHeight: 24 }}
                    onClick={() => closeAlert(a.id)}>Close</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
