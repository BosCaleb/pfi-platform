// ── Membership Packages (Phase 4.1) ───────────────────────────────────
import { useEffect, useState } from "react";
import { request } from "../utils/api.js";

const EMPTY_PKG = {
  package_name: "", package_type: "Monthly", price: "", billing_frequency: "Monthly",
  sessions_per_week: "", sessions_per_month: "", total_sessions_in_pack: "",
  includes_workout_plan: false, includes_nutrition_guidance: false,
  includes_supplement_guidance: false, includes_member_portal: true,
  includes_reassessments: false, package_status: "Active",
};

const PKG_TYPES = ["Monthly", "Once-Off", "Session Pack", "Online Coaching", "Assessment Only"];
const BILL_FREQ = ["Monthly", "Weekly", "Once-Off", "Custom"];
const STATUSES  = ["Active", "Draft", "Archived"];

function PackageForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_PKG, ...initial });
  const [msg, setMsg] = useState("");

  function field(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setMsg("Saving…");
    try {
      await onSave(form);
      setMsg("");
    } catch (err) { setMsg(err.message); }
  }

  return (
    <form className="ci-form" onSubmit={submit}>
      <div className="p2-two-col">
        <label>Package Name *<input required value={form.package_name} onChange={e => field("package_name", e.target.value)} /></label>
        <label>Type<select value={form.package_type} onChange={e => field("package_type", e.target.value)}>
          {PKG_TYPES.map(t => <option key={t}>{t}</option>)}
        </select></label>
        <label>Price (R) *<input required type="number" min="0" step="0.01" value={form.price} onChange={e => field("price", e.target.value)} /></label>
        <label>Billing Frequency<select value={form.billing_frequency} onChange={e => field("billing_frequency", e.target.value)}>
          {BILL_FREQ.map(f => <option key={f}>{f}</option>)}
        </select></label>
        <label>Sessions/Week<input type="number" min="0" value={form.sessions_per_week} onChange={e => field("sessions_per_week", e.target.value)} /></label>
        <label>Sessions/Month<input type="number" min="0" value={form.sessions_per_month} onChange={e => field("sessions_per_month", e.target.value)} /></label>
        <label>Total Sessions in Pack<input type="number" min="0" value={form.total_sessions_in_pack} onChange={e => field("total_sessions_in_pack", e.target.value)} /></label>
        <label>Status<select value={form.package_status} onChange={e => field("package_status", e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select></label>
      </div>
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", margin: "0.5rem 0" }}>
        {[
          ["includes_workout_plan", "Workout Plan"],
          ["includes_nutrition_guidance", "Nutrition Guidance"],
          ["includes_supplement_guidance", "Supplement Guidance"],
          ["includes_member_portal", "Member Portal"],
          ["includes_reassessments", "Reassessments"],
        ].map(([k, lbl]) => (
          <label key={k} style={{ display: "flex", gap: "0.4rem", alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={!!form[k]} onChange={e => field(k, e.target.checked)} />
            {lbl}
          </label>
        ))}
      </div>
      {msg && <p className={msg.startsWith("✓") ? "form-note info" : "form-note danger"}>{msg}</p>}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button className="primary" type="submit">Save Package</button>
        <button className="ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function MembershipPackages({ token }) {
  const [packages, setPackages] = useState([]);
  const [editing, setEditing]   = useState(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg]           = useState("");

  async function load() {
    try { setPackages(await request("/api/membership-packages/", token)); }
    catch (e) { setMsg(e.message); }
  }

  useEffect(() => { load(); }, []);

  async function save(form) {
    if (editing) {
      await request(`/api/membership-packages/${editing.id}`, token, { method: "PUT", body: JSON.stringify(form) });
    } else {
      await request("/api/membership-packages/", token, { method: "POST", body: JSON.stringify(form) });
    }
    setEditing(null);
    setCreating(false);
    await load();
    setMsg("✓ Package saved.");
  }

  async function del(pkg) {
    if (!confirm(`Delete package "${pkg.package_name}"?`)) return;
    try {
      await request(`/api/membership-packages/${pkg.id}`, token, { method: "DELETE" });
      await load();
    } catch (e) { setMsg(e.message); }
  }

  return (
    <div className="p2-section">
      <div className="p2-section-header">
        <h2>📦 Membership Packages</h2>
        <button className="primary" onClick={() => { setCreating(true); setEditing(null); }}>+ New Package</button>
      </div>
      {msg && <p className={msg.startsWith("✓") ? "form-note info" : "form-note danger"}>{msg}</p>}

      {(creating || editing) && (
        <PackageForm
          initial={editing || {}}
          onSave={save}
          onCancel={() => { setCreating(false); setEditing(null); }}
        />
      )}

      <div className="ci-grid">
        {packages.length === 0 && <p className="ci-empty">No packages yet. Create one above.</p>}
        {packages.map(pkg => (
          <div key={pkg.id} className="ci-task-row">
            <div style={{ flex: 1 }}>
              <strong>{pkg.package_name}</strong>
              <span className="badge-neutral" style={{ marginLeft: "0.5rem" }}>{pkg.package_type}</span>
              <span className={`badge-neutral badge-${pkg.package_status === "Active" ? "lime" : "warn"}`} style={{ marginLeft: "0.4rem" }}>{pkg.package_status}</span>
              <div className="text-muted" style={{ marginTop: "0.25rem" }}>
                R {Number(pkg.price).toLocaleString()} · {pkg.billing_frequency}
                {pkg.sessions_per_week ? ` · ${pkg.sessions_per_week}×/wk` : ""}
                {pkg.total_sessions_in_pack ? ` · ${pkg.total_sessions_in_pack} sessions` : ""}
              </div>
              <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                {pkg.active_member_count} active member{pkg.active_member_count !== 1 ? "s" : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="ghost" onClick={() => { setEditing(pkg); setCreating(false); }}>Edit</button>
              <button className="danger-btn" onClick={() => del(pkg)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
