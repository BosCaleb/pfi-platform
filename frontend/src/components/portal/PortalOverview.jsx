const GOAL_EMOJI = {
  "Fat Loss": "🔥", "Weight Loss": "🔥", "Muscle Gain": "💪",
  "Strength": "🏋️", "Endurance": "🏃", "Mobility": "🧘",
  "General Fitness": "⚡", "Sport Performance": "🏅",
};

const READINESS_COLOR = (cat) => ({
  "Excellent": "#22c55e", "Good": "#84cc16", "Moderate": "#f59e0b",
  "Low": "#f97316", "Very Low": "#ef4444",
})[cat] || "#94a3b8";

export default function PortalOverview({ token, summary, onTabChange }) {
  if (!summary) {
    return (
      <div className="mp-page">
        <div className="mp-loading">Loading your dashboard…</div>
      </div>
    );
  }

  const { member, membership, sessions_30d, readiness, latest_checkin,
          latest_weight, milestones_earned, unread_messages, outstanding_invoices,
          workout_group } = summary;

  const goalEmoji = GOAL_EMOJI[member.primary_goal] || "⚡";
  const completionColor = sessions_30d.avg_completion_pct >= 75 ? "#22c55e"
    : sessions_30d.avg_completion_pct >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="mp-page">
      {/* Welcome hero */}
      <div className="mp-hero">
        <div className="mp-hero-text">
          <h2 className="mp-hero-title">
            Welcome back, {member.first_name}! {goalEmoji}
          </h2>
          <p className="mp-hero-sub">
            {member.primary_goal || "General Fitness"} · {member.fitness_level || ""}
            {workout_group && <span className="mp-hero-group"> · {workout_group}</span>}
          </p>
        </div>
        <div className="mp-membership-chip" data-status={membership.status}>
          <span>{membership.type || "No Plan"}</span>
          <span className="mp-mem-status">{membership.status}</span>
          {membership.end_date && (
            <span className="mp-mem-date">Until {new Date(membership.end_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</span>
          )}
        </div>
      </div>

      {/* Alert banners */}
      {outstanding_invoices > 0 && (
        <button className="mp-alert mp-alert--warn" onClick={() => onTabChange("billing")}>
          💳 You have {outstanding_invoices} outstanding invoice{outstanding_invoices > 1 ? "s" : ""}. Tap to view →
        </button>
      )}
      {unread_messages > 0 && (
        <button className="mp-alert mp-alert--info" onClick={() => onTabChange("messages")}>
          💬 {unread_messages} message{unread_messages > 1 ? "s" : ""} from your coach. Tap to read →
        </button>
      )}

      {/* KPI grid */}
      <div className="mp-kpi-grid">
        <div className="mp-kpi" onClick={() => onTabChange("sessions")}>
          <div className="mp-kpi-icon">🏋️</div>
          <div className="mp-kpi-val">{sessions_30d.completed}<span className="mp-kpi-of">/{sessions_30d.total}</span></div>
          <div className="mp-kpi-label">Sessions this month</div>
          <div className="mp-kpi-sub" style={{ color: completionColor }}>
            {sessions_30d.avg_completion_pct}% avg completion
          </div>
        </div>

        <div className="mp-kpi" onClick={() => onTabChange("checkins")}>
          <div className="mp-kpi-icon">🧠</div>
          {readiness.latest_score != null ? (
            <>
              <div className="mp-kpi-val" style={{ color: READINESS_COLOR(readiness.category) }}>
                {readiness.latest_score}
                <span className="mp-kpi-unit">/100</span>
              </div>
              <div className="mp-kpi-label">Readiness score</div>
              <div className="mp-kpi-sub" style={{ color: READINESS_COLOR(readiness.category) }}>
                {readiness.category}
              </div>
            </>
          ) : (
            <>
              <div className="mp-kpi-val mp-kpi-empty">—</div>
              <div className="mp-kpi-label">Readiness</div>
              <div className="mp-kpi-sub">No recent score</div>
            </>
          )}
        </div>

        <div className="mp-kpi" onClick={() => onTabChange("milestones")}>
          <div className="mp-kpi-icon">🏆</div>
          <div className="mp-kpi-val">{milestones_earned}</div>
          <div className="mp-kpi-label">Badges earned</div>
          <div className="mp-kpi-sub">Tap to view →</div>
        </div>

        <div className="mp-kpi" onClick={() => onTabChange("progress")}>
          <div className="mp-kpi-icon">⚖️</div>
          {latest_weight ? (
            <>
              <div className="mp-kpi-val">{latest_weight}<span className="mp-kpi-unit"> kg</span></div>
              <div className="mp-kpi-label">Latest weight</div>
              <div className="mp-kpi-sub">Tap to see trend →</div>
            </>
          ) : (
            <>
              <div className="mp-kpi-val mp-kpi-empty">—</div>
              <div className="mp-kpi-label">Weight</div>
              <div className="mp-kpi-sub">No entries yet</div>
            </>
          )}
        </div>
      </div>

      {/* Latest check-in */}
      {latest_checkin?.date && (
        <div className="mp-card" onClick={() => onTabChange("checkins")} style={{ cursor: "pointer" }}>
          <div className="mp-card-header">
            <span className="mp-card-title">Latest Check-in</span>
            <span className="mp-card-date">{new Date(latest_checkin.date).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "short" })}</span>
          </div>
          <div className="mp-checkin-row">
            {[
              ["Energy",  latest_checkin.energy_level],
              ["Stress",  latest_checkin.stress_level],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label} className="mp-checkin-chip">
                <span className="mp-chip-label">{label}</span>
                <span className="mp-chip-val">{val}</span>
              </div>
            ))}
          </div>
          <span className="mp-card-link">View all check-ins →</span>
        </div>
      )}

      {/* Quick links */}
      <div className="mp-quick-links">
        {[
          { tab: "plans",      icon: "📋", label: "View My Plan" },
          { tab: "progress",   icon: "📈", label: "Track Progress" },
          { tab: "sessions",   icon: "🏋️", label: "Session History" },
          { tab: "milestones", icon: "🏆", label: "My Badges" },
        ].map(({ tab, icon, label }) => (
          <button key={tab} className="mp-quick-btn" onClick={() => onTabChange(tab)}>
            <span>{icon}</span> {label}
          </button>
        ))}
      </div>
    </div>
  );
}
