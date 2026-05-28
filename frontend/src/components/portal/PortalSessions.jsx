import { useState, useEffect } from "react";

const STATUS_STYLE = {
  "Completed":   { color: "#22c55e", icon: "✅" },
  "Partial":     { color: "#f59e0b", icon: "⚠️" },
  "Missed":      { color: "#ef4444", icon: "❌" },
  "Skipped":     { color: "#94a3b8", icon: "⏭" },
};

export default function PortalSessions({ token }) {
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch("/api/member/sessions?limit=50", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setSessions(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="mp-page"><div className="mp-loading">Loading…</div></div>;

  const completed = sessions.filter(s => s.status === "Completed").length;
  const avgComp   = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + (s.completion_pct || 0), 0) / sessions.length)
    : 0;

  return (
    <div className="mp-page">
      <h2 className="mp-page-title">🏋️ My Sessions</h2>

      <div className="mp-stat-row">
        <div className="mp-stat-pill">
          <span className="mp-stat-val">{sessions.length}</span>
          <span className="mp-stat-lbl">Total logged</span>
        </div>
        <div className="mp-stat-pill">
          <span className="mp-stat-val" style={{ color: "#22c55e" }}>{completed}</span>
          <span className="mp-stat-lbl">Completed</span>
        </div>
        <div className="mp-stat-pill">
          <span className="mp-stat-val">{avgComp}%</span>
          <span className="mp-stat-lbl">Avg completion</span>
        </div>
      </div>

      <div className="mp-card">
        {sessions.length > 0 ? (
          <div className="mp-session-list">
            {sessions.map(s => {
              const st = STATUS_STYLE[s.status] || { color: "#94a3b8", icon: "○" };
              return (
                <div key={s.id} className="mp-session-row">
                  <div className="mp-session-left">
                    <span className="mp-session-icon">{st.icon}</span>
                    <div>
                      <div className="mp-session-date">
                        {s.date ? new Date(s.date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" }) : "—"}
                      </div>
                      <div className="mp-session-status" style={{ color: st.color }}>{s.status}</div>
                    </div>
                  </div>
                  <div className="mp-session-right">
                    {s.completion_pct != null && (
                      <div className="mp-session-bar-wrap">
                        <div className="mp-session-bar" style={{
                          width: `${s.completion_pct}%`,
                          background: s.completion_pct >= 75 ? "#22c55e" : s.completion_pct >= 50 ? "#f59e0b" : "#ef4444",
                        }} />
                        <span className="mp-session-pct">{s.completion_pct}%</span>
                      </div>
                    )}
                    {s.rpe && <span className="mp-rpe-chip">RPE {s.rpe}</span>}
                  </div>
                  {(s.coach_notes || s.member_feedback) && (
                    <div className="mp-session-notes">
                      {s.coach_notes    && <div>💬 Coach: {s.coach_notes}</div>}
                      {s.member_feedback && <div>🗣 You: {s.member_feedback}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mp-empty">No sessions logged yet. Your coach will record sessions here.</p>
        )}
      </div>
    </div>
  );
}
