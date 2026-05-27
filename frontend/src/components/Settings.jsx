// ── Settings ─────────────────────────────────────────────────────────
export function Settings({ settings, onRefresh }) {
  const s = settings || {};
  const cards = [
    { label: "Platform",           value: s.short_name,                                    icon: "⚡" },
    { label: "Admin Email",        value: s.admin_email,                                   icon: "📧" },
    { label: "Admin Seed",         value: s.admin_seed_enabled ? "Enabled" : "Disabled",  icon: "🔑" },
    { label: "Member Login",       value: s.member_login_enabled ? "Enabled" : "Future",  icon: "👤" },
    { label: "AI Recommendations", value: s.ai_recommendations_enabled ? "Enabled" : "Future", icon: "🤖" },
    { label: "Data Access",        value: "Admin only",                                    icon: "🔒" },
  ];

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>Platform Settings</h2>
          <p className="muted text-sm" style={{ marginTop: "4px" }}>
            System configuration and feature flags
          </p>
        </div>
        <button className="ghost" type="button" onClick={onRefresh}>↻ Refresh</button>
      </div>

      <div className="settings-grid">
        {cards.map(({ label, value, icon }) => (
          <div className="panel settings-card" key={label}>
            <h4>{icon} {label}</h4>
            <div className="settings-value">{value ?? "—"}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
