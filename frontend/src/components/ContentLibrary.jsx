import { useState, useEffect } from "react";
import { apiFetch } from "../api";

const RESOURCE_TYPES = ["Article","Video","PDF","Template","Checklist","Exercise Guide","Meal Plan","Audio"];
const CATEGORIES      = ["Nutrition","Training","Recovery","Mindset","Mobility","Lifestyle","Supplement","General"];
const STATUSES        = ["Draft","Published","Archived"];

export default function ContentLibrary({ token }) {
  const [resources,    setResources]    = useState([]);
  const [assignments,  setAssignments]  = useState([]);
  const [members,      setMembers]      = useState([]);
  const [tab,          setTab]          = useState("resources");
  const [selected,     setSelected]     = useState(null);
  const [showForm,     setShowForm]     = useState(false);
  const [filterCat,    setFilterCat]    = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  const emptyForm = { title:"", resource_type:"Article", category:"General", description:"", content_body:"",
    external_url:"", status:"Draft", visible_to_members:true };
  const [form, setForm] = useState(emptyForm);
  const [assignForm, setAssignForm] = useState({ member_id:"", resource_id:"", notes:"" });

  const hdr = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCat)    params.set("category", filterCat);
      if (filterStatus) params.set("status", filterStatus);
      const [res, ass] = await Promise.all([
        apiFetch(`/api/content/resources?${params}`, { headers: hdr }),
        apiFetch("/api/content/assignments",          { headers: hdr }),
      ]);
      setResources(res);
      setAssignments(ass);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    apiFetch("/api/members/", { headers: hdr }).then(setMembers).catch(() => {});
  }, [filterCat, filterStatus]);

  const save = async () => {
    try {
      if (selected) {
        const res = await apiFetch(`/api/content/resources/${selected.id}`, {
          method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setResources(prev => prev.map(r => r.id === selected.id ? res : r));
        setSelected(res);
      } else {
        const res = await apiFetch("/api/content/resources", {
          method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setResources(prev => [res, ...prev]);
        setSelected(res);
      }
      setShowForm(false);
    } catch (e) { setError(e.message); }
  };

  const del = async (id) => {
    if (!confirm("Delete this resource?")) return;
    await apiFetch(`/api/content/resources/${id}`, { method: "DELETE", headers: hdr });
    setResources(prev => prev.filter(r => r.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const assign = async () => {
    const { member_id, resource_id, notes } = assignForm;
    if (!member_id || !resource_id) { setError("Select member and resource."); return; }
    try {
      const res = await apiFetch("/api/content/assignments", {
        method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: Number(member_id), resource_id: Number(resource_id), notes }),
      });
      setAssignments(prev => [res, ...prev]);
      setAssignForm({ member_id:"", resource_id:"", notes:"" });
    } catch (e) { setError(e.message); }
  };

  const removeAssign = async (id) => {
    await apiFetch(`/api/content/assignments/${id}`, { method: "DELETE", headers: hdr });
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="content-lib-wrap">
      <div className="ai-coach-header">
        <h2 className="section-title">📚 Content & Resource Library</h2>
        <p className="section-sub">Create coaching resources and assign them to members.</p>
        <div className="tab-pills">
          <button className={`tab-pill ${tab === "resources" ? "active" : ""}`} onClick={() => setTab("resources")}>
            Resources ({resources.length})
          </button>
          <button className={`tab-pill ${tab === "assignments" ? "active" : ""}`} onClick={() => setTab("assignments")}>
            Assignments ({assignments.length})
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {tab === "resources" && (
        <>
          <div className="toolbar">
            <div className="filter-row">
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <button className="btn-primary" onClick={() => { setForm(emptyForm); setSelected(null); setShowForm(true); }}>
              + New Resource
            </button>
          </div>

          {showForm && (
            <div className="panel ai-gen-card">
              <h3 className="panel-title">{selected ? "Edit Resource" : "New Resource"}</h3>
              <div className="form-grid-2">
                <div className="field-group"><label>Title</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div className="field-group"><label>Type</label>
                  <select value={form.resource_type} onChange={e => setForm(f => ({ ...f, resource_type: e.target.value }))}>
                    {RESOURCE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select></div>
                <div className="field-group"><label>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select></div>
                <div className="field-group"><label>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select></div>
                <div className="field-group span-2"><label>Description</label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="field-group span-2"><label>External URL</label>
                  <input type="url" value={form.external_url} onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))} /></div>
                <div className="field-group span-2"><label>Content Body</label>
                  <textarea rows={8} value={form.content_body} onChange={e => setForm(f => ({ ...f, content_body: e.target.value }))} /></div>
                <div className="field-group">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={form.visible_to_members}
                      onChange={e => setForm(f => ({ ...f, visible_to_members: e.target.checked }))} />
                    Visible to members
                  </label>
                </div>
              </div>
              <div className="ai-action-row">
                <button className="btn-primary" onClick={save}>💾 Save</button>
                <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="panel table-shell">
            {loading && <div className="loading-pulse">Loading…</div>}
            <table className="data-table">
              <thead><tr><th>Title</th><th>Type</th><th>Category</th><th>Status</th><th>Visible</th><th>Actions</th></tr></thead>
              <tbody>
                {resources.map(r => (
                  <tr key={r.id} className={selected?.id === r.id ? "row-selected" : ""}>
                    <td>{r.title}</td>
                    <td>{r.resource_type}</td>
                    <td>{r.category}</td>
                    <td><span className="status-chip" style={{ color: r.status === "Published" ? "var(--lime)" : "#94a3b8" }}>{r.status}</span></td>
                    <td>{r.visible_to_members ? "✅" : "—"}</td>
                    <td>
                      <button className="btn-sm btn-ghost" onClick={() => { setSelected(r); setForm({ ...r }); setShowForm(true); }}>Edit</button>
                      <button className="btn-sm btn-danger ml-4" onClick={() => del(r.id)}>🗑</button>
                    </td>
                  </tr>
                ))}
                {resources.length === 0 && !loading && (
                  <tr><td colSpan={6} className="empty-cell">No resources yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "assignments" && (
        <>
          <div className="panel ai-gen-card">
            <h3 className="panel-title">Assign Resource to Member</h3>
            <div className="ai-gen-row">
              <div className="field-group"><label>Member</label>
                <select value={assignForm.member_id} onChange={e => setAssignForm(f => ({ ...f, member_id: e.target.value }))}>
                  <option value="">— select —</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                </select></div>
              <div className="field-group"><label>Resource</label>
                <select value={assignForm.resource_id} onChange={e => setAssignForm(f => ({ ...f, resource_id: e.target.value }))}>
                  <option value="">— select —</option>
                  {resources.filter(r => r.status === "Published").map(r => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select></div>
              <div className="field-group"><label>Notes</label>
                <input value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <button className="btn-primary" onClick={assign}>Assign</button>
            </div>
          </div>

          <div className="panel table-shell">
            <table className="data-table">
              <thead><tr><th>Member</th><th>Resource</th><th>Viewed</th><th>Notes</th><th>Assigned</th><th>Remove</th></tr></thead>
              <tbody>
                {assignments.map(a => (
                  <tr key={a.id}>
                    <td>{a.member_name}</td>
                    <td>{a.resource_title}</td>
                    <td>{a.viewed ? `✅ ${a.viewed_at ? new Date(a.viewed_at).toLocaleDateString() : ""}` : "—"}</td>
                    <td>{a.notes || "—"}</td>
                    <td>{a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}</td>
                    <td><button className="btn-sm btn-danger" onClick={() => removeAssign(a.id)}>✕</button></td>
                  </tr>
                ))}
                {assignments.length === 0 && (
                  <tr><td colSpan={6} className="empty-cell">No assignments yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
