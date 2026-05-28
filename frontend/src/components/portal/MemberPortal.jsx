import { useState, useEffect } from "react";
import PortalOverview   from "./PortalOverview.jsx";
import PortalProgress   from "./PortalProgress.jsx";
import PortalSessions   from "./PortalSessions.jsx";
import PortalCheckins   from "./PortalCheckins.jsx";
import PortalMilestones from "./PortalMilestones.jsx";
import PortalPlans      from "./PortalPlans.jsx";
import PortalBilling    from "./PortalBilling.jsx";
import PortalMessages   from "./PortalMessages.jsx";
import PortalSettings   from "./PortalSettings.jsx";

const TABS = [
  { id: "overview",   icon: "🏠", label: "Overview" },
  { id: "progress",   icon: "📈", label: "Progress" },
  { id: "sessions",   icon: "🏋️", label: "Sessions" },
  { id: "checkins",   icon: "✅", label: "Check-ins" },
  { id: "milestones", icon: "🏆", label: "Milestones" },
  { id: "plans",      icon: "📋", label: "My Plan" },
  { id: "billing",    icon: "💳", label: "Billing" },
  { id: "messages",   icon: "💬", label: "Messages" },
  { id: "settings",   icon: "⚙️", label: "Settings" },
];

export default function MemberPortal({ token, member, onLogout }) {
  const [tab,       setTab]     = useState("overview");
  const [summary,   setSummary] = useState(null);
  const [navOpen,   setNavOpen] = useState(false);

  const hdr = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch("/api/member/portal", { headers: hdr })
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {});
  }, []);

  const unread   = summary?.unread_messages    || 0;
  const invoices = summary?.outstanding_invoices || 0;

  const changeTab = (id) => { setTab(id); setNavOpen(false); };

  return (
    <div className="mp-app">
      {/* Top bar */}
      <header className="mp-topbar">
        <div className="mp-topbar-brand">
          <span className="mp-topbar-icon">⚡</span>
          <span className="mp-topbar-name">CyberFit</span>
          <span className="mp-topbar-label">Member Portal</span>
        </div>
        <div className="mp-topbar-right">
          <span className="mp-greeting">
            Hi, {member.first_name} 👋
          </span>
          <button className="mp-burger" onClick={() => setNavOpen(o => !o)} aria-label="Menu">
            {navOpen ? "✕" : "☰"}
          </button>
          <button className="mp-signout-btn" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <div className="mp-shell">
        {/* Sidebar nav */}
        <nav className={`mp-nav ${navOpen ? "mp-nav--open" : ""}`}>
          <div className="mp-nav-member">
            <div className="mp-nav-avatar">
              {member.first_name?.[0]}{member.last_name?.[0]}
            </div>
            <div>
              <div className="mp-nav-fullname">{member.first_name} {member.last_name}</div>
              <div className="mp-nav-goal">{member.primary_goal || "General Fitness"}</div>
            </div>
          </div>

          {TABS.map(t => (
            <button
              key={t.id}
              className={`mp-nav-item ${tab === t.id ? "mp-nav-item--active" : ""}`}
              onClick={() => changeTab(t.id)}
            >
              <span className="mp-nav-icon">{t.icon}</span>
              <span className="mp-nav-label">{t.label}</span>
              {t.id === "messages"   && unread   > 0 && <span className="mp-badge">{unread}</span>}
              {t.id === "billing"    && invoices  > 0 && <span className="mp-badge mp-badge--warn">{invoices}</span>}
            </button>
          ))}

          <button className="mp-nav-item mp-nav-signout" onClick={onLogout}>
            <span className="mp-nav-icon">🚪</span>
            <span className="mp-nav-label">Sign out</span>
          </button>
        </nav>

        {/* Content */}
        <main className="mp-content">
          {tab === "overview"   && <PortalOverview   token={token} summary={summary} onTabChange={changeTab} />}
          {tab === "progress"   && <PortalProgress   token={token} member={member} />}
          {tab === "sessions"   && <PortalSessions   token={token} />}
          {tab === "checkins"   && <PortalCheckins   token={token} />}
          {tab === "milestones" && <PortalMilestones token={token} />}
          {tab === "plans"      && <PortalPlans      token={token} />}
          {tab === "billing"    && <PortalBilling    token={token} />}
          {tab === "messages"   && <PortalMessages   token={token} />}
          {tab === "settings"   && <PortalSettings   token={token} member={member} />}
        </main>
      </div>
    </div>
  );
}
