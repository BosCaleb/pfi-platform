// ── Coaching Intelligence Dashboard — Phase 3.2 ───────────────────────────
import { useState, useEffect, useCallback } from "react";
import { request } from "../utils/api.js";

const TYPE_ICON = {
  "Workout Progression":  "🚀",
  "Workout Regression":   "↘",
  "Exercise Substitution":"🔄",
  "Group Change":         "👥",
  "Deload":               "🔴",
  "Reassessment":         "📋",
  "Coach Follow-Up":      "📞",
  "Nutrition Adjustment": "🥗",
  "Supplement Review":    "💊",
  "Safety Review":        "⚠",
  "Motivation Intervention":"💪",
};

const SEV_COLOR = {
  Critical: "danger",
  High:     "warn",
  Medium:   "cyan",
  Low:      "purple",
};

const STATUS_COLOR = {
  Approved: "lime",
  Applied:  "cyan",
  Rejected: "danger",
  Archived: "purple",
};

function RecCard({ rec, member, selected, onSelect }) {
  const name = member
    ? `${member.first_name} ${member.last_name}`
    : `Member #${rec.member_id}`;
  const icon = TYPE_ICON[rec.recommendation_type] || "💡";
  return (
    <div
      className={`rec-card ${selected ? "selected" : ""} sev-${(SEV_COLOR[rec.severity] || "cyan")}`}
      onClick={() => onSelect(rec)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onSelect(rec)}
    >
      <div className="rec-card-icon">{icon}</div>
      <div className="rec-card-body">
        <div className="rec-card-title">{rec.title}</div>
        <div className="rec-card-meta muted text-xs">
          {name} · {rec.recommendation_type}
          {rec.created_at
            ? ` · ${new Date(rec.created_at).toLocaleDateString()}`
            : ""}
        </div>
        <div className="rec-card-summary text-sm" style={{ marginTop: 4, color: "var(--muted)" }}>
          {rec.summary}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
        <span className={`flag-chip ${SEV_COLOR[rec.severity] || "cyan"}`}>{rec.severity}</span>
        <span className={`flag-chip ${STATUS_COLOR[rec.status] || "cyan"}`}>{rec.status}</span>
        {rec.confidence_score != null && (
          <span className="flag-chip" style={{ fontSize: 10 }}>
            {Math.round(rec.confidence_score * 100)}% confidence
          </span>
        )}
      </div>
    </div>
  );
}

