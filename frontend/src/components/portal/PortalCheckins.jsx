import { useState, useEffect } from "react";

const LEVEL_COLOR = {
  "High": "#22c55e", "Medium-High": "#84cc16", "Medium": "#f59e0b",
  "Low-Medium": "#f97316", "Low": "#ef4444",
  "Very High": "#22c55e", "Good": "#22c55e", "Fair": "#f59e0b", "Poor": "#ef4444",
};

export default function PortalCheckins({ token }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("daily");

  useEffect(() => {
    fetch("/api/member/check-ins", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="mp-page"><div className="mp-loading">Loading…</div></div>;

  const daily    = data?.daily    || [];
  const weekly   = data?.weekly   || [];
  const readiness = data?.readiness || [];

  return (
    <div className="mp-page">
      <h2 className="mp-page-title">✅ Check-ins</h2>

      <div className="mp-tab-pills">
        {[["daily","Daily"], ["weekly","Weekly"], ["readiness","Readiness"]].map(([id, label]) => (
          <button key={id} className={`mp-pill ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "daily" && (
        <div>
          {daily.length > 0 ? daily.map((c, i) => (
            <div key={i} className="mp-card mp-checkin-card">
              <div className="mp-card-header">
                <span className="mp-card-title">
                  {c.date ? new Date(c.date).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "short" }) : "—"}
                </span>
              </div>
              <div className="mp-checkin-metrics">
                {[
                  ["Energy",     c.energy_level],
                  ["Sleep",      c.sleep_quality],
                  ["Stress",     c.stress_level],
                  ["Soreness",   c.soreness_level],
                  ["Motivation", c.motivation_level],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} className="mp-cm-item">
                    <span className="mp-cm-label">{label}</span>
                    <span className="mp-cm-val" style={{ color: LEVEL_COLOR[val] || "#94a3b8" }}>{val}</span>
                  </div>
                ))}
              </div>
              {c.notes && <div className="mp-checkin-notes">"{c.notes}"</div>}
            </div>
          )) : <p className="mp-empty">No daily check-ins yet.</p>}
        </div>
      )}

      {tab === "weekly" && (
        <div>
          {weekly.length > 0 ? weekly.map((w, i) => (
            <div key={i} className="mp-card mp-checkin-card">
              <div className="mp-card-header">
                <span className="mp-card-title">
                  Week of {w.week_start ? new Date(w.week_start).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : "—"}
                </span>
                {w.sessions_planned && (
                  <span className="mp-card-date">
                    {w.sessions_completed}/{w.sessions_planned} sessions
                  </span>
                )}
              </div>
              {w.overall_feeling && (
                <div className="mp-weekly-feeling">Overall: <strong>{w.overall_feeling}</strong></div>
              )}
              {w.wins && (
                <div className="mp-weekly-section">
                  <span className="mp-weekly-label">🏆 Wins</span>
                  <p>{w.wins}</p>
                </div>
              )}
              {w.challenges && (
                <div className="mp-weekly-section">
                  <span className="mp-weekly-label">⚠ Challenges</span>
                  <p>{w.challenges}</p>
                </div>
              )}
              {w.goals_next_week && (
                <div className="mp-weekly-section">
                  <span className="mp-weekly-label">🎯 Next week</span>
                  <p>{w.goals_next_week}</p>
                </div>
              )}
            </div>
          )) : <p className="mp-empty">No weekly check-ins yet.</p>}
        </div>
      )}

      {tab === "readiness" && (
        <div>
          {readiness.length > 0 ? readiness.map((r, i) => {
            const color = r.score >= 80 ? "#22c55e" : r.score >= 60 ? "#84cc16"
              : r.score >= 40 ? "#f59e0b" : r.score >= 20 ? "#f97316" : "#ef4444";
            return (
              <div key={i} className="mp-card mp-readiness-card">
                <div className="mp-readiness-score" style={{ color }}>
                  {r.score}<span className="mp-readiness-denom">/100</span>
                </div>
                <div className="mp-readiness-right">
                  <div className="mp-readiness-cat" style={{ color }}>{r.category}</div>
                  <div className="mp-readiness-date">
                    {r.date ? new Date(r.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : ""}
                  </div>
                  {r.recommendation && (
                    <div className="mp-readiness-rec">{r.recommendation}</div>
                  )}
                </div>
              </div>
            );
          }) : <p className="mp-empty">No readiness scores yet.</p>}
        </div>
      )}
    </div>
  );
}
