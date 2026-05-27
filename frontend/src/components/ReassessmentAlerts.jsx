// ── Reassessment Alerts ───────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { request } from "../utils/api.js";

const SEV_COLOR  = { High: "danger", Medium: "medium", Low: "low" };
const STAT_COLOR = { Open: "danger", Reviewed: "medium", Closed: "draft" };

const SEV_DOT_STYLE = {
  High:   { background: "var(--danger)", boxShadow: "0 0 8px var(--danger)" },
  Medium: { background: "var(--warn)" },
  Low:    { background: "var(--success)" },
};

export function ReassessmentAlerts({ token, members }) {
  const [alerts,   setAlerts]   = useState([]);
  const [filters,  setFilters]  = useState({ status: "Open", severity: "" });
  const [evalId,   setEvalId]   = useState("");
  const [evalMsg,  setEvalMsg]  = useState("");
  const [msg,      setMsg]      = useState("");

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (filters.status)   p.set("status",   filters.status);
    if (filters.severity) p.set("severity", filters.severity);
    try {
      setAlerts(await request(`/api/reassessment-alerts/?${p}`, token));
    } catch { setAlerts([]); }
  }, [token, filters]);

  useEffect(() => { load(); }, [load]);

  async function reviewAlert(id) {
    try {
      await request(`/api/reassessment-alerts/${id}/review`, token, { method: "PATCH" });
      setMsg("✓ Alert marked as reviewed.");
      await load();
    } catch (err) { setMsg(err.message); }
  }

  async function closeAlert(id) {
    try {
      await request(`/api/reassessment-alerts/${id}/close`, token, { method: "PATCH" });
      setMsg("✓ Alert closed.");
      await load();
    } catch (err) { setMsg(err.message); }
  }

  async function evaluateMember(e) {
    e.preventDefault();
    if (!evalId) { setEvalMsg("Select a member."); return; }
    setEvalMsg("Evaluating…");
    try {
      const r = await request(
        `/api/reassessment-alerts/evaluate/${evalId}`, token, { method: "POST" }
      );
      setEvalMsg(`✓ Evaluated — ${r.new_alerts} new alert${r.new_alerts !== 1 ? "s" : ""} created.`);
      await load();
    } catch (err) { setEvalMsg(err.message); }
  }

  // Counts for summary bar
  const counts = { High: 0, Medium: 0, Low: 0, Open: 0 };
  alerts.forEach(a => {
    if (a.severity) counts[a.severity] = (counts[a.severity] || 0) + 1;
    if (a.status === "Open") counts.Open++;
  });

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>🔔 Reassessment Alerts</h2>
          <p className="muted text-sm" style={{ marginTop: 4 }}>
            Automated triggers — assessment overdue, pain flags, RPE spikes, adherence signals
          </p>
        </div>
        <div className="section-title-right">
          {msg && <span className="message">{msg}</span>}
          <button className="ghost" type="button" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="p2-stats-row" style={{ marginBottom: 20 }}>
        {[
          ["Total Alerts", alerts.length,    "cyan"],
          ["Open",         counts.Open,      "danger"],
          ["High",         counts.High,      "danger"],
          ["Medium",       counts.Medium,    "medium"],
        ].map(([l, v, c]) => (
          <div key={l} className={`stat-card ${c}`} style={{ padding: "14px 18px" }}>
            <div className="stat-card-top"><span className="stat-card-label">{l}</span></div>
            <div className="stat-value" style={{ fontSize: 30 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Controls row */}
      <div className="p2-controls-row" style={{ marginBottom: 18 }}>
        {/* Filters */}
        <div className="panel" style={{ padding: "14px 18px", flex: 1 }}>
          <div className="p2-filter-row">
            <label>Status
              <select value={filters.status}
                onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                <option value="">All</option>
                <option value="Open">Open</option>
                <option value="Reviewed">Reviewed</option>
                <option value="Closed">Closed</option>
              </select>
            </label>
            <label>Severity
              <select value={filters.severity}
                onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}>
                <option value="">All</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </label>
            <button className="ghost" type="button" onClick={load} style={{ alignSelf: "flex-end" }}>
              🔍 Filter
            </button>
          </div>
        </div>

        {/* Evaluate member */}
        <form className="panel" style={{ padding: "14px 18px", minWidth: 280 }} onSubmit={evaluateMember}>
          <h4 style={{ marginBottom: 8 }}>Evaluate Member</h4>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <label style={{ flex: 1 }}>Member
              <select value={evalId} onChange={e => { setEvalId(e.target.value); setEvalMsg(""); }}>
                <option value="">Select…</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" style={{ flexShrink: 0, alignSelf: "flex-end" }}>Run</button>
          </div>
          {evalMsg && <p className="muted text-xs" style={{ marginTop: 6 }}>{evalMsg}</p>}
        </form>
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">✅</span>
          No alerts match the current filters.
        </div>
      ) : (
        <div className="p2-alert-list">
          {alerts.map(a => (
            <div key={a.id} className={`p2-alert-row sev-${(a.severity || "low").toLowerCase()}`}>
              {/* Severity dot */}
              <div
                className="alert-urgency-dot"
                style={SEV_DOT_STYLE[a.severity] || {}}
              />

              {/* Content */}
              <div className="p2-alert-content">
                <div className="p2-alert-top">
                  <span className="p2-alert-member">{a.member_name || `Member #${a.member_id}`}</span>
                  <span className="p2-alert-type">{a.trigger_type}</span>
                </div>
                <p className="p2-alert-message">{a.trigger_message}</p>
                <div className="p2-alert-meta">
                  <span className={`badge ${SEV_COLOR[a.severity] || "draft"}`}>{a.severity}</span>
                  <span className={`badge ${STAT_COLOR[a.status] || "draft"}`}>{a.status}</span>
                  <span className="muted text-xs">
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}
                  </span>
                  {a.reviewed_at && (
                    <span className="muted text-xs">
                      Actioned {new Date(a.reviewed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {a.status === "Open" && (
                <div className="p2-alert-actions">
                  <button className="ghost" type="button" style={{ fontSize: 11, padding: "4px 10px", minHeight: 28 }}
                    onClick={() => reviewAlert(a.id)}>
                    Review
                  </button>
                  <button className="ghost" type="button" style={{ fontSize: 11, padding: "4px 10px", minHeight: 28 }}
                    onClick={() => closeAlert(a.id)}>
                    Close
                  </button>
                </div>
              )}
              {a.status === "Reviewed" && (
                <div className="p2-alert-actions">
                  <button className="ghost" type="button" style={{ fontSize: 11, padding: "4px 10px", minHeight: 28 }}
                    onClick={() => closeAlert(a.id)}>
                    Close
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
