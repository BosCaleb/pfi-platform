import { useState, useEffect } from "react";
import { apiFetch } from "../api";

export default function GymManagement({ token }) {
  const [gyms,     setGyms]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [locations,setLocations]= useState([]);
  const [showGym,  setShowGym]  = useState(false);
  const [showLoc,  setShowLoc]  = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const emptyGym = { gym_name:"", owner_name:"", contact_email:"", contact_phone:"",
    subscription_plan:"Starter", is_active:true };
  const emptyLoc = { location_name:"", address:"", city:"", country:"South Africa", is_active:true };
  const [gymForm, setGymForm] = useState(emptyGym);
  const [locForm, setLocForm] = useState(emptyLoc);

  const hdr = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/gyms/", { headers: hdr });
      setGyms(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const loadLocations = async (gymId) => {
    try {
      const data = await apiFetch(`/api/gyms/${gymId}/locations`, { headers: hdr });
      setLocations(data);
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { load(); }, []);

  const selectGym = (g) => {
    setSelected(g);
    setShowGym(false);
    setShowLoc(false);
    loadLocations(g.id);
  };

  const saveGym = async () => {
    try {
      if (selected && showGym === "edit") {
        const res = await apiFetch(`/api/gyms/${selected.id}`, {
          method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
          body: JSON.stringify(gymForm),
        });
        setGyms(prev => prev.map(g => g.id === selected.id ? res : g));
        setSelected(res);
      } else {
        const res = await apiFetch("/api/gyms/", {
          method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
          body: JSON.stringify(gymForm),
        });
        setGyms(prev => [...prev, res]);
        selectGym(res);
      }
      setShowGym(false);
    } catch (e) { setError(e.message); }
  };

  const saveLoc = async () => {
    if (!selected) return;
    try {
      const res = await apiFetch(`/api/gyms/${selected.id}/locations`, {
        method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify(locForm),
      });
      setLocations(prev => [...prev, res]);
      setShowLoc(false);
      setLocForm(emptyLoc);
    } catch (e) { setError(e.message); }
  };

  const delGym = async (id) => {
    if (!confirm("Delete this gym?")) return;
    await apiFetch(`/api/gyms/${id}`, { method: "DELETE", headers: hdr });
    setGyms(prev => prev.filter(g => g.id !== id));
    if (selected?.id === id) { setSelected(null); setLocations([]); }
  };

  const delLoc = async (id) => {
    await apiFetch(`/api/gyms/locations/${id}`, { method: "DELETE", headers: hdr });
    setLocations(prev => prev.filter(l => l.id !== id));
  };

  return (
    <div className="gym-mgmt-wrap">
      <div className="ai-coach-header">
        <h2 className="section-title">🏢 Gym Management</h2>
        <p className="section-sub">Multi-gym scaling readiness — manage gym profiles and branch locations.</p>
        <button className="btn-primary" onClick={() => { setGymForm(emptyGym); setShowGym("new"); setSelected(null); }}>
          + New Gym
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="gym-layout">
        <div className="gym-list-col panel">
          <h3 className="panel-title">Gyms ({gyms.length})</h3>
          {loading && <div className="loading-pulse">Loading…</div>}
          {gyms.map(g => (
            <div key={g.id} className={`gym-list-item ${selected?.id === g.id ? "selected" : ""}`}
              onClick={() => selectGym(g)}>
              <div className="gym-item-name">{g.gym_name}</div>
              <div className="gym-item-meta">{g.subscription_plan} · {g.is_active ? "Active" : "Inactive"}</div>
              <div className="gym-item-meta">{g.contact_email}</div>
            </div>
          ))}
          {gyms.length === 0 && !loading && (
            <div className="empty-state">No gyms yet. Click "+ New Gym".</div>
          )}
        </div>

        <div className="gym-detail-col">
          {(showGym === "new" || showGym === "edit") && (
            <div className="panel ai-gen-card">
              <h3 className="panel-title">{showGym === "edit" ? "Edit Gym" : "New Gym"}</h3>
              <div className="form-grid-2">
                <div className="field-group span-2"><label>Gym Name</label>
                  <input value={gymForm.gym_name} onChange={e => setGymForm(f => ({ ...f, gym_name: e.target.value }))} /></div>
                <div className="field-group"><label>Owner Name</label>
                  <input value={gymForm.owner_name} onChange={e => setGymForm(f => ({ ...f, owner_name: e.target.value }))} /></div>
                <div className="field-group"><label>Contact Email</label>
                  <input type="email" value={gymForm.contact_email} onChange={e => setGymForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
                <div className="field-group"><label>Phone</label>
                  <input value={gymForm.contact_phone} onChange={e => setGymForm(f => ({ ...f, contact_phone: e.target.value }))} /></div>
                <div className="field-group"><label>Plan</label>
                  <select value={gymForm.subscription_plan} onChange={e => setGymForm(f => ({ ...f, subscription_plan: e.target.value }))}>
                    {["Starter","Growth","Pro","Enterprise"].map(p => <option key={p}>{p}</option>)}
                  </select></div>
                <div className="field-group">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={gymForm.is_active}
                      onChange={e => setGymForm(f => ({ ...f, is_active: e.target.checked }))} />
                    Active
                  </label>
                </div>
              </div>
              <div className="ai-action-row">
                <button className="btn-primary" onClick={saveGym}>💾 Save</button>
                <button className="btn-ghost" onClick={() => setShowGym(false)}>Cancel</button>
              </div>
            </div>
          )}

          {selected && !showGym && (
            <>
              <div className="panel">
                <div className="panel-header">
                  <h3 className="panel-title">🏢 {selected.gym_name}</h3>
                  <div>
                    <button className="btn-ghost btn-sm" onClick={() => { setGymForm({ ...selected }); setShowGym("edit"); }}>Edit</button>
                    <button className="btn-danger btn-sm ml-4" onClick={() => delGym(selected.id)}>🗑 Delete</button>
                  </div>
                </div>
                <div className="gym-detail-grid">
                  {[
                    ["Owner",  selected.owner_name],
                    ["Email",  selected.contact_email],
                    ["Phone",  selected.contact_phone],
                    ["Plan",   selected.subscription_plan],
                    ["Status", selected.is_active ? "Active" : "Inactive"],
                  ].map(([k, v]) => (
                    <div key={k} className="gym-detail-row">
                      <span className="gym-detail-key">{k}</span>
                      <span>{v || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3 className="panel-title">📍 Locations ({locations.length})</h3>
                  <button className="btn-primary btn-sm" onClick={() => { setLocForm(emptyLoc); setShowLoc(true); }}>
                    + Add Location
                  </button>
                </div>

                {showLoc && (
                  <div className="form-grid-2" style={{ marginBottom: 16 }}>
                    <div className="field-group span-2"><label>Location Name</label>
                      <input value={locForm.location_name} onChange={e => setLocForm(f => ({ ...f, location_name: e.target.value }))} /></div>
                    <div className="field-group span-2"><label>Address</label>
                      <input value={locForm.address} onChange={e => setLocForm(f => ({ ...f, address: e.target.value }))} /></div>
                    <div className="field-group"><label>City</label>
                      <input value={locForm.city} onChange={e => setLocForm(f => ({ ...f, city: e.target.value }))} /></div>
                    <div className="field-group"><label>Country</label>
                      <input value={locForm.country} onChange={e => setLocForm(f => ({ ...f, country: e.target.value }))} /></div>
                    <div className="ai-action-row span-2">
                      <button className="btn-primary" onClick={saveLoc}>Save Location</button>
                      <button className="btn-ghost" onClick={() => setShowLoc(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {locations.map(loc => (
                  <div key={loc.id} className="location-row">
                    <div>
                      <div className="loc-name">{loc.location_name}</div>
                      <div className="loc-meta">{[loc.address, loc.city, loc.country].filter(Boolean).join(", ")}</div>
                    </div>
                    <button className="btn-sm btn-danger" onClick={() => delLoc(loc.id)}>✕</button>
                  </div>
                ))}
                {locations.length === 0 && !showLoc && (
                  <div className="empty-state">No locations added yet.</div>
                )}
              </div>
            </>
          )}

          {!selected && !showGym && (
            <div className="empty-state panel">Select a gym from the list to view details.</div>
          )}
        </div>
      </div>
    </div>
  );
}
