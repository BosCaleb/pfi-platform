import { useState, useEffect } from "react";

export default function PortalProgress({ token }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/member/progress", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="mp-page"><div className="mp-loading">Loading…</div></div>;

  const entries    = data?.progress_entries || [];
  const assessments = data?.assessments || [];

  // Calculate weight change
  const weights = entries.filter(e => e.weight).map(e => e.weight);
  const weightDelta = weights.length >= 2
    ? Math.round((weights[0] - weights[weights.length - 1]) * 10) / 10
    : null;

  return (
    <div className="mp-page">
      <h2 className="mp-page-title">📈 My Progress</h2>

      {/* Weight summary */}
      {weights.length > 0 && (
        <div className="mp-card">
          <div className="mp-card-header">
            <span className="mp-card-title">Weight Trend</span>
            {weightDelta !== null && (
              <span className="mp-delta-chip" style={{ color: weightDelta < 0 ? "#22c55e" : "#f59e0b" }}>
                {weightDelta < 0 ? "▼" : "▲"} {Math.abs(weightDelta)} kg
              </span>
            )}
          </div>

          {/* Sparkline */}
          <div className="mp-sparkline">
            {[...weights].reverse().map((w, i) => {
              const min = Math.min(...weights), max = Math.max(...weights);
              const range = max - min || 1;
              const h = Math.round(((w - min) / range) * 60) + 10;
              return (
                <div key={i} className="mp-spark-bar-wrap">
                  <div className="mp-spark-bar" style={{ height: h }} />
                  {i === 0 && <div className="mp-spark-label">{w}kg</div>}
                  {i === weights.length - 1 && <div className="mp-spark-label">{w}kg</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress entries table */}
      <div className="mp-card">
        <div className="mp-card-header">
          <span className="mp-card-title">Progress Entries</span>
          <span className="mp-card-date">{entries.length} records</span>
        </div>
        {entries.length > 0 ? (
          <div className="mp-progress-list">
            {entries.map((e, i) => (
              <div key={i} className="mp-progress-row">
                <div className="mp-progress-date">
                  {e.date ? new Date(e.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </div>
                <div className="mp-progress-metrics">
                  {e.weight     && <span className="mp-metric-chip">⚖️ {e.weight} kg</span>}
                  {e.body_fat_pct && <span className="mp-metric-chip">📊 {e.body_fat_pct}% BF</span>}
                  {e.waist_cm   && <span className="mp-metric-chip">📏 {e.waist_cm} cm</span>}
                  {e.adherence_score && (
                    <span className="mp-metric-chip" style={{ color: "#22c55e" }}>
                      ✅ {e.adherence_score}% adherence
                    </span>
                  )}
                </div>
                {e.notes && <div className="mp-progress-notes">{e.notes}</div>}
              </div>
            ))}
          </div>
        ) : (
          <p className="mp-empty">No progress entries yet. Your coach will log these after sessions.</p>
        )}
      </div>

      {/* Assessments */}
      <div className="mp-card">
        <div className="mp-card-header">
          <span className="mp-card-title">Fitness Assessments</span>
          <span className="mp-card-date">{assessments.length} completed</span>
        </div>
        {assessments.length > 0 ? (
          <div className="mp-progress-list">
            {assessments.map((a, i) => (
              <div key={i} className="mp-progress-row">
                <div className="mp-progress-date">
                  {a.date ? new Date(a.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  {a.type && <span className="mp-assess-type"> · {a.type}</span>}
                </div>
                <div className="mp-progress-metrics">
                  {a.pushups  && <span className="mp-metric-chip">💪 {a.pushups} push-ups</span>}
                  {a.squats   && <span className="mp-metric-chip">🦵 {a.squats} squats</span>}
                  {a.plank_seconds && <span className="mp-metric-chip">⏱ {a.plank_seconds}s plank</span>}
                </div>
                {a.overall_notes && <div className="mp-progress-notes">{a.overall_notes}</div>}
              </div>
            ))}
          </div>
        ) : (
          <p className="mp-empty">No assessments recorded yet.</p>
        )}
      </div>
    </div>
  );
}
