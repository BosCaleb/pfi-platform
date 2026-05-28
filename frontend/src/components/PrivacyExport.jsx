import { useState, useEffect } from "react";
import { apiFetch } from "../api";

const REQUEST_TYPES = ["Data Export", "Data Deletion", "Data Correction", "Access Request", "Opt-Out"];
const STATUS_COLORS = {
  Pending:   "var(--warn)",
  Completed: "var(--lime)",
  Deleted:   "var(--danger)",
  Rejected:  "#475569",
};

export default function PrivacyExport({ token }) {
  const [requests,  setRequests]  = useState([]);
  const [members,   setMembers]   = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [exportData,setExportData]= useState(null);
  const [exporting, setExporting] = useState(false);
  const [deactLoad, setDeactLoad] = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [filter,    setFilter]    = useState("all");
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);

  const emptyForm = { member_id:"", request_type:"Data Export", admin_notes:"" };
  const [form, setForm] = useState(emptyForm);

  const hdr = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/privacy/requests", { headers: hdr });
      setRequests(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    apiFetch("/api/members/", { headers: hdr }).then(setMembers).catch(() => {});
  }, []);

  const create = async () => {
    if (!form.member_id) { setError("Select a member."); return; }
    try {
      const res = await apiFetch("/api/privacy/requests", {
        method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, member_id: Number(form.member_id) }),
      });
      setRequests(prev => [res, ...prev]);
      setShowForm(false);
      setForm(emptyForm);
    } catch (e) { setError(e.message); }
  };

  const resolve = async (id, status) => {
    try {
      const res = await apiFetch(`/api/privacy/requests/${id}`, {
        method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setRequests(prev => prev.map(r => r.id === id ? res : r));
      if (selected?.id === id) setSelected(res);
    } catch (e) { setError(e.message); }
  };

  const exportMember = async (memberId) => {
    setExporting(true); setExportData(null);
    try {
      const data = await apiFetch(`/api/privacy/export/${memberId}`, { headers: hdr });
      setExportData(data);
    } catch (e) { setError(e.message); }
    setExporting(false);
  };

  const deactivate = async (memberId, hard = false) => {
    const msg = hard
      ? "Anonymise this member's PII? Training history will be retained but personal info will be erased."
      : "Deactivate this member? Data is retained.";
    if (!confirm(msg)) return;
    setDeactLoad(true);
    try {
      const res = await apiFetch(`/api/privacy/deactivate/${memberId}`, {
        method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify({ hard_delete: hard }),
      });
      alert(res.message);
    } catch (e) { setError(e.message); }
    setDeactLoad(false);
  };

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);

  return (
    <div className="privacy-wrap">
      <div className="ai-coach-header">
        <h2 className="section-title">🔒 Privacy & Data</h2>
        <p className="section-sub">Manage member data requests, exports, and deactivations in line with POPIA / GDPR principles.</p>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Data Request"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showForm && (
        <div className="panel ai-gen-card">
          <h3 className="panel-title">New Data Request</h3>
          <div className="ai-gen-row">
            <div className="field-group"><label>Member</label>
              <select value={form.member_id} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
                <option value="">— select —</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select></div>
            <div className="field-group"><label>Request Type</label>
              <select value={form.request_type} onChange={e => setForm(f => ({ ...f, request_type: e.target.value }))}>
                {REQUEST_TYPES.map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div className="field-group"><label>Notes</label>
              <input value={form.admin_notes} onChange={e => setForm(f => ({ ...f, admin_notes: e.target.value }))} /></div>
            <button className="btn-primary" onClick={create}>Submit</button>
          </div>
        </div>
      )}

      {/* Requests table */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Data Requests</h3>
          <div className="filter-bar">
            {["all","Pending","Completed","Deleted","Rejected"].map(f => (
              <button key={f} className={`filter-chip ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}>{f === "all" ? "All" : f}</button>
            ))}
          </div>
        </div>
        {loading && <div className="loading-pulse">Loading…</div>}
        <table className="data-table">
          <thead><tr><th>Member</th><th>Type</th><th>Status</th><th>Requested</th><th>Resolved</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className={selected?.id === r.id ? "row-selected" : ""}
                onClick={() => setSelected(r)}>
                <td>{r.member_name}</td>
                <td>{r.request_type}</td>
                <td>
                  <span className="status-chip" style={{ color: STATUS_COLORS[r.status] || "#94a3b8" }}>
                    {r.status}
                  </span>
                </td>
                <td>{r.requested_at ? new Date(r.requested_at).toLocaleDateString() : "—"}</td>
                <td>{r.resolved_at ? new Date(r.resolved_at).toLocaleDateString() : "—"}</td>
                <td onClick={e => e.stopPropagation()}>
                  {r.status === "Pending" && <>
                    <button className="btn-sm btn-success" onClick={() => resolve(r.id, "Completed")}>✅</button>
                    <button className="btn-sm btn-danger ml-4" onClick={() => resolve(r.id, "Rejected")}>✗</button>
                  </>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={6} className="empty-cell">No requests.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Member export / deactivation panel */}
      <div className="panel">
        <h3 className="panel-title">Data Export & Member Deactivation</h3>
        <div className="ai-gen-row">
          <div className="field-group">
            <label>Select Member</label>
            <select id="export-member-sel" defaultValue="">
              <option value="">— select —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
          </div>
          <button className="btn-primary" disabled={exporting}
            onClick={() => {
              const sel = document.getElementById("export-member-sel").value;
              if (sel) exportMember(Number(sel));
            }}>
            {exporting ? "Exporting…" : "📥 Export Data"}
          </button>
          <button className="btn-warn" disabled={deactLoad}
            onClick={() => {
              const sel = document.getElementById("export-member-sel").value;
              if (sel) deactivate(Number(sel), false);
            }}>
            Deactivate
          </button>
          <button className="btn-danger" disabled={deactLoad}
            onClick={() => {
              const sel = document.getElementById("export-member-sel").value;
              if (sel) deactivate(Number(sel), true);
            }}>
            🗑 Anonymise PII
          </button>
        </div>

        {exportData && (
          <div className="export-preview">
            <div className="export-header">
              <strong>Export for {exportData.member?.first_name} {exportData.member?.last_name}</strong>
              <button className="btn-ghost btn-sm" onClick={() => {
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
                const url  = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `member_${exportData.member?.id}_export.json`;
                a.click(); URL.revokeObjectURL(url);
              }}>⬇ Download JSON</button>
            </div>
            <div className="export-summary-grid">
              {Object.entries(exportData.summary || {}).map(([k, v]) => (
                <div key={k} className="snap-cell">
                  <div className="snap-val">{v}</div>
                  <div className="snap-lbl">{k.replace(/_/g, " ")}</div>
                </div>
              ))}
            </div>
            <details>
              <summary>View full JSON</summary>
              <pre className="export-json">{JSON.stringify(exportData, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
