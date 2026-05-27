// ── Settings ──────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { request } from "../utils/api.js";

// ── Admin list row ────────────────────────────────────────────────────
function AdminRow({ admin, onDelete }) {
  return (
    <div className="list-item" style={{ cursor: "default" }}>
      <div className="list-item-info">
        <div className="list-item-name">
          {admin.name}
          {admin.is_self && (
            <span className="history-chip highlight" style={{ marginLeft: 8, fontSize: 10 }}>
              YOU
            </span>
          )}
        </div>
        <div className="list-item-meta">
          {admin.email}
          {admin.created_at && (
            <> · Added {new Date(admin.created_at).toLocaleDateString()}</>
          )}
        </div>
      </div>
      {!admin.is_self && (
        <button
          className="delete-btn"
          type="button"
          title="Remove admin"
          onClick={() => onDelete(admin)}
        >
          🗑
        </button>
      )}
    </div>
  );
}

// ── Settings page ─────────────────────────────────────────────────────
export function Settings({ settings, token, onRefresh }) {
  const s = settings || {};

  // Admin list
  const [admins,   setAdmins]   = useState([]);
  const [adminMsg, setAdminMsg] = useState("");

  // Change password form
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwMsg,  setPwMsg]  = useState("");

  // Create admin form
  const [newAdmin,    setNewAdmin]    = useState({ email: "", password: "", name: "" });
  const [showCreate,  setShowCreate]  = useState(false);
  const [createMsg,   setCreateMsg]   = useState("");

  const loadAdmins = useCallback(async () => {
    if (!token) return;
    try {
      setAdmins(await request("/api/auth/admins", token));
    } catch { setAdmins([]); }
  }, [token]);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  // ── Change password ────────────────────────────────────────────────
  async function submitChangePassword(e) {
    e.preventDefault();
    setPwMsg("");
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg("New passwords do not match.");
      return;
    }
    if (pwForm.new_password.length < 8) {
      setPwMsg("Password must be at least 8 characters.");
      return;
    }
    try {
      const r = await request("/api/auth/change-password", token, {
        method: "POST",
        body: JSON.stringify({
          current_password: pwForm.current_password,
          new_password: pwForm.new_password,
        }),
      });
      setPwMsg("✓ " + r.message);
      setPwForm({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      setPwMsg("⚠ " + err.message);
    }
  }

  // ── Create admin ───────────────────────────────────────────────────
  async function submitCreateAdmin(e) {
    e.preventDefault();
    setCreateMsg("Creating…");
    try {
      const r = await request("/api/auth/create-admin", token, {
        method: "POST",
        body: JSON.stringify(newAdmin),
      });
      setCreateMsg(`✓ Admin created — ${r.email}`);
      setNewAdmin({ email: "", password: "", name: "" });
      setShowCreate(false);
      await loadAdmins();
    } catch (err) {
      setCreateMsg("⚠ " + err.message);
    }
  }

  // ── Delete admin ───────────────────────────────────────────────────
  async function deleteAdmin(admin) {
    if (!confirm(`Remove admin account for ${admin.email}?\n\nThis cannot be undone.`)) return;
    setAdminMsg("Removing…");
    try {
      const r = await request(`/api/auth/admins/${admin.id}`, token, { method: "DELETE" });
      setAdminMsg("✓ " + r.message);
      await loadAdmins();
    } catch (err) {
      setAdminMsg("⚠ " + err.message);
    }
  }

  // ── Info cards ─────────────────────────────────────────────────────
  const cards = [
    { label: "Platform",           value: s.short_name,                                    icon: "⚡" },
    { label: "Admin Seed",         value: s.admin_seed_enabled ? "Enabled" : "Disabled",  icon: "🔑" },
    { label: "Member Login",       value: s.member_login_enabled ? "Enabled" : "Future",  icon: "👤" },
    { label: "AI Recommendations", value: s.ai_recommendations_enabled ? "Enabled" : "Future", icon: "🤖" },
    { label: "Data Access",        value: "Admin only",                                    icon: "🔒" },
    { label: "Database",           value: "DuckDB",                                        icon: "💾" },
  ];

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>⚙️ Platform Settings</h2>
          <p className="muted text-sm" style={{ marginTop: 4 }}>
            System configuration and admin management
          </p>
        </div>
        <button className="ghost" type="button" onClick={onRefresh}>↻ Refresh</button>
      </div>

      {/* Info cards */}
      <div className="settings-grid" style={{ marginBottom: 28 }}>
        {cards.map(({ label, value, icon }) => (
          <div className="panel settings-card" key={label}>
            <h4>{icon} {label}</h4>
            <div className="settings-value">{value ?? "—"}</div>
          </div>
        ))}
      </div>

      {/* Admin management */}
      <div className="form-grid-2" style={{ gap: 20 }}>

        {/* Admin accounts */}
        <div className="panel">
          <div className="section-title" style={{ marginBottom: 14 }}>
            <h3 style={{ marginBottom: 0 }}>👤 Admin Accounts</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {adminMsg && <span className="message text-xs">{adminMsg}</span>}
              <button
                type="button"
                style={{ fontSize: 12, padding: "5px 12px", minHeight: 32 }}
                onClick={() => { setShowCreate(s => !s); setCreateMsg(""); }}
              >
                {showCreate ? "Cancel" : "+ Add Admin"}
              </button>
            </div>
          </div>

          {/* Create form */}
          {showCreate && (
            <form style={{ marginBottom: 16 }} onSubmit={submitCreateAdmin}>
              <div style={{ display: "grid", gap: 10, marginBottom: 10 }}>
                <label>Full Name *
                  <input required value={newAdmin.name}
                    onChange={e => setNewAdmin(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Jane Smith" />
                </label>
                <label>Email Address *
                  <input type="email" required value={newAdmin.email}
                    onChange={e => setNewAdmin(f => ({ ...f, email: e.target.value }))} />
                </label>
                <label>Password * (min 8 chars)
                  <input type="password" required minLength={8} value={newAdmin.password}
                    onChange={e => setNewAdmin(f => ({ ...f, password: e.target.value }))} />
                </label>
              </div>
              {createMsg && <p className="message text-xs" style={{ marginBottom: 8 }}>{createMsg}</p>}
              <button type="submit">Create Admin</button>
            </form>
          )}

          {/* Admin list */}
          <div className="list">
            {admins.length === 0 ? (
              <p className="muted text-sm">No admins loaded.</p>
            ) : (
              admins.map(a => (
                <AdminRow key={a.id} admin={a} onDelete={deleteAdmin} />
              ))
            )}
          </div>
        </div>

        {/* Change password */}
        <div className="panel">
          <h3>🔐 Change Password</h3>
          <p className="muted text-sm" style={{ marginBottom: 16, lineHeight: 1.6 }}>
            Update your own login password. You will remain logged in after changing it.
          </p>
          <form onSubmit={submitChangePassword}>
            <div style={{ display: "grid", gap: 12 }}>
              <label>Current Password
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={pwForm.current_password}
                  onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                />
              </label>
              <label>New Password (min 8 chars)
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={pwForm.new_password}
                  onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                />
              </label>
              <label>Confirm New Password
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                />
              </label>
            </div>
            {pwMsg && (
              <p
                className={`message text-sm ${pwMsg.startsWith("✓") ? "ok" : "error"}`}
                style={{ marginTop: 10 }}
              >
                {pwMsg}
              </p>
            )}
            <div style={{ marginTop: 14 }}>
              <button type="submit">Update Password</button>
            </div>
          </form>
        </div>

      </div>
    </section>
  );
}
