import { useState, useEffect } from "react";
import { apiFetch } from "../api";

const STATUS_COLORS = {
  Draft:               "#94a3b8",
  "Ready for Review":  "var(--warn)",
  "Shared with Member":"var(--lime)",
  Archived:            "#475569",
};

export default function ReportsPage({ token }) {
  const [reports,  setReports]  = useState([]);
  const [members,  setMembers]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [genLoad,  setGenLoad]  = useState(false);
  const [filter,   setFilter]   = useState("all");
  const [error,    setError]    = useState("");
  const [editing,  setEditing]  = useState({});

  const [form, setForm] = useState({
    member_id:       "",
    report_type:     "Monthly Progress Report",
    date_range_start:"",
    date_range_end:  "",
  });

  const hdr = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/reports/", { headers: hdr });
      setReports(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    apiFetch("/api/members/", { headers: hdr }).then(setMembers).catch(() => {});
  }, []);

  const generate = async () => {
    if (!form.member_id) { setError("Select a member."); return; }
    setGenLoad(true); setError("");
    try {
      const res = await apiFetch("/api/reports/generate", {
        method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, member_id: Number(form.member_id) }),
      });
      setReports(prev => [res, ...prev]);
      openReport(res);
    } catch (e) { setError(e.message); }
    setGenLoad(false);
  };

  const openReport = (r) => {
    setSelected(r);
    setEditing({ coach_final_notes: r.coach_final_notes || "", ai_summary: r.ai_summary || "" });
  };

  const update = async (id, patch) => {
    try {
      const res = await apiFetch(`/api/reports/${id}`, {
        method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setReports(prev => prev.map(r => r.id === id ? res : r));
      setSelected(res);
    } catch (e) { setError(e.message); }
  };

  const del = async (id) => {
    if (!confirm("Delete this report?")) return;
    await apiFetch(`/api/reports/${id}`, { method: "DELETE", headers: hdr });
    setReports(prev => prev.filter(r => r.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const filtered = filter === "all" ? reports : reports.filter(r => r.status === filter);

  return (
    <div className="ai-coach-wrap">
      <div className="ai-coach-header">
        <h2 className="section-title">📄 Member Reports</h2>
        <p className="section-sub">Generate AI-assisted progress reports, review, edit and share with members.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel ai-gen-card">
        <h3 className="panel-title">Generate Report</h3>
        <div className="ai-gen-row">
          <div className="field-group">
            <label>Member</label>
            <select value={form.member_id} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
              <option value="">— select —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label>Report Type</label>
            <select value={form.report_type} onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}>
              {["Monthly Progress Report","Quarterly Review","8-Week Block Report","Annual Summary"].map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label>Start Date</label>
            <input type="date" value={form.date_range_start}
              onChange={e => setForm(f => ({ ...f, date_range_start: e.target.value }))} />
          </div>
          <div className="field-group">
            <label>End Date</label>
            <input type="date" value={form.date_range_end}
              onChange={e => setForm(f => ({ ...f, date_range_end: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={generate} disabled={genLoad}>
            {genLoad ? "Generating…" : "⚡ Generate"}
          </button>
        </div>
      </div>

      <div className="ai-coach-layout">
        <div className="ai-list-col">
          <div className="filter-bar">
            {["all","Draft","Ready for Review","Shared with Member","Archived"].map(f => (
              <button key={f} className={`filter-chip ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}>{f === "all" ? "All" : f}</button>
            ))}
          </div>
          {loading && <div className="loading-pulse">Loading…</div>}
          {filtered.map(r => (
            <div key={r.id}
              className={`ai-output-card ${selected?.id === r.id ? "selected" : ""}`}
              onClick={() => openReport(r)}>
              <div className="aio-top">
                <span className="aio-type">{r.report_type}</span>
                <span className="status-chip" style={{ color: STATUS_COLORS[r.status] || "#94a3b8" }}>
                  {r.status}
                </span>
              </div>
              <div className="aio-meta">
                👤 {r.member_name} · {r.date_range_start ? r.date_range_start.slice(0, 7) : ""}
              </div>
              {r.shared_with_member && <div className="shared-badge">📤 Shared</div>}
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="empty-state">No reports yet.</div>
          )}
        </div>

        {selected && (
          <div className="ai-detail-col panel">
            <div className="ai-detail-header">
              <div>
                <span className="aio-type-lg">{selected.report_title}</span>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className="ai-detail-meta">
              <span>👤 {selected.member_name}</span>
              <span>📅 {selected.date_range_start} → {selected.date_range_end}</span>
              <span className="status-chip" style={{ color: STATUS_COLORS[selected.status] }}>{selected.status}</span>
            </div>

            {selected.shared_with_member && (
              <div className="suggestion-box" style={{ borderColor: "var(--lime)" }}>
                📤 Shared with member on {selected.shared_at ? new Date(selected.shared_at).toLocaleString() : "—"}
              </div>
            )}

            {/* Data Snapshot */}
            {selected.report_data_snapshot && (() => {
              try {
                const snap = JSON.parse(selected.report_data_snapshot);
                return (
                  <div className="panel snap-grid">
                    {[
                      ["Sessions",      snap.sessions_completed + " / " + snap.sessions_total],
                      ["Attendance",    snap.attendance_rate + "%"],
                      ["Avg Completion",snap.avg_completion_pct + "%"],
                      ["Readiness",     snap.avg_readiness_score ?? "—"],
                      ["Weight Δ",      snap.weight_delta != null ? snap.weight_delta + " kg" : "—"],
                      ["Assessments",   snap.assessments_count],
                    ].map(([k, v]) => (
                      <div key={k} className="snap-cell">
                        <div className="snap-val">{v}</div>
                        <div className="snap-lbl">{k}</div>
                      </div>
                    ))}
                  </div>
                );
              } catch { return null; }
            })()}

            <div className="plan-edit-section">
              <label>🤖 AI Summary (editable)</label>
              <textarea className="plan-content-editor" rows={14}
                value={editing.ai_summary ?? ""}
                onChange={e => setEditing(ed => ({ ...ed, ai_summary: e.target.value }))} />
            </div>

            <div className="plan-edit-section">
              <label>✍️ Coach Final Notes</label>
              <textarea className="plan-content-editor" rows={5}
                placeholder="Add your coaching commentary before sharing…"
                value={editing.coach_final_notes ?? ""}
                onChange={e => setEditing(ed => ({ ...ed, coach_final_notes: e.target.value }))} />
            </div>

            <div className="ai-action-row">
              <button className="btn-ghost" onClick={() => update(selected.id, {
                ai_summary: editing.ai_summary,
                coach_final_notes: editing.coach_final_notes,
              })}>💾 Save</button>

              {selected.status === "Draft" && (
                <button className="btn-warn" onClick={() => update(selected.id, { status: "Ready for Review" })}>
                  📋 Mark Ready for Review
                </button>
              )}
              {["Draft","Ready for Review"].includes(selected.status) && (
                <button className="btn-success" onClick={() => update(selected.id, {
                  status: "Shared with Member",
                  ai_summary: editing.ai_summary,
                  coach_final_notes: editing.coach_final_notes,
                })}>
                  📤 Share with Member
                </button>
              )}
              {selected.status !== "Archived" && (
                <button className="btn-ghost" onClick={() => update(selected.id, { status: "Archived" })}>
                  🗃 Archive
                </button>
              )}
              <button className="btn-danger btn-sm" onClick={() => del(selected.id)}>🗑 Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
