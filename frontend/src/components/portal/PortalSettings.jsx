import { useState } from "react";

export default function PortalSettings({ token, member }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw,     setNewPw]     = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg,       setMsg]       = useState("");
  const [success,   setSuccess]   = useState(false);
  const [loading,   setLoading]   = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg(""); setSuccess(false);
    try {
      const r = await fetch("/api/member/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          current_password: currentPw,
          new_password: newPw,
          confirm_password: confirmPw,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Failed to update password");
      setSuccess(true);
      setMsg(data.message);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      setMsg(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="mp-page">
      <h2 className="mp-page-title">⚙️ Settings</h2>

      {/* Profile info (read-only) */}
      <div className="mp-card">
        <div className="mp-card-header">
          <span className="mp-card-title">Your Profile</span>
          <span className="mp-card-date">Read-only · Contact your coach to update</span>
        </div>
        <div className="mp-settings-profile">
          {[
            ["Name",   `${member.first_name} ${member.last_name}`],
            ["Email",  member.email],
            ["Goal",   member.primary_goal],
            ["Level",  member.fitness_level],
          ].map(([label, val]) => (
            <div key={label} className="mp-settings-row">
              <span className="mp-settings-label">{label}</span>
              <span className="mp-settings-val">{val || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Change password */}
      <div className="mp-card">
        <div className="mp-card-header">
          <span className="mp-card-title">Change Password</span>
        </div>
        <form onSubmit={changePassword} className="mp-form mp-settings-form">
          <div className="mp-field">
            <label>Current Password</label>
            <input type="password" required value={currentPw}
              onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="mp-field">
            <label>New Password</label>
            <input type="password" required value={newPw}
              onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters"
              autoComplete="new-password" />
          </div>
          <div className="mp-field">
            <label>Confirm New Password</label>
            <input type="password" required value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" />
          </div>
          {msg && (
            <div className={success ? "mp-success" : "mp-error"}>{msg}</div>
          )}
          <button type="submit" className="mp-btn-primary" disabled={loading}>
            {loading ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>

      {/* Portal info */}
      <div className="mp-card mp-portal-info">
        <div className="mp-card-title">About Your Portal</div>
        <p>This is your personal CyberFit member portal. Your coach manages your training data, plans, billing and messages here.</p>
        <p>For account issues, contact your coach directly or send us an email.</p>
        <div className="mp-portal-url">
          Your portal URL: <strong>{window.location.origin}/portal</strong>
        </div>
      </div>
    </div>
  );
}
