import { useState, useEffect } from "react";
import { apiFetch } from "../api";

const STATUSES    = ["Available","Maintenance","Unavailable","Retired"];
const CATEGORIES  = ["Cardio","Strength","Free Weights","Cables","Functional","Stretching","Recovery","Other"];
const STATUS_COLORS = {
  Available:   "var(--lime)",
  Maintenance: "var(--warn)",
  Unavailable: "var(--danger)",
  Retired:     "#475569",
};

export default function EquipmentManagement({ token }) {
  const [items,    setItems]    = useState([]);
  const [unavail,  setUnavail]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterCat,setFilterCat]= useState("");
  const [filterSt, setFilterSt] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const emptyForm = { equipment_name:"", category:"Strength", quantity:1, status:"Available",
    location:"", purchase_date:"", maintenance_notes:"", replacement_notes:"" };
  const [form, setForm] = useState(emptyForm);

  const hdr = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCat) params.set("category", filterCat);
      if (filterSt)  params.set("status", filterSt);
      const [all, un] = await Promise.all([
        apiFetch(`/api/equipment/?${params}`, { headers: hdr }),
        apiFetch("/api/equipment/unavailable",  { headers: hdr }),
      ]);
      setItems(all);
      setUnavail(un);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterCat, filterSt]);

  const save = async () => {
    try {
      if (selected) {
        const res = await apiFetch(`/api/equipment/${selected.id}`, {
          method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setItems(prev => prev.map(i => i.id === selected.id ? res : i));
        setSelected(res);
      } else {
        const res = await apiFetch("/api/equipment/", {
          method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setItems(prev => [res, ...prev]);
        setSelected(res);
      }
      setShowForm(false);
    } catch (e) { setError(e.message); }
  };

  const del = async (id) => {
    if (!confirm("Delete this equipment record?")) return;
    await apiFetch(`/api/equipment/${id}`, { method: "DELETE", headers: hdr });
    setItems(prev => prev.filter(i => i.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const openEdit = (item) => {
    setSelected(item);
    setForm({ ...item, purchase_date: item.purchase_date ? item.purchase_date.slice(0, 10) : "" });
    setShowForm(true);
  };

  return (
    <div className="equip-wrap">
      <div className="ai-coach-header">
        <h2 className="section-title">🏋️ Equipment Management</h2>
        <p className="section-sub">Track inventory, maintenance status and availability.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {unavail.length > 0 && (
        <div className="panel retention-alert-panel">
          <h3 className="panel-title" style={{ color: "var(--warn)" }}>⚠ Unavailable / In Maintenance ({unavail.length})</h3>
          <div className="equip-alert-list">
            {unavail.map(e => (
              <div key={e.id} className="equip-alert-item">
                <span className="equip-name">{e.equipment_name}</span>
                <span className="status-chip" style={{ color: STATUS_COLORS[e.status] }}>{e.status}</span>
                {e.maintenance_notes && <span className="equip-notes">— {e.maintenance_notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="toolbar">
        <div className="filter-row">
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={filterSt} onChange={e => setFilterSt(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={() => { setForm(emptyForm); setSelected(null); setShowForm(true); }}>
          + Add Equipment
        </button>
      </div>

      {showForm && (
        <div className="panel ai-gen-card">
          <h3 className="panel-title">{selected ? "Edit Equipment" : "Add Equipment"}</h3>
          <div className="form-grid-2">
            <div className="field-group span-2"><label>Equipment Name</label>
              <input value={form.equipment_name} onChange={e => setForm(f => ({ ...f, equipment_name: e.target.value }))} /></div>
            <div className="field-group"><label>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select></div>
            <div className="field-group"><label>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select></div>
            <div className="field-group"><label>Quantity</label>
              <input type="number" min={0} value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} /></div>
            <div className="field-group"><label>Location</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div className="field-group"><label>Purchase Date</label>
              <input type="date" value={form.purchase_date}
                onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} /></div>
            <div className="field-group span-2"><label>Maintenance Notes</label>
              <textarea rows={2} value={form.maintenance_notes}
                onChange={e => setForm(f => ({ ...f, maintenance_notes: e.target.value }))} /></div>
            <div className="field-group span-2"><label>Replacement Notes</label>
              <textarea rows={2} value={form.replacement_notes}
                onChange={e => setForm(f => ({ ...f, replacement_notes: e.target.value }))} /></div>
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
          <thead><tr>
            <th>Name</th><th>Category</th><th>Qty</th><th>Status</th><th>Location</th>
            <th>Maintenance Notes</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {items.map(e => (
              <tr key={e.id} className={selected?.id === e.id ? "row-selected" : ""}>
                <td>{e.equipment_name}</td>
                <td>{e.category}</td>
                <td>{e.quantity}</td>
                <td>
                  <span className="status-chip" style={{ color: STATUS_COLORS[e.status] || "#94a3b8", borderColor: (STATUS_COLORS[e.status] || "#94a3b8") + "44" }}>
                    {e.status}
                  </span>
                </td>
                <td>{e.location || "—"}</td>
                <td className="notes-cell">{e.maintenance_notes || "—"}</td>
                <td>
                  <button className="btn-sm btn-ghost" onClick={() => openEdit(e)}>Edit</button>
                  <button className="btn-sm btn-danger ml-4" onClick={() => del(e.id)}>🗑</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={7} className="empty-cell">No equipment records yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
