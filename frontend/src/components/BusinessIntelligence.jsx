import { useState, useEffect } from "react";
import { apiFetch } from "../api";

export default function BusinessIntelligence({ token }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const hdr = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    setLoading(true);
    apiFetch("/api/bi/dashboard", { headers: hdr })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <div className="loading-pulse">Loading BI Dashboard…</div>;
  if (error)   return <div className="error-banner">{error}</div>;
  if (!data)   return null;

  const { revenue, membership, attendance, workout_adherence, readiness, retention, coach_tasks, workout_groups, top_members } = data;
  const revTrend = revenue.trend_pct >= 0 ? `▲ ${revenue.trend_pct}%` : `▼ ${Math.abs(revenue.trend_pct)}%`;
  const revColor = revenue.trend_pct >= 0 ? "var(--lime)" : "var(--danger)";

  return (
    <div className="bi-wrap">
      <div className="ai-coach-header">
        <h2 className="section-title">📊 Business Intelligence</h2>
        <p className="section-sub">As of {data.as_of} — live KPIs across revenue, membership, coaching and retention.</p>
      </div>

      {/* Revenue Row */}
      <div className="bi-section-label">💰 Revenue</div>
      <div className="kpi-row">
        <KpiCard label="This Month" value={`R ${revenue.this_month.toLocaleString()}`} color="var(--lime)" />
        <KpiCard label="Last Month"  value={`R ${revenue.prev_month.toLocaleString()}`}  color="var(--cyan)" />
        <KpiCard label="MoM Change"  value={revTrend} color={revColor} />
        <KpiCard label="Outstanding" value={`R ${revenue.outstanding.toLocaleString()}`} color="var(--warn)" />
        <KpiCard label="Overdue Invoices" value={revenue.overdue_invoices} color={revenue.overdue_invoices > 0 ? "var(--danger)" : "var(--lime)"} />
      </div>

      {revenue.monthly_trend?.length > 0 && (
        <div className="panel bi-trend-panel">
          <h3 className="panel-title">Revenue Trend — Last 6 Months</h3>
          <MiniBarChart data={revenue.monthly_trend} valueKey="revenue" labelKey="month" color="var(--lime)" prefix="R " />
        </div>
      )}

      {/* Membership Row */}
      <div className="bi-section-label">👥 Membership</div>
      <div className="kpi-row">
        <KpiCard label="Total Members"  value={membership.total}         color="var(--cyan)" />
        <KpiCard label="Active"         value={membership.active}        color="var(--lime)" />
        <KpiCard label="Paused"         value={membership.paused}        color="var(--warn)" />
        <KpiCard label="Cancelled"      value={membership.cancelled}     color="var(--danger)" />
        <KpiCard label="New This Month" value={membership.new_this_month} color="var(--purple)" />
      </div>

      {/* Attendance + Adherence */}
      <div className="bi-section-label">🏃 Attendance & Adherence (30 days)</div>
      <div className="kpi-row">
        <KpiCard label="Attendance Rate"   value={`${attendance.rate_30d}%`}        color="var(--cyan)" />
        <KpiCard label="No-Show Rate"      value={`${attendance.no_show_rate_30d}%`} color={attendance.no_show_rate_30d > 25 ? "var(--danger)" : "var(--warn)"} />
        <KpiCard label="Sessions Logged"   value={workout_adherence.sessions_logged_30d} color="var(--purple)" />
        <KpiCard label="Avg Completion"    value={`${workout_adherence.avg_completion_30d}%`} color={workout_adherence.avg_completion_30d >= 75 ? "var(--lime)" : "var(--warn)"} />
        <KpiCard label="Avg Readiness"     value={readiness.avg_score_30d || "—"} color="var(--cyan)" />
      </div>

      {attendance.trend?.length > 0 && (
        <div className="panel bi-trend-panel">
          <h3 className="panel-title">Attendance Trend — Last 6 Weeks</h3>
          <MiniBarChart data={attendance.trend} valueKey="attended" labelKey="week" color="var(--cyan)" />
        </div>
      )}

      {/* Retention + Coach Tasks */}
      <div className="bi-two-col">
        <div className="panel">
          <h3 className="panel-title">⚠ Retention Risk</h3>
          <div className="kpi-row tight">
            <KpiCard label="High Risk" value={retention.high_risk_count} color={retention.high_risk_count > 0 ? "var(--danger)" : "var(--lime)"} />
            <KpiCard label="Scored"    value={retention.scored_members}   color="var(--cyan)" />
          </div>
          {retention.distribution && (
            <div className="dist-bars">
              {Object.entries(retention.distribution).map(([cat, count]) => (
                <DistBar key={cat} label={cat} count={count} total={retention.scored_members || 1}
                  color={{ Low:"var(--lime)", Medium:"var(--warn)", High:"#f97316", Critical:"var(--danger)" }[cat]} />
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h3 className="panel-title">📋 Coach Tasks</h3>
          <div className="kpi-row tight">
            <KpiCard label="Open"         value={coach_tasks.open}         color="var(--warn)" />
            <KpiCard label="Urgent"       value={coach_tasks.urgent}       color={coach_tasks.urgent > 0 ? "var(--danger)" : "var(--lime)"} />
            <KpiCard label="Completed 30d" value={coach_tasks.completed_30d} color="var(--lime)" />
          </div>
        </div>
      </div>

      {/* Workout Groups */}
      {workout_groups?.length > 0 && (
        <div className="panel">
          <h3 className="panel-title">🏋️ Workout Group Performance (30d)</h3>
          <table className="data-table">
            <thead><tr><th>Group</th><th>Members</th><th>Sessions</th><th>Avg Completion</th></tr></thead>
            <tbody>
              {workout_groups.map(g => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>{g.members}</td>
                  <td>{g.sessions_30d}</td>
                  <td>
                    <div className="score-bar-wrap">
                      <div className="score-bar" style={{ width: `${g.avg_completion}%`, background: g.avg_completion >= 75 ? "var(--lime)" : "var(--warn)" }} />
                      <span>{g.avg_completion}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top Members */}
      {top_members?.length > 0 && (
        <div className="panel">
          <h3 className="panel-title">🏆 Top Members — Adherence (30d)</h3>
          <div className="top-members-list">
            {top_members.map((m, i) => (
              <div key={m.member_id} className="top-member-row">
                <span className="top-rank">#{i + 1}</span>
                <span className="top-name">{m.name}</span>
                <div className="score-bar-wrap" style={{ flex: 1 }}>
                  <div className="score-bar" style={{ width: `${m.adherence_score}%`, background: "var(--lime)" }} />
                  <span>{m.adherence_score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, color }) {
  return (
    <div className="kpi-card" style={{ "--kc": color }}>
      <div className="kpi-value" style={{ color }}>{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

function MiniBarChart({ data, valueKey, labelKey, color, prefix = "" }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div className="mini-bar-chart">
      {data.map((d, i) => (
        <div key={i} className="mb-col">
          <div className="mb-bar-wrap">
            <div className="mb-bar" style={{ height: `${(d[valueKey] / max) * 100}%`, background: color }} />
          </div>
          <div className="mb-val">{prefix}{typeof d[valueKey] === "number" ? d[valueKey].toLocaleString() : d[valueKey]}</div>
          <div className="mb-label">{d[labelKey]}</div>
        </div>
      ))}
    </div>
  );
}

function DistBar({ label, count, total, color }) {
  const pct = Math.round((count / total) * 100);
  return (
    <div className="dist-bar-row">
      <span className="dist-label" style={{ color }}>{label}</span>
      <div className="dist-track">
        <div className="dist-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="dist-count">{count}</span>
    </div>
  );
}
