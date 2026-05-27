// ── Dashboard ────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { Badge }    from "./ui/Badge.jsx";
import { ScoreBar } from "./ui/ScoreBar.jsx";
import { request }  from "../utils/api.js";
import { initials, avatarVariant } from "../utils/helpers.js";

const STAT_CARDS = (s) => [
  { label: "Total Members",  value: s.total_members  ?? 0, color: "cyan",   icon: "👥" },
  { label: "Active",         value: s.active_members ?? 0, color: "purple", icon: "⚡" },
  { label: "New This Month", value: s.new_this_month ?? 0, color: "lime",   icon: "🆕" },
  { label: "High Risk",      value: s.high_risk      ?? 0, color: "danger", icon: "⚠" },
];

/** Labelled row in the Recent Members list. */
function RecentMemberRow({ m, onSelect }) {
  const parts = m.name?.split(" ") ?? [];
  return (
    <div
      className="list-item"
      onClick={() => onSelect(m.id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onSelect(m.id)}
    >
      <div className={`list-item-avatar avatar-${avatarVariant(m.id)}`}>
        {initials(parts[0], parts[1])}
      </div>
      <div className="list-item-info">
        <div className="list-item-name">{m.name}</div>
        <div className="list-item-meta">{m.goal || "No goal"} · {m.level || "No level"}</div>
      </div>
      <Badge value={m.risk || "Low"} />
    </div>
  );
}

/** Single alert row in the Reassessment Alerts panel. */
function AlertRow({ r, onSelect }) {
  const daysLabel =
    r.days_overdue > 0  ? `${r.days_overdue}d overdue`
    : r.days_overdue === 0 ? "Due today"
    : `Due in ${Math.abs(r.days_overdue)}d`;

  return (
    <div
      className={`alert-row ${r.urgency}`}
      onClick={() => onSelect(r.member_id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onSelect(r.member_id)}
      style={{ cursor: "pointer" }}
    >
      <span className="alert-urgency-dot" />
      <div className="alert-info">
        <div className="alert-name">{r.name}</div>
        <div className="alert-meta">
          Due {r.due_date}
          {r.last_assessment ? ` · Last ${r.last_assessment}` : " · Never assessed"}
        </div>
      </div>
      <div className="alert-days">{daysLabel}</div>
    </div>
  );
}

export function Dashboard({ stats, reassessments, token, onRefresh, onSelectMember }) {
  const s        = stats || {};
  const alerts   = reassessments ?? [];
  const critical = alerts.filter(r => r.urgency === "critical").length;

  // Phase 2 KPIs
  const [p2Stats, setP2Stats] = useState(null);

  useEffect(() => {
    if (!token) return;
    Promise.allSettled([
      request("/api/workout-groups/?status=Active", token),
      request("/api/reassessment-alerts/?status=Open", token),
      request("/api/workout-sessions/member/0", token).catch(() => null), // just to see if endpoint works
    ]).then(([groups, openAlerts]) => {
      setP2Stats({
        activeGroups: groups.status === "fulfilled" ? groups.value.length : 0,
        openAlerts:   openAlerts.status === "fulfilled" ? openAlerts.value.length : 0,
      });
    });
  }, [token]);

  const platformHealth = [
    ["Members on file", Math.min(100, (s.total_members || 0) * 10), "cyan"],
    ["Active rate",     s.total_members ? Math.round((s.active_members / s.total_members) * 100) : 0, "lime"],
    ["Risk load",       s.total_members ? Math.round(((s.high_risk || 0) / s.total_members) * 100) : 0, "danger"],
  ];

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>Command Centre</h2>
          <p className="muted text-sm" style={{ marginTop: "4px" }}>
            Platform intelligence snapshot
          </p>
        </div>
        <div className="section-title-right">
          {critical > 0 && (
            <span className="badge high">⚠ {critical} critical</span>
          )}
          <button className="ghost" type="button" onClick={onRefresh}>↻ Refresh</button>
        </div>
      </div>

      {/* KPI stat cards */}
      <div className="stats-grid">
        {STAT_CARDS(s).map(({ label, value, color, icon }) => (
          <div className={`stat-card ${color}`} key={label}>
            <div className="stat-card-top">
              <span className="stat-card-label">{label}</span>
              <span className="stat-icon">{icon}</span>
            </div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>

      {/* Phase 2 KPIs */}
      {p2Stats && (
        <div className="stats-grid" style={{ marginBottom: 22, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <div className="stat-card purple">
            <div className="stat-card-top">
              <span className="stat-card-label">Active Groups</span>
              <span className="stat-icon">🏋️</span>
            </div>
            <div className="stat-value">{p2Stats.activeGroups}</div>
          </div>
          <div className={`stat-card ${p2Stats.openAlerts > 0 ? "danger" : "lime"}`}>
            <div className="stat-card-top">
              <span className="stat-card-label">Open Alerts</span>
              <span className="stat-icon">🔔</span>
            </div>
            <div className="stat-value">{p2Stats.openAlerts}</div>
          </div>
        </div>
      )}

      <div className="dashboard-lower">
        {/* Recent members + platform health */}
        <section className="panel">
          <h3>Recent Members</h3>
          <div className="list">
            {(s.recent || []).length
              ? (s.recent || []).map(m => (
                  <RecentMemberRow key={m.id} m={m} onSelect={onSelectMember} />
                ))
              : <p className="muted text-sm">No members yet.</p>
            }
          </div>

          <div style={{ marginTop: "24px" }}>
            <h4>Platform Health</h4>
            <div className="intel-score-list">
              {platformHealth.map(([label, value, color]) => (
                <ScoreBar key={label} label={label} value={value} color={color} />
              ))}
            </div>
          </div>
        </section>

        {/* Reassessment alerts */}
        <section className="panel">
          <h3>🔔 Reassessment Alerts</h3>
          {alerts.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">✅</span>
              All active members are up to date.
            </div>
          ) : (
            <>
              {critical > 0 && (
                <p className="muted text-xs" style={{ marginBottom: "10px" }}>
                  ⚠ {critical} member{critical !== 1 ? "s" : ""} critically overdue (&gt;30 days)
                </p>
              )}
              <div className="alert-list">
                {alerts.slice(0, 8).map(r => (
                  <AlertRow key={r.member_id} r={r} onSelect={onSelectMember} />
                ))}
              </div>
              {alerts.length > 8 && (
                <p className="muted text-xs" style={{ marginTop: "10px", textAlign: "center" }}>
                  +{alerts.length - 8} more — go to Members to see all
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </section>
  );
}
