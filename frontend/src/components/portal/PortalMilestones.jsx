import { useState, useEffect } from "react";

const TYPE_ICON = {
  "Sessions Completed":   "🏋️",
  "Attendance Streak":    "🔥",
  "First Reassessment":   "📊",
  "Strength Milestone":   "💪",
  "Recovery Consistency": "🧘",
  "Nutrition Consistency":"🥗",
  "Goal Progress":        "🎯",
};

export default function PortalMilestones({ token }) {
  const [milestones, setMilestones] = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    fetch("/api/member/milestones", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setMilestones(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="mp-page"><div className="mp-loading">Loading…</div></div>;

  return (
    <div className="mp-page">
      <h2 className="mp-page-title">🏆 My Milestones</h2>

      {milestones.length > 0 ? (
        <>
          <div className="mp-milestone-count">
            You've earned <strong>{milestones.length}</strong> badge{milestones.length !== 1 ? "s" : ""}. Keep it up! 💪
          </div>
          <div className="mp-milestone-grid">
            {milestones.map(m => (
              <div key={m.id} className="mp-badge-card">
                <div className="mp-badge-icon-wrap">
                  <span className="mp-badge-icon">{TYPE_ICON[m.type] || "🏆"}</span>
                </div>
                <div className="mp-badge-title">{m.title}</div>
                {m.description && <div className="mp-badge-desc">{m.description}</div>}
                {m.related_metric && (
                  <div className="mp-badge-metric">{m.related_metric}</div>
                )}
                <div className="mp-badge-date">
                  {m.achieved_at
                    ? new Date(m.achieved_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
                    : ""}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mp-card mp-empty-milestones">
          <div className="mp-empty-icon">🎯</div>
          <h3>No badges yet</h3>
          <p>Keep showing up! Your first badge will appear here once you hit your first milestone.</p>
        </div>
      )}
    </div>
  );
}
