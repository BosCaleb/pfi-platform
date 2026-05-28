import { useState, useEffect } from "react";
import { apiFetch } from "../api";

const RISK_COLORS = {
  Low:      "var(--lime)",
  Medium:   "var(--warn)",
  High:     "#f97316",
  Critical: "var(--danger)",
};

const RISK_ORDER = ["Critical", "High", "Medium", "Low"];

export default function RetentionDashboard({ token }) {
  const [dashboard, setDashboard] = useState(null);
  const [scores,    setScores]    = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [scoring,   setScoring]   = useState(false);
  const [filter,    setFilter]    = useState("all");
  const [error,     setError]     = useState("");

  const hdr = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const [dash, sc] = await Promise.all([
        apiFetch("/api/retention/dashboard", { headers: hdr }),
        apiFetch("/api/retention/scores",    { headers: hdr }),
      ]);
      setDashboard(dash);
      setScores(sc);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const scoreAll = async () => {
    setScoring(true); setError("");
    try {
      const res = await apiFetch("/api/retention/score-all", { method: "POST", headers: hdr });
      alert(`Scored ${res.scored} members. ${res.tasks_created} new coach tasks created.`);
      load();
    } catch (e) { setError(e.message); }
    setScoring(false);
  };

  const scoreMember = async (memberId) => {
    try {
      const res = await apiFetch(`/api/retention/score/${memberId}`, { method: "POST", headers: hdr });
      setScores(prev => {
        const exists = prev.find(s => s.member_id === memberId);
        return exists ? prev.map(s => s.member_id === memberId ? res : s) : [res, ...prev];
      });
    } catch (e) { setError(e.message); }
  };

  const filtered = filter === "all"
    ? scores
    : scores.filter(s => s.risk_category === filter);

  const sorted = [...filtered].sort((a, b) => b.score - a.score);

  return (
    <div className="retention-wrap">
      <div className="ai-coach-header">
        <h2 className="section-title">💡 Retention & Churn Risk</h2>
        <p className="section-sub">Composite churn risk scoring across attendance, billing, check-ins and engagement.</p>
        <button className="btn-primary" onClick={scoreAll} disabled={scoring}>
          {scoring ? "Scoring all members…" : "⚡ Score All Members"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="loading-pulse">Loading…</div>}

      {dashboard && (
        <div className="retention-kpi-row">
          <KpiCard label="Total Scored" value={dashboard.total_scored} color="var(--cyan)" />
          <KpiCard label="Low Risk"      value={dashboard.distribution?.Low      || 0} color="var(--lime)" />
          <KpiCard label="Medium Risk"   value={dashboard.distribution?.Medium   || 0} color="var(--warn)" />
          <KpiCard label="High Risk"     value={dashboard.distribution?.High     || 0} color="#f97316" />
          <KpiCard label="Critical"      value={dashboard.distribution?.Critical || 0} color="var(--danger)" />
        </div>
      )}

      {dashboard?.high_risk_members?.length > 0 && (
        <div className="panel retention-alert-panel">
          <h3 className="panel-title" style={{ color: "var(--danger)" }}>🚨 High / Critical Risk Members</h3>
          <table className="data-table">
            <thead><tr>
              <th>Member</th><th>Score</th><th>Risk</th><th>Last Session</th><th>Action</th>
            </tr></thead>
            <tbody>
              {dashboard.high_risk_members.map(m => (
                <tr key={m.member_id}>
                  <td>{m.member_name}</td>
                  <td>
                    <div className="score-bar-wrap">
                      <div className="score-bar" style={{ width: `${m.score}%`, background: RISK_COLORS[m.risk_category] }} />
                      <span>{m.score}</span>
                    </div>
                  </td>
                  <td>
                    <span className="risk-chip" style={{ color: RISK_COLORS[m.risk_category], borderColor: RISK_COLORS[m.risk_category] + "44" }}>
                      {m.risk_category}
                    </span>
                  </td>
                  <td>{m.last_session_date ? new Date(m.last_session_date).toLocaleDateString() : "—"}</td>
                  <td>
                    <button className="btn-sm btn-ghost" onClick={() => scoreMember(m.member_id)}>
                      🔄 Re-score
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">All Member Scores</h3>
          <div className="filter-bar">
            {["all", ...RISK_ORDER].map(f => (
              <button key={f} className={`filter-chip ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)} style={f !== "all" ? { "--fc": RISK_COLORS[f] } : {}}>
                {f === "all" ? "All" : f}
              </button>
            ))}
          </div>
        </div>
        <table className="data-table">
          <thead><tr>
            <th>Member</th><th>Risk Score (0–100)</th><th>Category</th><th>Coach Task</th><th>Scored</th><th>Re-score</th>
          </tr></thead>
          <tbody>
            {sorted.map(s => (
              <tr key={s.id}>
                <td>{s.member_name}</td>
                <td>
                  <div className="score-bar-wrap">
                    <div className="score-bar" style={{ width: `${s.score}%`, background: RISK_COLORS[s.risk_category] }} />
                    <span className="score-num">{s.score}</span>
                  </div>
                </td>
                <td>
                  <span className="risk-chip" style={{ color: RISK_COLORS[s.risk_category], borderColor: RISK_COLORS[s.risk_category] + "44" }}>
                    {s.risk_category}
                  </span>
                </td>
                <td>{s.coach_task_created ? "✅ Created" : "—"}</td>
                <td>{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</td>
                <td>
                  <button className="btn-sm btn-ghost" onClick={() => scoreMember(s.member_id)}>🔄</button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && !loading && (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>
                No scores yet. Click "Score All Members" to begin.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }) {
  return (
    <div className="kpi-card" style={{ "--kc": color }}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-bar" />
    </div>
  );
}
