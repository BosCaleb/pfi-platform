// ── ScoreBar ─────────────────────────────────────────────────────────
/** Horizontal labelled progress bar for platform-health metrics. */
export function ScoreBar({ label, value, color }) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  return (
    <div className="intel-score-row">
      <div className="intel-score-header">
        <span className="intel-score-label">{label}</span>
        <span className="intel-score-value">{pct}%</span>
      </div>
      <div className="score-track">
        <div className={`score-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
