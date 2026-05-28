import { useState, useEffect } from "react";
import { apiFetch } from "../api";

const OUTPUT_TYPES = [
  "Weekly Summary",
  "Workout Adjustment",
  "Deload Week",
  "Exercise Substitutions",
  "Monthly Progress Report",
  "Reassessment Prompt",
  "Motivational Coach Message",
  "Nutrition Review",
  "Supplement Review",
  "Retention Follow-Up",
];

const STATUS_COLORS = {
  Draft:           "#94a3b8",
  "Pending Review":"var(--warn)",
  Approved:        "var(--lime)",
  Applied:         "var(--cyan)",
  Rejected:        "var(--danger)",
  Archived:        "#475569",
};

export default function AiCoachAssistant({ token }) {
  const [outputs, setOutputs]     = useState([]);
  const [members, setMembers]     = useState([]);
  const [groups,  setGroups]      = useState([]);
  const [loading, setLoading]     = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [filter, setFilter]       = useState("all");
  const [error, setError]         = useState("");

  const [form, setForm] = useState({
    target_type: "member",
    member_id:   "",
    group_id:    "",
    output_type: "Weekly Summary",
    days:        30,
  });

  const hdr = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/ai-coach/outputs", { headers: hdr });
      setOutputs(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    apiFetch("/api/members/", { headers: hdr }).then(setMembers).catch(() => {});
    apiFetch("/api/workout-groups/", { headers: hdr }).then(setGroups).catch(() => {});
  }, []);

  const generate = async () => {
    setGenLoading(true); setError("");
    try {
      const body = {
        output_type: form.output_type,
        days:        Number(form.days),
      };
      if (form.target_type === "member" && form.member_id) body.member_id = Number(form.member_id);
      else if (form.target_type === "group" && form.group_id) body.group_id = Number(form.group_id);
      const res = await apiFetch("/api/ai-coach/generate", {
        method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setOutputs(prev => [res, ...prev]);
      setSelected(res);
    } catch (e) { setError(e.message); }
    setGenLoading(false);
  };

  const updateStatus = async (id, status) => {
    try {
      const res = await apiFetch(`/api/ai-coach/outputs/${id}`, {
        method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setOutputs(prev => prev.map(o => o.id === id ? res : o));
      if (selected?.id === id) setSelected(res);
    } catch (e) { setError(e.message); }
  };

  const saveNotes = async (id, admin_notes) => {
    try {
      const res = await apiFetch(`/api/ai-coach/outputs/${id}`, {
        method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify({ admin_notes }),
      });
      setOutputs(prev => prev.map(o => o.id === id ? res : o));
      setSelected(res);
    } catch (e) { setError(e.message); }
  };

  const del = async (id) => {
    if (!confirm("Delete this AI output?")) return;
    await apiFetch(`/api/ai-coach/outputs/${id}`, { method: "DELETE", headers: hdr });
    setOutputs(prev => prev.filter(o => o.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const filtered = filter === "all" ? outputs : outputs.filter(o => o.status === filter);

  return (
    <div className="ai-coach-wrap">
      <div className="ai-coach-header">
        <h2 className="section-title">🤖 AI Coach Assistant</h2>
        <p className="section-sub">Generate data-driven coaching outputs. All outputs require admin review before use.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Generator Card */}
      <div className="panel ai-gen-card">
        <h3 className="panel-title">Generate New Output</h3>
        <div className="ai-gen-row">
          <div className="field-group">
            <label>Target</label>
            <select value={form.target_type} onChange={e => setForm(f => ({ ...f, target_type: e.target.value }))}>
              <option value="member">Individual Member</option>
              <option value="group">Workout Group</option>
            </select>
          </div>
          {form.target_type === "member" ? (
            <div className="field-group">
              <label>Member</label>
              <select value={form.member_id} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
                <option value="">— select —</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select>
            </div>
          ) : (
            <div className="field-group">
              <label>Group</label>
              <select value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}>
                <option value="">— select —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
              </select>
            </div>
          )}
          <div className="field-group">
            <label>Output Type</label>
            <select value={form.output_type} onChange={e => setForm(f => ({ ...f, output_type: e.target.value }))}>
              {OUTPUT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label>Data Window (days)</label>
            <input type="number" min={7} max={365} value={form.days}
              onChange={e => setForm(f => ({ ...f, days: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={generate} disabled={genLoading}>
            {genLoading ? "Generating…" : "⚡ Generate"}
          </button>
        </div>
      </div>

      {/* List + Detail layout */}
      <div className="ai-coach-layout">
        <div className="ai-list-col">
          <div className="filter-bar">
            {["all","Draft","Pending Review","Approved","Applied","Rejected"].map(f => (
              <button key={f} className={`filter-chip ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}>{f === "all" ? "All" : f}</button>
            ))}
          </div>
          {loading && <div className="loading-pulse">Loading…</div>}
          {filtered.map(o => (
            <div key={o.id}
              className={`ai-output-card ${selected?.id === o.id ? "selected" : ""}`}
              onClick={() => setSelected(o)}>
              <div className="aio-top">
                <span className="aio-type">{o.output_type}</span>
                <span className="status-chip" style={{ background: STATUS_COLORS[o.status] + "22", color: STATUS_COLORS[o.status], border: `1px solid ${STATUS_COLORS[o.status]}44` }}>
                  {o.status}
                </span>
              </div>
              <div className="aio-meta">
                {o.member_name || o.group_name || "—"} · {o.created_at ? new Date(o.created_at).toLocaleDateString() : ""}
              </div>
              {o.risk_flags?.length > 0 && (
                <div className="aio-risks">⚠ {o.risk_flags.join(" · ")}</div>
              )}
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="empty-state">No outputs yet. Generate your first one above.</div>
          )}
        </div>

        {selected && (
          <div className="ai-detail-col panel">
            <div className="ai-detail-header">
              <div>
                <span className="aio-type-lg">{selected.output_type}</span>
                <span className="status-chip ml-8" style={{ background: STATUS_COLORS[selected.status] + "22", color: STATUS_COLORS[selected.status] }}>
                  {selected.status}
                </span>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className="ai-detail-meta">
              <span>👤 {selected.member_name || selected.group_name || "—"}</span>
              <span>📅 {selected.created_at ? new Date(selected.created_at).toLocaleString() : ""}</span>
            </div>

            {selected.risk_flags?.length > 0 && (
              <div className="risk-banner">
                <strong>⚠ Risk Flags:</strong> {selected.risk_flags.join(" · ")}
              </div>
            )}

            {selected.suggested_action && (
              <div className="suggestion-box">
                <strong>💡 Suggested Action:</strong> {selected.suggested_action}
              </div>
            )}

            <div className="ai-output-body">
              <pre className="ai-output-text">{selected.generated_output}</pre>
            </div>

            {selected.supporting_data_summary && (
              <details className="data-summary">
                <summary>📊 Supporting Data</summary>
                <pre>{JSON.stringify(JSON.parse(selected.supporting_data_summary || "{}"), null, 2)}</pre>
              </details>
            )}

            <AdminNotes output={selected} onSave={saveNotes} />

            <div className="ai-action-row">
              {selected.status === "Draft" && (
                <button className="btn-warn" onClick={() => updateStatus(selected.id, "Pending Review")}>
                  📤 Submit for Review
                </button>
              )}
              {selected.status === "Pending Review" && <>
                <button className="btn-success" onClick={() => updateStatus(selected.id, "Approved")}>✅ Approve</button>
                <button className="btn-danger"  onClick={() => updateStatus(selected.id, "Rejected")}>✗ Reject</button>
              </>}
              {selected.status === "Approved" && (
                <button className="btn-primary" onClick={() => updateStatus(selected.id, "Applied")}>⚡ Mark Applied</button>
              )}
              {!["Archived"].includes(selected.status) && (
                <button className="btn-ghost" onClick={() => updateStatus(selected.id, "Archived")}>🗃 Archive</button>
              )}
              <button className="btn-danger btn-sm" onClick={() => del(selected.id)}>🗑 Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminNotes({ output, onSave }) {
  const [notes, setNotes] = useState(output.admin_notes || "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setNotes(output.admin_notes || ""), [output]);
  const save = async () => {
    setSaving(true);
    await onSave(output.id, notes);
    setSaving(false);
  };
  return (
    <div className="admin-notes-box">
      <label>📝 Admin Notes</label>
      <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Add review notes…" />
      <button className="btn-ghost btn-sm" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save Notes"}
      </button>
    </div>
  );
}
