// ── Manage tab ────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { Badge } from "../ui/Badge.jsx";

// ── Portal Access sub-section ──────────────────────────────────────────
function PortalAccessSection({ member, token }) {
  const [status,      setStatus]      = useState(null);   // { portal_enabled, has_password, portal_last_login }
  const [loading,     setLoading]     = useState(true);
  const [toggling,    setToggling]    = useState(false);
  const [msg,         setMsg]         = useState("");
  const [msgOk,       setMsgOk]       = useState(false);

  // password-set form
  const [showPwForm,  setShowPwForm]  = useState(false);
  const [newPw,       setNewPw]       = useState("");
  const [pwLoading,   setPwLoading]   = useState(false);

  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  // Load status once
  useEffect(() => {
    fetch("/api/member/admin/portal-status", { headers: authHeaders })
      .then(r => r.json())
      .then(list => {
        const found = Array.isArray(list) ? list.find(m => m.id === member.id) : null;
        setStatus(found || { portal_enabled: false, has_password: false, portal_last_login: null });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [member.id]);

  const flash = (text, ok = false) => { setMsg(text); setMsgOk(ok); };

  const toggleAccess = async () => {
    setToggling(true); flash("");
    try {
      const r = await fetch(`/api/member/admin/toggle-access/${member.id}`, {
        method: "POST", headers: authHeaders,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Failed");
      setStatus(prev => ({ ...prev, portal_enabled: d.portal_enabled }));
      flash(d.message, true);
    } catch (err) {
      flash(err.message);
    }
    setToggling(false);
  };

  const setPassword = async (e) => {
    e.preventDefault();
    if (newPw.length < 8) { flash("Password must be at least 8 characters"); return; }
    setPwLoading(true); flash("");
    try {
      const r = await fetch("/api/member/admin/set-password", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ member_id: member.id, password: newPw, enable_portal: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Failed");
      setStatus(prev => ({ ...prev, has_password: true, portal_enabled: d.portal_enabled }));
      flash(d.message, true);
      setNewPw("");
      setShowPwForm(false);
    } catch (err) {
      flash(err.message);
    }
    setPwLoading(false);
  };

  if (loading) return <div style={{ color: "var(--muted)", fontSize: "13px", padding: "8px 0" }}>Loading portal status…</div>;

  const enabled = status?.portal_enabled;
  const hasPw   = status?.has_password;
  const lastLogin = status?.portal_last_login;

  return (
    <div className="portal-access-section">
      {/* Status row */}
      <div className="portal-status-row">
        <div className="portal-status-item">
          <span className="portal-status-label">Access</span>
          <span className={`portal-status-badge ${enabled ? "enabled" : "disabled"}`}>
            {enabled ? "✓ Enabled" : "✗ Disabled"}
          </span>
        </div>
        <div className="portal-status-item">
          <span className="portal-status-label">Password</span>
          <span className={`portal-status-badge ${hasPw ? "enabled" : "disabled"}`}>
            {hasPw ? "✓ Set" : "Not set"}
          </span>
        </div>
        <div className="portal-status-item">
          <span className="portal-status-label">Last Login</span>
          <span className="portal-status-value">
            {lastLogin
              ? new Date(lastLogin).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
              : "Never"}
          </span>
        </div>
      </div>

      {/* Portal URL */}
      <div className="portal-url-note">
        Member portal URL: <code>{window.location.origin}/portal</code>
      </div>

      {/* Message feedback */}
      {msg && (
        <div style={{ fontSize: "13px", padding: "6px 0", color: msgOk ? "var(--success)" : "var(--danger)" }}>
          {msg}
        </div>
      )}

      {/* Action buttons */}
      <div className="portal-action-row">
        <button
          className={enabled ? "secondary" : "primary"}
          type="button"
          onClick={toggleAccess}
          disabled={toggling}
          style={{ fontSize: "13px", padding: "7px 16px" }}
        >
          {toggling ? "…" : enabled ? "🔒 Disable Portal Access" : "🔓 Enable Portal Access"}
        </button>

        <button
          className="secondary"
          type="button"
          onClick={() => { setShowPwForm(v => !v); flash(""); }}
          style={{ fontSize: "13px", padding: "7px 16px" }}
        >
          {hasPw ? "🔑 Reset Password" : "🔑 Set Portal Password"}
        </button>
      </div>

      {/* Password form */}
      {showPwForm && (
        <form onSubmit={setPassword} className="portal-pw-form">
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                {hasPw ? "New Password" : "Set Password"} (min. 8 characters)
              </label>
              <input
                type="password"
                required
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Enter password…"
                autoComplete="new-password"
                style={{
                  width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "6px", color: "var(--text)", fontSize: "13px", padding: "7px 10px",
                }}
              />
            </div>
            <button
              type="submit"
              className="primary"
              disabled={pwLoading}
              style={{ fontSize: "13px", padding: "7px 16px", whiteSpace: "nowrap" }}
            >
              {pwLoading ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => { setShowPwForm(false); setNewPw(""); flash(""); }}
              style={{ fontSize: "13px", padding: "7px 12px" }}
            >
              Cancel
            </button>
          </div>
          <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
            Saving will also enable portal access if not already active.
            Share the portal URL and this password with the member.
          </p>
        </form>
      )}
    </div>
  );
}


// ── Main ManageTab ─────────────────────────────────────────────────────
export function ManageTab({ member, token, onEdit, onDeleteMember }) {
  const fullName = `${member.first_name} ${member.last_name}`;

  return (
    <>
      <div className="intel-section">
        <h4>Member Information</h4>
        <div className="detail-grid">
          <div className="detail-metric">
            <span>Status</span>
            <strong style={{ fontSize: "14px" }}><Badge value={member.status || "Active"} /></strong>
          </div>
          <div className="detail-metric">
            <span>Gender</span>
            <strong style={{ fontSize: "14px" }}>{member.gender || "—"}</strong>
          </div>
          <div className="detail-metric">
            <span>Age</span>
            <strong>{member.age || "—"}</strong>
          </div>
          <div className="detail-metric">
            <span>Location</span>
            <strong style={{ fontSize: "13px" }}>{member.location || "—"}</strong>
          </div>
          <div className="detail-metric">
            <span>Occupation</span>
            <strong style={{ fontSize: "13px" }}>{member.occupation || "—"}</strong>
          </div>
          <div className="detail-metric">
            <span>Reg. Date</span>
            <strong style={{ fontSize: "12px" }}>{member.registration_date?.slice(0, 10) || "—"}</strong>
          </div>
        </div>
        <div className="detail-grid" style={{ marginTop: "8px" }}>
          <div className="detail-metric">
            <span>Emergency Contact</span>
            <strong style={{ fontSize: "13px" }}>{member.emergency_contact_name || "—"}</strong>
          </div>
          <div className="detail-metric">
            <span>Emergency Phone</span>
            <strong style={{ fontSize: "13px" }}>{member.emergency_contact_phone || "—"}</strong>
          </div>
        </div>
      </div>

      <div className="intel-section">
        <h4>Consents</h4>
        <div className="detail-grid">
          <div className="detail-metric">
            <span>Privacy Consent</span>
            <strong style={{ color: member.privacy_consent ? "var(--success)" : "var(--danger)" }}>
              {member.privacy_consent ? "✓ Yes" : "✗ No"}
            </strong>
          </div>
          <div className="detail-metric">
            <span>Medical Disclaimer</span>
            <strong style={{ color: member.medical_disclaimer_accepted ? "var(--success)" : "var(--danger)" }}>
              {member.medical_disclaimer_accepted ? "✓ Yes" : "✗ No"}
            </strong>
          </div>
          <div className="detail-metric">
            <span>Marketing Consent</span>
            <strong style={{ color: member.marketing_consent ? "var(--success)" : "var(--muted)" }}>
              {member.marketing_consent ? "✓ Yes" : "— No"}
            </strong>
          </div>
          <div className="detail-metric">
            <span>Consent Date</span>
            <strong style={{ fontSize: "12px" }}>{member.consent_signed_at?.slice(0, 10) || "—"}</strong>
          </div>
        </div>
      </div>

      {/* ── Member Portal Access ── */}
      <div className="intel-section">
        <h4>🌐 Member Portal Access</h4>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "14px", lineHeight: "1.5" }}>
          Grant this member access to the member portal at <strong>{window.location.origin}/portal</strong>.
          They can view their plans, progress, billing and messages.
        </p>
        <PortalAccessSection member={member} token={token} />
      </div>

      <button
        className="secondary"
        type="button"
        onClick={() => onEdit(member.id)}
        style={{ width: "100%", marginBottom: "12px" }}
      >
        ✏ Edit Full Profile
      </button>

      <div className="danger-zone">
        <h4>⚠ Danger Zone</h4>
        <p>
          Permanently delete <strong>{fullName}</strong> and all their associated data —
          assessments, progress entries, workout plans, nutrition plans, and supplement plans.
          This action cannot be undone.
        </p>
        <button
          className="danger"
          type="button"
          onClick={() => onDeleteMember(member.id, fullName)}
        >
          🗑 Delete Member
        </button>
      </div>
    </>
  );
}
