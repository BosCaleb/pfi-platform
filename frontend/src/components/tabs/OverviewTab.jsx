// ── Overview tab ─────────────────────────────────────────────────────
import { scoreColor } from "../../utils/helpers.js";

export function OverviewTab({ member, computed, onEdit }) {
  const scores = [
    { label: "Recovery",   value: computed.recovery_score,         color: scoreColor(computed.recovery_score) },
    { label: "Strength",   value: computed.strength_index,         color: scoreColor(computed.strength_index) },
    { label: "Cardio",     value: computed.cardiovascular_score,   color: scoreColor(computed.cardiovascular_score) },
    { label: "Mobility",   value: computed.mobility_rating,        color: scoreColor(computed.mobility_rating) },
    { label: "Compliance", value: computed.compliance_probability, color: scoreColor(computed.compliance_probability) },
    {
      label: "Inj. Risk",
      value: computed.injury_risk_score,
      color: computed.injury_risk_score > 50 ? "danger" : scoreColor(computed.injury_risk_score),
    },
  ];

  return (
    <>
      <div className="intel-section">
        <h4>Key Metrics</h4>
        <div className="detail-grid">
          <div className="detail-metric">
            <span>Primary Goal</span>
            <strong style={{ fontSize: "14px" }}>{member.primary_goal || "—"}</strong>
          </div>
          <div className="detail-metric">
            <span>BMI</span>
            <strong>{member.physical_metrics?.bmi != null ? Number(member.physical_metrics.bmi).toFixed(2) : "—"}</strong>
          </div>
          <div className="detail-metric">
            <span>Fitness Age</span>
            <strong>{computed.fitness_age || "—"}</strong>
          </div>
          <div className="detail-metric">
            <span>Segment</span>
            <strong style={{ fontSize: "13px" }}>{computed.member_segment || "—"}</strong>
          </div>
          <div className="detail-metric">
            <span>Progress Logs</span>
            <strong>{(member.progress_entries || []).length}</strong>
          </div>
          <div className="detail-metric">
            <span>Assessments</span>
            <strong>{(member.assessments || []).length}</strong>
          </div>
        </div>
      </div>

      <div className="intel-section">
        <h4>Intelligence Scores</h4>
        <div className="profile-scores">
          {scores.map(({ label, value, color }) => (
            <div className="profile-score-row" key={label}>
              <span className="profile-score-label">{label}</span>
              <div className="profile-score-track">
                <div
                  className={`profile-score-fill score-fill ${color}`}
                  style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }}
                />
              </div>
              <span className="profile-score-val">
                {value != null ? `${value}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {(member.goals?.coach_notes || member.health_profile?.notes) && (
        <div className="intel-section">
          <h4>Coach Notes</h4>
          <p className="muted text-sm" style={{ lineHeight: "1.6" }}>
            {member.goals?.coach_notes || member.health_profile?.notes}
          </p>
        </div>
      )}

      <button
        className="secondary"
        type="button"
        onClick={() => onEdit(member.id)}
        style={{ width: "100%" }}
      >
        ✏ Edit Profile
      </button>
    </>
  );
}
