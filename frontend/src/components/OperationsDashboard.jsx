// ── Operations Dashboard (Phase 4.1) ──────────────────────────────────
import { useEffect, useState } from "react";
import { request } from "../utils/api.js";

function KpiCard({ label, value, sub, color = "cyan" }) {
  return (
    <div className={`ci-kpi-card border-${color}`}>
      <div className="ci-kpi-value" style={{ color: `var(--${color})` }}>{value ?? "—"}</div>
      <div className="ci-kpi-label">{label}</div>
      {sub && <div className="ci-kpi-sub">{sub}</div>}
    </div>
  );
}

export function OperationsDashboard({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const d = await request("/api/operations/dashboard", token);
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="ci-empty">Loading operations data…</div>;
  if (error)   return <div className="ci-empty danger">{error}</div>;
  if (!data)   return null;

  const { members, sessions_today, this_week, billing, coach_tasks, upcoming_sessions } = data;

  return (
    <div className="p2-section">
      <div className="p2-section-header">
        <h2>⚙️ Operations Dashboard</h2>
        <button className="ghost" onClick={load}>Refresh</button>
      </div>

      {/* Members */}
      <h3 className="ops-section-title">Member Overview</h3>
      <div className="ci-kpi-row">
        <KpiCard label="Total Members" value={members.total} color="cyan" />
        <KpiCard label="Active" value={members.active} color="lime" />
        <KpiCard label="Paused" value={members.paused} color="warn" />
        <KpiCard label="Cancelled" value={members.cancelled} color="danger" />
      </div>

      {/* Today's sessions */}
      <h3 className="ops-section-title">Today's Sessions</h3>
      <div className="ci-kpi-row">
        <KpiCard label="Scheduled Today" value={sessions_today.count} color="cyan" />
        <KpiCard label="Booked Spots" value={sessions_today.booked} color="lime" />
        <KpiCard label="This Week Sessions" value={this_week.sessions} color="purple" />
        <KpiCard label="Week Attendance" value={this_week.attended} sub={`${this_week.no_shows} no-shows`} color="gold" />
      </div>

      {/* Billing */}
      <h3 className="ops-section-title">Billing</h3>
      <div className="ci-kpi-row">
        <KpiCard label="Revenue This Month" value={`R ${billing.revenue_this_month?.toLocaleString()}`} color="lime" />
        <KpiCard label="Outstanding" value={`R ${billing.outstanding_amount?.toLocaleString()}`} sub={`${billing.outstanding_invoices} invoices`} color="warn" />
        <KpiCard label="Overdue Invoices" value={billing.overdue_invoices} color="danger" />
        <KpiCard label="Members Unpaid" value={billing.members_unpaid} color="danger" />
      </div>

      {/* Coach tasks */}
      <h3 className="ops-section-title">Coach Tasks</h3>
      <div className="ci-kpi-row">
        <KpiCard label="Open Tasks" value={coach_tasks.open} color="cyan" />
        <KpiCard label="Urgent Tasks" value={coach_tasks.urgent} color="danger" />
      </div>

      {/* Upcoming sessions */}
      {upcoming_sessions?.length > 0 && (
        <>
          <h3 className="ops-section-title">Upcoming Sessions (Next 7 Days)</h3>
          <div className="ci-grid">
            {upcoming_sessions.map(s => (
              <div key={s.id} className="ci-task-row">
                <div>
                  <strong>{s.title}</strong>
                  <span className="badge-neutral" style={{ marginLeft: "0.5rem" }}>{s.type}</span>
                </div>
                <div className="text-muted">{s.session_date} {s.start_time && `at ${s.start_time}`}</div>
                <div className="text-muted">Capacity: {s.capacity}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Today's session list */}
      {sessions_today.sessions?.length > 0 && (
        <>
          <h3 className="ops-section-title">Today's Schedule</h3>
          <div className="ci-grid">
            {sessions_today.sessions.map(s => (
              <div key={s.id} className="ci-task-row">
                <strong>{s.title}</strong>
                <span className="text-muted">{s.start_time}{s.end_time && ` – ${s.end_time}`}</span>
                <span className="badge-neutral">{s.type}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
