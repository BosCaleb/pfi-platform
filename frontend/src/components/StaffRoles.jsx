// ── Staff & Roles (Phase 4.1) ──────────────────────────────────────────
import { useEffect, useState } from "react";
import { request } from "../utils/api.js";

const DEFAULT_PERMISSIONS = [
  "view_members", "edit_members", "delete_members",
  "view_billing", "create_invoices", "record_payments",
  "view_sessions", "manage_sessions",
  "mark_attendance", "view_reports",
  "manage_packages", "send_messages",
  "manage_coach_tasks", "view_recommendations",
];

function RoleForm({ onSave, onCancel, initial }) {
  const [name, setName]   = useState(initial?.role_name || "");
  const [desc, setDesc]   = useState(initial?.description || "");
  const [perms, setPerms] = useState(initial?.permissions || []);
  const [msg, setMsg]     = useState("");

  function togglePerm(p) {
    setPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  async function submit(e) {
    e.preventDefault();
    setMsg("Saving…");
    try {
      await onSave({ role_name: name, description: desc, permissions: perms });
      setMsg("");
    } catch (err) { setMsg(err.message); }
  }

  return (
    <form className="ci-form" onSubmit={submit}>
      <div className="p2-two-col">
        <label>Role Name *<input required value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Description<input value={desc} onChange={e => setDesc(e.target.value)} /></label>
      </div>
      <div>
        <strong style={{ display: "block", marginBottom: "0.5rem" }}>Permissions</strong>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {DEFAULT_PERMISSIONS.map(p => (
            <label key={p} style={{ display: "flex", gap: "0.3rem", alignItems: "center", cursor: "pointer", fontSize: "0.8rem" }}>
              <input type="checkbox" checked={perms.includes(p)} onChange={() => togglePerm(p)} />
              {p.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </div>
      {msg && <p className={msg.startsWith("✓") ? "form-note info" : "form-note danger"}>{msg}</p>}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button className="primary" type="submit">Save Role</button>
        <button className="ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function StaffRoles({ token }) {
  const [roles, setRoles]               = useState([]);
  const [admins, setAdmins]             = useState([]);
  const [assignments, setAssignments]   = useState([]);
  const [tab, setTab]                   = useState("roles");
  const [creating, setCreating]         = useState(false);
  const [editing, setEditing]           = useState(null);
  const [assignAdminId, setAssignAdminId] = useState("");
  const [assignRoleId, setAssignRoleId]   = useState("");
  const [msg, setMsg]                   = useState("");

  async function loadAll() {
    try {
      const [r, a, asgn] = await Promise.all([
        request("/api/admin-roles/roles", token),
        request("/api/admin-roles/admins", token),
        request("/api/admin-roles/assignments", token),
      ]);
      setRoles(r);
      setAdmins(a);
      setAssignments(asgn);
    } catch (e) { setMsg(e.message); }
  }

  useEffect(() => { loadAll(); }, []);

  async function saveRole(form) {
    if (editing) {
      await request(`/api/admin-roles/roles/${editing.id}`, token, { method: "PUT", body: JSON.stringify(form) });
    } else {
      await request("/api/admin-roles/roles", token, { method: "POST", body: JSON.stringify(form) });
    }
    setCreating(false);
    setEditing(null);
    await loadAll();
    setMsg("✓ Role saved.");
  }

  async function deleteRole(id, name) {
    if (!confirm(`Delete role "${name}"?`)) return;
    try {
      await request(`/api/admin-roles/roles/${id}`, token, { method: "DELETE" });
      await loadAll();
    } catch (e) { setMsg(e.message); }
  }

  async function assignRole() {
    if (!assignAdminId || !assignRoleId) return;
    try {
      await request("/api/admin-roles/assignments", token, {
        method: "POST",
        body: JSON.stringify({ admin_id: Number(assignAdminId), role_id: Number(assignRoleId) }),
      });
      setAssignAdminId("");
      setAssignRoleId("");
      await loadAll();
      setMsg("✓ Role assigned.");
    } catch (e) { setMsg(e.message); }
  }

  async function removeAssignment(id) {
    if (!confirm("Remove this role assignment?")) return;
    try {
      await request(`/api/admin-roles/assignments/${id}`, token, { method: "DELETE" });
      await loadAll();
    } catch (e) { setMsg(e.message); }
  }

  return (
    <div className="p2-section">
      <div className="p2-section-header">
        <h2>👔 Staff & Roles</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {["roles", "staff", "assignments"].map(t => (
            <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "roles" ? "🏷 Roles" : t === "staff" ? "👤 Staff" : "🔗 Assignments"}
            </button>
          ))}
        </div>
      </div>
      {msg && <p className={msg.startsWith("✓") ? "form-note info" : "form-note danger"}>{msg}</p>}

      {tab === "roles" && (
        <>
          <button className="primary" style={{ marginBottom: "0.75rem" }} onClick={() => { setCreating(c => !c); setEditing(null); }}>
            {creating ? "Cancel" : "+ New Role"}
          </button>
          {(creating || editing) && (
            <RoleForm initial={editing} onSave={saveRole} onCancel={() => { setCreating(false); setEditing(null); }} />
          )}
          <div className="ci-grid">
            {roles.length === 0 && <p className="ci-empty">No roles defined.</p>}
            {roles.map(r => (
              <div key={r.id} className="ci-task-row">
                <div style={{ flex: 1 }}>
                  <strong>{r.role_name}</strong>
                  {r.description && <div className="text-muted">{r.description}</div>}
                  <div style={{ marginTop: "0.25rem", display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                    {r.permissions?.map(p => (
                      <span key={p} className="badge-neutral" style={{ fontSize: "0.7rem" }}>{p.replace(/_/g, " ")}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button className="ghost" onClick={() => { setEditing(r); setCreating(false); }}>Edit</button>
                  <button className="danger-btn" onClick={() => deleteRole(r.id, r.role_name)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "staff" && (
        <div className="ci-grid">
          {admins.length === 0 && <p className="ci-empty">No staff members found.</p>}
          {admins.map(a => (
            <div key={a.id} className="ci-task-row">
              <div style={{ flex: 1 }}>
                <strong>{a.email}</strong>
                {a.is_super_admin && <span className="confidence-badge badge-gold" style={{ marginLeft: "0.5rem" }}>Super Admin</span>}
                <div className="text-muted" style={{ marginTop: "0.25rem" }}>
                  {a.roles?.length > 0 ? a.roles.join(", ") : "No roles assigned"}
                </div>
              </div>
              <div className="text-muted" style={{ fontSize: "0.75rem" }}>Since {a.created_at?.slice(0, 10)}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "assignments" && (
        <>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <select value={assignAdminId} onChange={e => setAssignAdminId(e.target.value)} style={{ flex: 1 }}>
              <option value="">— Select Staff Member —</option>
              {admins.map(a => <option key={a.id} value={a.id}>{a.email}</option>)}
            </select>
            <select value={assignRoleId} onChange={e => setAssignRoleId(e.target.value)} style={{ flex: 1 }}>
              <option value="">— Select Role —</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
            </select>
            <button className="primary" onClick={assignRole} disabled={!assignAdminId || !assignRoleId}>Assign</button>
          </div>
          <div className="ci-grid">
            {assignments.length === 0 && <p className="ci-empty">No role assignments.</p>}
            {assignments.map(a => (
              <div key={a.id} className="ci-task-row">
                <div style={{ flex: 1 }}>
                  <strong>{a.admin_email}</strong>
                  <span className="badge-neutral" style={{ marginLeft: "0.5rem" }}>{a.role_name}</span>
                  {a.assigned_by_email && <div className="text-muted" style={{ fontSize: "0.75rem" }}>Assigned by {a.assigned_by_email}</div>}
                </div>
                <button className="danger-btn" onClick={() => removeAssignment(a.id)}>Remove</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
