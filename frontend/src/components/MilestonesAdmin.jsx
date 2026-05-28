import { useState, useEffect } from "react";
import { apiFetch } from "../api";

export default function MilestonesAdmin({ token }) {
  const [milestones, setMilestones] = useState([]);
  const [members,    setMembers]    = useState([]);
  const [catalogue,  setCatalogue]  = useState([]);
  const [filter,     setFilter]     = useState("");
  const [loading,    setLoading]    = useState(false);
  const [autoLoad,   setAutoLoad]   = useState(false);
  const [error,      setError]      = useState("");
  const [showForm,   setShowForm]   = useState(false);

  const emptyForm = { member_id:"", milestone_type:"Sessions Completed", milestone_title:"",
    milestone_description:"", visible_to_member:true, related_metric:"" };
  const [form, setForm] = useState(emptyForm);

  const hdr = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const params = filter ? `?member_id=${filter}` : "";
      const [ms, cat] = await Promise.all([
        apiFetch(`/api/milestones/${params}`, { headers: hdr }),
        apiFetch("/api/milestones/catalogue",  { headers: hdr }),
      ]);
      setMilestones(ms);
      setCatalogue(cat);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    apiFetch("/api/members/", { headers: hdr }).then(setMembers).catch(() => {});
  }, [filter]);

  const autoCheck = async (memberId) => {
    setAutoLoad(true);
    try {
      const res = await apiFetch(`/api/milestones/auto-check/${memberId}`, {
        method: "POST", headers: hdr,
      });
      if (res.awarded?.length > 0) {
        alert(`🏆 Awarded to ${res.awarded.join(", ")}`);
      } else {
        alert(`No new milestones. (${res.total_sessions} sessions completed)`);
      }
      load();
    } catch (e) { setError(e.message); }
    setAutoLoad(false);
  };

  const autoCheckAll = async () => {
    setAutoLoad(true);
    let total = 0;
    for (const m of members) {
      try {
        const res = await apiFetch(`/api/milestones/auto-check/${m.id}`, {
          method: "POST", headers: hdr,
        });
        total += res.awarded?.length || 0;
      } catch {}
    }
    alert(`Auto-check complete. ${total} new milestone(s) awarded.`);
    load();
    setAutoLoad(false);
  };

  const create = async () => {
    if (!form.member_id) { setError("Select a member."); return; }
    try {
      const res = await apiFetch("/api/milestones/", {
        method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, member_id: Number(form.member_id) }),
      });
      setMilestones(prev => [res, ...prev]);
      setShowForm(false);
      setForm(emptyForm);
    } catch (e) { setError(e.message); }
  };

  const del = async (id) => {
    if (!confirm("Delete this milestone?")) return;
    await apiFetch(`/api/milestones/${id}`, { method: "DELETE", headers: hdr });
    setMilestones(prev => prev.filter(m => m.id !== id));
  };

  const toggleVisible = async (m) => {
    try {
      const res = await apiFetch(`/api/milestones/${m.id}`, {
        method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify({ visible_to_member: !m.visible_to_member }),
      });
      setMilestones(prev => prev.map(ms => ms.id === m.id ? res : ms));
    } catch (e) { setError(e.message); }
  };

  const badgeTypeIcon = (type) => {
    const icons = {
      "Sessions Completed":   "🏋️",
      "Attendance Streak":    "🔥",
      "First Reassessment":   "📊",
      "Strength Milestone":   "💪",
      "Recovery Consistency": "🧘",
      "Nutrition Consistency":"🥗",
      "Goal Progress":        "🎯",
    };
    return icons[type] || "🏆";
  };

  return (
    <div className="milestones-wrap">
      <div className="ai-coach-header">
        <h2 className="section-title">🏆 Milestones & Badges</h2>
        <p className="section-sub">Award achievements, auto-detect session milestones, and manage member badges.</p>
        <div className="milestone-actions">
          <button className="btn-primary" onClick={() => { setShowForm(!showForm); setForm(emptyForm); }}>
            {showForm ? "Cancel" : "+ Award Milestone"}
          </button>
          <button className="btn-warn" onClick={autoCheckAll} disabled={autoLoad}>
            {autoLoad ? "Checking…" : "⚡ Auto-Check All Members"}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Catalogue */}
      <div className="panel">
        <h3 className="panel-title">Badge Catalogue</h3>
        <div className="badge-catalogue">
          {catalogue.map((b, i) => (
            <div key={i} className="badge-item">
              <span className="badge-icon">{badgeTypeIcon(b.type)}</span>
              <div>
                <div className="badge-title">{b.title}</div>
                <div className="badge-meta">{b.type} · {b.threshold ? `${b.threshold} ${b.metric}` : "Manual award"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="panel ai-gen-card">
          <h3 className="panel-title">Award Milestone</h3>
          <div className="form-grid-2">
            <div className="field-group"><label>Member</label>
              <select value={form.member_id} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
                <option value="">— select —</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select></div>
            <div className="field-group"><label>Milestone Type</label>
              <select value={form.milestone_type} onChange={e => {
                const cat = catalogue.find(c => c.type === e.target.value);
                setForm(f => ({ ...f, milestone_type: e.target.value, milestone_title: cat?.title || "" }));
              }}>
                {[...new Set(catalogue.map(c => c.type))].map(t => <option key={t}>{t}</option>)}
                <option>Custom</option>
              </select></div>
            <div className="field-group span-2"><label>Title</label>
              <input value={form.milestone_title} onChange={e => setForm(f => ({ ...f, milestone_title: e.target.value }))} /></div>
            <div className="field-group span-2"><label>Description</label>
              <input value={form.milestone_description} onChange={e => setForm(f => ({ ...f, milestone_description: e.target.value }))} /></div>
            <div className="field-group"><label>Related Metric</label>
              <input value={form.related_metric} onChange={e => setForm(f => ({ ...f, related_metric: e.target.value }))} placeholder="e.g. 50 sessions" /></div>
            <div className="field-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={form.visible_to_member}
                  onChange={e => setForm(f => ({ ...f, visible_to_member: e.target.checked }))} />
                Visible to member
              </label>
            </div>
          </div>
          <div className="ai-action-row">
            <button className="btn-primary" onClick={create}>🏆 Award</button>
          </div>
        </div>
      )}

      <div className="toolbar">
        <div className="filter-row">
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All Members</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select>
          {filter && (
            <button className="btn-ghost btn-sm" onClick={() => autoCheck(filter)} disabled={autoLoad}>
              ⚡ Auto-Check This Member
            </button>
          )}
        </div>
      </div>

      <div className="panel table-shell">
        {loading && <div className="loading-pulse">Loading…</div>}
        <table className="data-table">
          <thead><tr><th>Badge</th><th>Member</th><th>Type</th><th>Metric</th><th>Achieved</th><th>Visible</th><th>Delete</th></tr></thead>
          <tbody>
            {milestones.map(m => (
              <tr key={m.id}>
                <td>
                  <span style={{ marginRight: 6 }}>{badgeTypeIcon(m.milestone_type)}</span>
                  <strong>{m.milestone_title}</strong>
                  {m.milestone_description && <div className="badge-meta">{m.milestone_description}</div>}
                </td>
                <td>{m.member_name}</td>
                <td>{m.milestone_type}</td>
                <td>{m.related_metric || "—"}</td>
                <td>{m.achieved_at ? new Date(m.achieved_at).toLocaleDateString() : "—"}</td>
                <td>
                  <button className={`btn-sm ${m.visible_to_member ? "btn-success" : "btn-ghost"}`}
                    onClick={() => toggleVisible(m)}>
                    {m.visible_to_member ? "✅" : "🔒"}
                  </button>
                </td>
                <td><button className="btn-sm btn-danger" onClick={() => del(m.id)}>🗑</button></td>
              </tr>
            ))}
            {milestones.length === 0 && !loading && (
              <tr><td colSpan={7} className="empty-cell">No milestones yet. Auto-check or award manually.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
