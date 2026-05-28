import { useState, useEffect } from "react";
import { apiFetch } from "../api";

const STATUS_COLORS = {
  Draft:    "#94a3b8",
  Approved: "var(--lime)",
  Applied:  "var(--cyan)",
  Rejected: "var(--danger)",
};

const PLAN_TYPES = [
  "Monthly Workout Plan",
  "4-Week Strength Block",
  "8-Week Fat Loss Program",
  "Beginner Foundation Plan",
  "Advanced Hypertrophy Plan",
  "Recovery & Mobility Plan",
  "Sport-Specific Conditioning",
];

export default function AiPlanDrafts({ token }) {
  const [drafts,  setDrafts]  = useState([]);
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [genLoad, setGenLoad] = useState(false);
  const [filter,  setFilter]  = useState("all");
  const [error,   setError]   = useState("");
  const [form, setForm] = useState({ member_id: "", plan_type: "Monthly Workout Plan" });
  const [editing, setEditing] = useState(null);

  const hdr = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/ai-plans/", { headers: hdr });
      setDrafts(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    apiFetch("/api/members/", { headers: hdr }).then(setMembers).catch(() => {});
  }, []);

  const generate = async () => {
    if (!form.member_id) { setError("Select a member first."); return; }
    setGenLoad(true); setError("");
    try {
      const res = await apiFetch("/api/ai-plans/generate", {
        method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: Number(form.member_id), plan_type: form.plan_type }),
      });
      setDrafts(prev => [res, ...prev]);
      setSelected(res);
      setEditing(res.draft_content);
    } catch (e) { setError(e.message); }
    setGenLoad(false);
  };

  const updateDraft = async (id, patch) => {
    try {
      const res = await apiFetch(`/api/ai-plans/${id}`, {
        method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setDrafts(prev => prev.map(d => d.id === id ? res : d));
      setSelected(res);
      if (patch.draft_content !== undefined) setEditing(res.draft_content);
    } catch (e) { setError(e.message); }
  };

  const del = async (id) => {
    if (!confirm("Delete this plan draft?")) return;
    await apiFetch(`/api/ai-plans/${id}`, { method: "DELETE", headers: hdr });
    setDrafts(prev => prev.filter(d => d.id !== id));
    if (selected?.id === id) { setSelected(null); setEditing(null); }
  };

  const filtered = filter === "all" ? drafts : drafts.filter(d => d.status === filter);

  return (
    <div className="ai-coach-wrap">
      <div className="ai-coach-header">
        <h2 className="section-title">📝 AI Plan Drafts</h2>
        <p className="section-sub">AI-generated workout plans. Edit and approve before assigning to members.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel ai-gen-card">
        <h3 className="panel-title">Generate Plan Draft</h3>
        <div className="ai-gen-row">
          <div className="field-group">
            <label>Member</label>
            <select value={form.member_id} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
              <option value="">— select member —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label>Plan Type</label>
            <select value={form.plan_type} onChange={e => setForm(f => ({ ...f, plan_type: e.target.value }))}>
              {PLAN_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <button className="btn-primary" onClick={generate} disabled={genLoad}>
            {genLoad ? "Generating…" : "⚡ Generate Plan"}
          </button>
        </div>
      </div>

      <div className="ai-coach-layout">
        <div className="ai-list-col">
          <div className="filter-bar">
            {["all","Draft","Approved","Applied","Rejected"].map(f => (
              <button key={f} className={`filter-chip ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}>{f === "all" ? "All" : f}</button>
            ))}
          </div>
          {loading && <div className="loading-pulse">Loading…</div>}
          {filtered.map(d => (
            <div key={d.id}
              className={`ai-output-card ${selected?.id === d.id ? "selected" : ""}`}
              onClick={() => { setSelected(d); setEditing(d.draft_content); }}>
              <div className="aio-top">
                <span className="aio-type">{d.plan_type}</span>
                <span className="status-chip" style={{ background: (STATUS_COLORS[d.status] || "#94a3b8") + "22", color: STATUS_COLORS[d.status] || "#94a3b8" }}>
                  {d.status}
                </span>
              </div>
              <div className="aio-meta">
                👤 {d.member_name || "—"} · {d.created_at ? new Date(d.created_at).toLocaleDateString() : ""}
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="empty-state">No plan drafts yet.</div>
          )}
        </div>

        {selected && (
          <div className="ai-detail-col panel">
            <div className="ai-detail-header">
              <div>
                <span className="aio-type-lg">{selected.plan_type}</span>
                <span className="status-chip ml-8" style={{ color: STATUS_COLORS[selected.status] || "#94a3b8" }}>
                  {selected.status}
                </span>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => { setSelected(null); setEditing(null); }}>✕</button>
            </div>

            <div className="ai-detail-meta">
              <span>👤 {selected.member_name}</span>
              <span>📅 {selected.created_at ? new Date(selected.created_at).toLocaleString() : ""}</span>
              {selected.reviewed_at && <span>✅ Reviewed: {new Date(selected.reviewed_at).toLocaleString()}</span>}
            </div>

            {selected.rationale && (
              <div className="suggestion-box">
                <strong>🧠 AI Rationale:</strong> {selected.rationale}
              </div>
            )}

            <div className="plan-edit-section">
              <label>📋 Plan Content (editable)</label>
              <textarea
                className="plan-content-editor"
                rows={20}
                value={editing ?? ""}
                onChange={e => setEditing(e.target.value)}
              />
              <button className="btn-ghost btn-sm" onClick={() => updateDraft(selected.id, { draft_content: editing })}>
                💾 Save Edits
              </button>
            </div>

            <div className="field-group">
              <label>Admin Notes</label>
              <AdminNotesInline id={selected.id} notes={selected.admin_notes} onSave={patch => updateDraft(selected.id, patch)} />
            </div>

            <div className="ai-action-row">
              {selected.status === "Draft" && <>
                <button className="btn-success" onClick={() => updateDraft(selected.id, { status: "Approved" })}>
                  ✅ Approve
                </button>
                <button className="btn-danger" onClick={() => updateDraft(selected.id, { status: "Rejected" })}>
                  ✗ Reject
                </button>
              </>}
              {selected.status === "Approved" && (
                <button className="btn-primary" onClick={() => updateDraft(selected.id, { status: "Applied" })}>
                  ⚡ Mark Applied
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

function AdminNotesInline({ id, notes, onSave }) {
  const [val, setVal] = useState(notes || "");
  useEffect(() => setVal(notes || ""), [notes]);
  return (
    <div className="admin-notes-box">
      <textarea rows={2} value={val} onChange={e => setVal(e.target.value)} placeholder="Add review notes…" />
      <button className="btn-ghost btn-sm" onClick={() => onSave({ admin_notes: val })}>Save Notes</button>
    </div>
  );
}
