// ── Progress tab ──────────────────────────────────────────────────────
import { useMemo }      from "react";
import { TrendChart }   from "../ui/TrendChart.jsx";

export function ProgressTab({ member, onDeleteAssessment, onDeleteProgress }) {
  const progress = useMemo(
    () => [...(member.progress_entries || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [member],
  );
  const assessments = useMemo(
    () => [...(member.assessments || [])].sort((a, b) => String(a.assessment_date).localeCompare(String(b.assessment_date))),
    [member],
  );

  return (
    <>
      {/* Trend chart */}
      <div className="intel-section">
        <TrendChart entries={progress} />
      </div>

      {/* Assessment history */}
      <div className="intel-section">
        <h4>Assessment History ({assessments.length})</h4>
        {assessments.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">📊</span>
            No assessments recorded.
          </div>
        ) : (
          <div className="history-list">
            {[...assessments].reverse().map(a => (
              <div className="history-row" key={a.id}>
                <div>
                  <div className="history-row-date">{a.assessment_date}</div>
                  <div className="history-row-chips">
                    {a.pushups      != null && <span className="history-chip highlight">{a.pushups} pushups</span>}
                    {a.squats       != null && <span className="history-chip highlight">{a.squats} squats</span>}
                    {a.plank_seconds != null && <span className="history-chip highlight">{a.plank_seconds}s plank</span>}
                    {a.cardio_result          && <span className="history-chip">Cardio {a.cardio_result}</span>}
                    {a.mobility_score         && <span className="history-chip">Mobility {a.mobility_score}</span>}
                    {a.balance_score          && <span className="history-chip">Balance {a.balance_score}</span>}
                  </div>
                  {a.overall_notes && <div className="history-row-note">{a.overall_notes}</div>}
                </div>
                <button
                  className="delete-btn"
                  type="button"
                  title="Delete assessment"
                  onClick={() => onDeleteAssessment(a.id, member.id)}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress entries */}
      <div className="intel-section">
        <h4>Progress Entries ({progress.length})</h4>
        {progress.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">📈</span>
            No progress entries yet.
          </div>
        ) : (
          <div className="history-list">
            {[...progress].reverse().map(e => (
              <div className="history-row" key={e.id}>
                <div>
                  <div className="history-row-date">{e.date}</div>
                  <div className="history-row-chips">
                    {e.weight              != null && <span className="history-chip highlight">{e.weight} kg</span>}
                    {e.waist_measurement   != null && <span className="history-chip">{e.waist_measurement} cm waist</span>}
                    {e.body_fat_percentage != null && <span className="history-chip">{e.body_fat_percentage}% BF</span>}
                    {e.adherence_score     != null && <span className="history-chip">{e.adherence_score}% adherence</span>}
                  </div>
                  {e.progress_note && <div className="history-row-note">{e.progress_note}</div>}
                  {e.coach_note    && (
                    <div className="history-row-note" style={{ color: "var(--cyan)", marginTop: "4px" }}>
                      Coach: {e.coach_note}
                    </div>
                  )}
                </div>
                <button
                  className="delete-btn"
                  type="button"
                  title="Delete entry"
                  onClick={() => onDeleteProgress(e.id, member.id)}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
