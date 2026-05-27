// ── Readiness & Check-Ins tab (member profile) — Phase 3.1 ───────────
import { useState, useEffect, useCallback } from "react";
import { request } from "../../utils/api.js";

const READINESS_COLOR = { Green: "lime", Yellow: "gold", Orange: "warn", Red: "danger" };
const RECOVERY_COLOR  = {
  "Excellent Recovery": "lime",
  "Good Recovery":      "cyan",
  "Moderate Recovery":  "gold",
  "Poor Recovery":      "warn",
  "Recovery Risk":      "danger",
};
const PRIORITY_COLOR  = { Urgent: "danger", High: "warn", Medium: "cyan", Low: "purple" };
const RISK_COLOR      = { Critical: "danger", High: "warn", Medium: "cyan", Low: "purple" };

// ── Score ring display ────────────────────────────────────────────────
function ScoreRing({ score, category, label, colorMap }) {
  const color  = colorMap[category] || "cyan";
  const pct    = Math.min(100, Math.max(0, score ?? 0));
  // Use a simple number badge instead of an SVG ring to keep it simple
  return (
    <div className={`readiness-ring-card border-${color}`}>
      <div className={`readiness-ring-score text-${color}`}>{score != null ? Math.round(score) : "—"}</div>
      <div className={`flag-chip ${color}`}>{category || "—"}</div>
      <div className="readiness-ring-label muted text-xs">{label}</div>
      <div className="readiness-ring-bar-track">
        <div className={`readiness-ring-bar-fill bg-${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Check-in timeline row ─────────────────────────────────────────────
function CheckInRow({ ci }) {
  const painColor = ci.pain_level >= 6 ? "danger" : ci.pain_level >= 3 ? "warn" : "lime";
  return (
    <div className="ci-history-row">
      <span className="ci-history-date muted text-xs">{ci.check_in_date}</span>
      <div className="ci-history-chips">
        {ci.energy_level    && <span className="flag-chip">{ci.energy_level}</span>}
        {ci.sleep_hours     && <span className="flag-chip">{ci.sleep_hours}h sleep</span>}
        {ci.stress_level    && <span className="flag-chip">{ci.stress_level} stress</span>}
        {ci.muscle_soreness && ci.muscle_soreness !== "None" && <span className="flag-chip">{ci.muscle_soreness}</span>}
        {ci.pain_level > 0  && <span className={`flag-chip ${painColor}`}>Pain {ci.pain_level}</span>}
        {ci.new_injury_reported === "Yes" && <span className="flag-chip danger">New injury</span>}
        {ci.workout_readiness && (
          <span className={`flag-chip ${ci.workout_readiness === "Not Ready" ? "danger" : ci.workout_readiness === "Light Session Only" ? "warn" : "lime"}`}>
            {ci.workout_readiness}
          </span>
        )}
      </div>
      {ci.member_notes && (
        <p className="ci-history-notes muted text-xs">"{ci.member_notes}"</p>
      )}
    </div>
  );
}

// ── Score history mini table ──────────────────────────────────────────
function ScoreHistoryTable({ history, colorMap }) {
  if (!history.length) return <p className="muted text-sm">No score history yet.</p>;
  return (
    <div className="ci-score-history">
      {history.slice(-14).reverse().map(r => (
        <div className="ci-score-row" key={r.id}>
          <span className="muted text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</span>
          <span className={`ci-score-val text-${colorMap[r.category] || "cyan"}`}>{Math.round(r.score)}</span>
          <span className={`flag-chip ${colorMap[r.category] || "cyan"}`} style={{ fontSize: 10 }}>{r.category}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main ReadinessTab ─────────────────────────────────────────────────
export function ReadinessTab({ member, token }) {
  const [latest,    setLatest]    = useState(null);
  const [history,   setHistory]   = useState({ readiness_history: [], recovery_history: [] });
  const [checkIns,  setCheckIns]  = useState([]);
  const [painFlags, setPainFlags] = useState([]);
  const [tasks,     setTasks]     = useState([]);

  const load = useCallback(async () => {
    if (!token || !member?.id) return;
    try {
      const [lat, hist, cis, flags, tasks] = await Promise.allSettled([
        request(`/api/readiness/latest/${member.id}`, token),
        request(`/api/readiness/history/${member.id}?days=30`, token),
        request(`/api/check-ins/?member_id=${member.id}&limit=14`, token),
        request(`/api/pain-flags/?member_id=${member.id}&status=Open`, token),
        request(`/api/coach-tasks/?member_id=${member.id}&status=Open`, token),
      ]);
      if (lat.status === "fulfilled")   setLatest(lat.value);
      if (hist.status === "fulfilled")  setHistory(hist.value);
      if (cis.status === "fulfilled")   setCheckIns(cis.value);
      if (flags.status === "fulfilled") setPainFlags(flags.value);
      if (tasks.status === "fulfilled") setTasks(tasks.value);
    } catch { /* silent */ }
  }, [token, member?.id]);

  useEffect(() => { load(); }, [load]);

  const readiness = latest?.readiness;
  const recovery  = latest?.recovery;

  return (
    <div className="animate-in" style={{ display: "grid", gap: 20 }}>

      {/* Disclaimer */}
      <div className="form-note info wide" style={{ marginBottom: 0 }}>
        ℹ Readiness scores are guidance tools only. They do not replace professional medical advice
        or coach judgement.
      </div>

      {/* Latest scores */}
      <div className="intel-section">
        <h4>Latest Scores</h4>
        {!readiness && !recovery
          ? <p className="muted text-sm">No check-ins submitted yet. Submit a daily check-in to generate scores.</p>
          : (
            <div className="readiness-scores-row">
              {readiness && (
                <ScoreRing score={readiness.score} category={readiness.category}
                  label="Readiness" colorMap={READINESS_COLOR} />
              )}
              {recovery && (
                <ScoreRing score={recovery.score} category={recovery.category}
                  label="Recovery" colorMap={RECOVERY_COLOR} />
              )}
            </div>
          )
        }
        {readiness?.recommendation_summary && (
          <div className="disc-callout" style={{ marginTop: 12 }}>
            {readiness.recommendation_summary}
          </div>
        )}
      </div>

      {/* Score history */}
      <div className="intel-section">
        <h4>30-Day Readiness History</h4>
        <ScoreHistoryTable history={history.readiness_history} colorMap={READINESS_COLOR} />
      </div>

      <div className="intel-section">
        <h4>30-Day Recovery History</h4>
        <ScoreHistoryTable history={history.recovery_history} colorMap={RECOVERY_COLOR} />
      </div>

      {/* Recent check-ins */}
      <div className="intel-section">
        <h4>Recent Daily Check-Ins ({checkIns.length})</h4>
        {checkIns.length === 0
          ? <p className="muted text-sm">No check-ins yet.</p>
          : checkIns.map(ci => <CheckInRow key={ci.id} ci={ci} />)
        }
      </div>

      {/* Open pain flags */}
      {painFlags.length > 0 && (
        <div className="intel-section">
          <h4>⚠ Open Pain Flags ({painFlags.length})</h4>
          {painFlags.map(f => (
            <div className="ci-task-row" key={f.id} style={{ cursor: "default", marginBottom: 8 }}>
              <span className={`flag-chip ${RISK_COLOR[f.risk_level]}`}>{f.risk_level}</span>
              <div className="ci-task-body">
                <div className="ci-task-title" style={{ fontSize: 13 }}>{f.flag_message}</div>
                <div className="muted text-xs">
                  {f.pain_location && `${f.pain_location} · `}
                  {f.pain_score != null && `Pain ${f.pain_score}/10 · `}
                  {f.created_at ? new Date(f.created_at).toLocaleDateString() : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Open coach tasks */}
      {tasks.length > 0 && (
        <div className="intel-section">
          <h4>📋 Open Coach Tasks ({tasks.length})</h4>
          {tasks.map(t => (
            <div className="ci-task-row" key={t.id} style={{ cursor: "default", marginBottom: 8 }}>
              <span className={`flag-chip ${PRIORITY_COLOR[t.priority]}`}>{t.priority}</span>
              <div className="ci-task-body">
                <div className="ci-task-title" style={{ fontSize: 13 }}>{t.title}</div>
                <div className="muted text-xs">
                  {t.task_type}
                  {t.due_date && ` · Due ${t.due_date}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