function RecDetail({ rec, token, member, onUpdated, onClose }) {
  const [status, setStatus]       = useState(rec.status);
  const [editNotes, setEditNotes] = useState(rec.admin_edit_notes || "");
  const [rejectReason, setReject] = useState(rec.rejection_reason || "");
  const [msg, setMsg]             = useState("");
  const icon = TYPE_ICON[rec.recommendation_type] || "💡";
  const name = member
    ? `${member.first_name} ${member.last_name}`
    : `Member #${rec.member_id}`;

  let supporting = rec.supporting_data || {};
  if (typeof supporting === "string") {
    try { supporting = JSON.parse(supporting); } catch { supporting = {}; }
  }

  async function save() {
    setMsg("Saving…");
    try {
      const r = await request(`/api/coaching-recommendations/${rec.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status, admin_edit_notes: editNotes, rejection_reason: rejectReason }),
      });
      setMsg("✓ Updated");
      onUpdated(r);
    } catch (err) { setMsg("⚠ " + err.message); }
  }

  return (
    <div className="panel rec-detail">
      <div className="section-title" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 28 }}>{icon}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>{rec.title}</h3>
            <div className="muted text-xs">{rec.recommendation_type} · {name}</div>
          </div>
        </div>
        <button className="ghost" type="button" onClick={onClose} style={{ fontSize: 12 }}>✕ Close</button>
      </div>

      <div className="rec-detail-chips" style={{ marginBottom: 14 }}>
        <span className={`flag-chip ${SEV_COLOR[rec.severity] || "cyan"}`}>{rec.severity}</span>
        <span className={`flag-chip ${STATUS_COLOR[rec.status] || "cyan"}`}>{rec.status}</span>
        <span className="flag-chip">{rec.generated_by}</span>
        {rec.confidence_score != null && (
          <span className="flag-chip">{Math.round(rec.confidence_score * 100)}% confidence</span>
        )}
        {rec.created_at && (
          <span className="muted text-xs">{new Date(rec.created_at).toLocaleDateString()}</span>
        )}
      </div>

      {/* Summary */}
      <div className="disc-callout" style={{ marginBottom: 12 }}>
        {rec.summary}
      </div>

      {/* Detailed reason */}
      {rec.detailed_reason && (
        <div className="intel-section" style={{ marginBottom: 12 }}>
          <h4 style={{ marginBottom: 8 }}>Why this recommendation?</h4>
          <p className="text-sm" style={{ lineHeight: 1.6, color: "var(--muted)" }}>
            {rec.detailed_reason}
          </p>
        </div>
      )}

      {/* Supporting data */}
      {Object.keys(supporting).length > 0 && (
        <div className="intel-section" style={{ marginBottom: 12 }}>
          <h4 style={{ marginBottom: 8 }}>📊 Supporting Data</h4>
          <div className="rec-data-grid">
            {Object.entries(supporting).map(([k, v]) => (
              <div className="rec-data-item" key={k}>
                <span className="muted text-xs">{k.replace(/_/g, " ")}</span>
                <strong style={{ fontSize: 14 }}>{String(v ?? "—")}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin actions */}
      <div style={{ display: "grid", gap: 10 }}>
        <label>
          Status
          <select value={status} onChange={e => setStatus(e.target.value)}>
            {["Approved", "Applied", "Rejected", "Archived"].map(s => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Admin Notes
          <textarea rows={2} value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            placeholder="Add a note about this recommendation…" />
        </label>
        {status === "Rejected" && (
          <label>
            Rejection Reason
            <input type="text" value={rejectReason}
              onChange={e => setReject(e.target.value)}
              placeholder="Why is this being rejected?" />
          </label>
        )}
      </div>

      {msg && (
        <p className={`message text-sm ${msg.startsWith("✓") ? "ok" : msg === "Saving…" ? "" : "error"}`}
           style={{ marginTop: 8 }}>{msg}</p>
      )}

      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={save}>Save Changes</button>
        {status !== "Applied" && (
          <button className="secondary" type="button" onClick={() => { setStatus("Applied"); }}>
            Mark Applied
          </button>
        )}
        {status !== "Archived" && (
          <button className="ghost" type="button" onClick={() => { setStatus("Archived"); }}>
            Archive
          </button>
        )}
      </div>
    </div>
  );
}

export function CoachingIntelligence({ token, members }) {
  const [recs,     setRecs]     = useState([]);
  const [dash,     setDash]     = useState(null);
  const [selected, setSelected] = useState(null);
  const [filters,  setFilters]  = useState({
    status: "", type: "", severity: "", member_id: "",
  });
  const [generating, setGenerating] = useState(false);
  const [genMsg,     setGenMsg]     = useState("");
  const [genMemberId, setGenMember] = useState("");

  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (filters.status)    p.set("status",   filters.status);
      if (filters.type)      p.set("type",     filters.type);
      if (filters.severity)  p.set("severity", filters.severity);
      if (filters.member_id) p.set("member_id",filters.member_id);
      const [recsData, dashData] = await Promise.allSettled([
        request(`/api/coaching-recommendations/?${p}`, token),
        request("/api/coaching-recommendations/dashboard", token),
      ]);
      if (recsData.status === "fulfilled")  setRecs(recsData.value);
      if (dashData.status === "fulfilled")  setDash(dashData.value);
    } catch { /* silent */ }
  }, [token, filters]);

  useEffect(() => { load(); }, [load]);

  async function generateRecs(e) {
    e.preventDefault();
    if (!genMemberId) return;
    setGenerating(true);
    setGenMsg("Generating…");
    try {
      const r = await request(`/api/coaching-recommendations/generate/${genMemberId}`, token, { method: "POST" });
      setGenMsg(`✓ ${r.message}`);
      load();
    } catch (err) {
      setGenMsg("⚠ " + err.message);
    } finally {
      setGenerating(false);
    }
  }

  function onUpdated(updated) {
    setRecs(rs => rs.map(r => r.id === updated.id ? updated : r));
    setSelected(updated);
    load();
  }

  const d = dash || {};

  return (
    <section className="animate-in">
      {/* Header */}
      <div className="section-title">
        <div>
          <h2>🧠 Coaching Intelligence</h2>
          <p className="muted text-sm" style={{ marginTop: 4 }}>
            Rule-based recommendations · AI Coach Copilot · Admin approval workflow
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ghost" type="button" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="ci-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", marginBottom: 18 }}>
        <div className={`ci-kpi-card ${d.critical > 0 ? "danger" : "lime"}`}>
          <span className="ci-kpi-label">🔴 Critical</span>
          <strong className="ci-kpi-value">{d.critical ?? 0}</strong>
        </div>
        <div className={`ci-kpi-card ${d.safety_reviews > 0 ? "warn" : "lime"}`}>
          <span className="ci-kpi-label">⚠ Safety</span>
          <strong className="ci-kpi-value">{d.safety_reviews ?? 0}</strong>
        </div>
        <div className="ci-kpi-card cyan">
          <span className="ci-kpi-label">Approved</span>
          <strong className="ci-kpi-value">{d.approved ?? 0}</strong>
        </div>
        <div className="ci-kpi-card lime">
          <span className="ci-kpi-label">🚀 Progressions</span>
          <strong className="ci-kpi-value">{d.progression_ready ?? 0}</strong>
        </div>
        <div className={`ci-kpi-card ${d.deload_recommended > 0 ? "warn" : "lime"}`}>
          <span className="ci-kpi-label">🔴 Deloads</span>
          <strong className="ci-kpi-value">{d.deload_recommended ?? 0}</strong>
        </div>
        <div className="ci-kpi-card purple">
          <span className="ci-kpi-label">Applied</span>
          <strong className="ci-kpi-value">{d.applied ?? 0}</strong>
        </div>
      </div>

      {/* Generate panel */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 10 }}>⚡ Generate Recommendations</h4>
        <form onSubmit={generateRecs} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ flex: 1, minWidth: 200 }}>
            <span className="muted text-xs" style={{ display: "block", marginBottom: 4 }}>Select Member</span>
            <select required value={genMemberId} onChange={e => setGenMember(e.target.value)}>
              <option value="">— Choose member —</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={generating}>
            {generating ? "Generating…" : "Run Engine"}
          </button>
        </form>
        {genMsg && (
          <p className={`message text-xs ${genMsg.startsWith("✓") ? "ok" : genMsg === "Generating…" ? "" : "error"}`}
             style={{ marginTop: 8 }}>{genMsg}</p>
        )}
      </div>

      {/* Disclaimer */}
      <div className="form-note info wide" style={{ marginBottom: 14 }}>
        ℹ All recommendations are generated by transparent rule-based logic. They do not diagnose, prescribe or
        automatically change any plan. AI can recommend — admin must apply.
      </div>

      {/* Filters */}
      <div className="p2-filter-bar" style={{ marginBottom: 14 }}>
        <div className="p2-filter-row">
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {["Approved","Applied","Rejected","Archived"].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
            <option value="">All Types</option>
            {Object.keys(TYPE_ICON).map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={filters.severity} onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}>
            <option value="">All Severities</option>
            {["Critical","High","Medium","Low"].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filters.member_id} onChange={e => setFilters(f => ({ ...f, member_id: e.target.value }))}>
            <option value="">All Members</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="p2-two-col">
        <div className="p2-left-list">
          {recs.length === 0
            ? (
              <div className="empty-state">
                <span className="empty-state-icon">🧠</span>
                No recommendations match the current filters.
                Select a member and click "Run Engine" to generate.
              </div>
            )
            : recs.map(r => {
                const m = members.find(m => m.id === r.member_id);
                return (
                  <RecCard
                    key={r.id}
                    rec={r}
                    member={m}
                    selected={selected?.id === r.id}
                    onSelect={setSelected}
                  />
                );
              })
          }
        </div>

        <div className="p2-right-detail">
          {selected
            ? (
              <RecDetail
                rec={selected}
                token={token}
                member={members.find(m => m.id === selected.member_id)}
                onUpdated={onUpdated}
                onClose={() => setSelected(null)}
              />
            )
            : (
              <div className="panel" style={{ padding: "32px 24px", textAlign: "center" }}>
                <div className="empty-state-icon" style={{ fontSize: 48 }}>🧠</div>
                <p className="muted text-sm">Select a recommendation to review, approve or apply it.</p>
                <p className="muted text-xs" style={{ marginTop: 8 }}>
                  Every recommendation shows its triggering data and reasoning.
                </p>
              </div>
            )
          }
        </div>
      </div>
    </section>
  );
}
