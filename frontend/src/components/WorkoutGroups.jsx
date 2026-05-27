// ── Workout Groups ────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { request } from "../utils/api.js";
import { Badge }   from "./ui/Badge.jsx";

const GOALS  = ["Fat Loss","Strength","Endurance","Mobility","Performance","General Fitness","Rehabilitation"];
const LEVELS = ["Beginner","Intermediate","Advanced"];

const EMPTY_GROUP = {
  group_name: "", description: "",
  target_fitness_level: "Beginner", target_goal: "Fat Loss",
  schedule_days: "", max_capacity: "", location: "", notes: "",
};

const LEVEL_COLOR = { Beginner: "lime", Intermediate: "cyan", Advanced: "purple" };

export function WorkoutGroups({ token }) {
  const [groups,      setGroups]      = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [dash,        setDash]        = useState(null);
  const [members,     setMembers]     = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState(EMPTY_GROUP);
  const [msg,         setMsg]         = useState("");
  const [statusFilter, setStatus]     = useState("");

  const load = useCallback(async () => {
    const p = statusFilter ? `?status=${statusFilter}` : "";
    setGroups(await request(`/api/workout-groups/${p}`, token));
  }, [token, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function selectGroup(g) {
    setSelected(g);
    const [d, m, cp] = await Promise.all([
      request(`/api/workout-groups/${g.id}/dashboard`, token),
      request(`/api/workout-groups/${g.id}/members`,   token),
      request(`/api/workout-groups/${g.id}/current-plan`, token).catch(() => null),
    ]);
    setDash(d);
    setMembers(m);
    setCurrentPlan(cp);
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function saveGroup(e) {
    e.preventDefault();
    setMsg("Saving…");
    try {
      const payload = { ...form, max_capacity: form.max_capacity ? Number(form.max_capacity) : null };
      await request("/api/workout-groups/", token, { method: "POST", body: JSON.stringify(payload) });
      setMsg("✓ Group created.");
      setShowForm(false);
      setForm(EMPTY_GROUP);
      await load();
    } catch (err) { setMsg(err.message); }
  }

  async function archiveGroup(id) {
    if (!confirm("Archive this group? Members will remain but the group will be inactive.")) return;
    try {
      await request(`/api/workout-groups/${id}/archive`, token, { method: "PATCH" });
      setSelected(null); setDash(null); setMembers([]); setCurrentPlan(null);
      await load();
    } catch (err) { alert(err.message); }
  }

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>🏋️ Workout Groups</h2>
          <p className="muted text-sm" style={{ marginTop: 4 }}>
            {groups.length} group{groups.length !== 1 ? "s" : ""} on file
          </p>
        </div>
        <div className="section-title-right">
          {msg && <span className="message">{msg}</span>}
          <select
            style={{ minWidth: 120 }}
            value={statusFilter}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Archived">Archived</option>
          </select>
          <button type="button" onClick={() => { setShowForm(s => !s); setMsg(""); }}>
            {showForm ? "Cancel" : "+ New Group"}
          </button>
        </div>
      </div>

      {/* New group form */}
      {showForm && (
        <form className="panel" style={{ marginBottom: 20 }} onSubmit={saveGroup}>
          <h3>New Workout Group</h3>
          <div className="form-grid-2">
            <label>Group Name *
              <input required value={form.group_name} onChange={e => setF("group_name", e.target.value)} />
            </label>
            <label>Target Fitness Level
              <select value={form.target_fitness_level} onChange={e => setF("target_fitness_level", e.target.value)}>
                {LEVELS.map(v => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label>Target Goal
              <select value={form.target_goal} onChange={e => setF("target_goal", e.target.value)}>
                {GOALS.map(v => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label>Max Capacity
              <input type="number" min="1" value={form.max_capacity} placeholder="e.g. 20"
                onChange={e => setF("max_capacity", e.target.value)} />
            </label>
            <label>Schedule Days
              <input value={form.schedule_days} placeholder="e.g. Mon / Wed / Fri"
                onChange={e => setF("schedule_days", e.target.value)} />
            </label>
            <label>Location
              <input value={form.location} onChange={e => setF("location", e.target.value)} />
            </label>
          </div>
          <label style={{ marginTop: 12 }}>Description
            <textarea value={form.description} onChange={e => setF("description", e.target.value)} />
          </label>
          <div style={{ marginTop: 14 }}>
            <button type="submit">Save Group</button>
          </div>
        </form>
      )}

      {/* Two-column layout */}
      <div className="p2-two-col">
        {/* Group list */}
        <div className="p2-left-list">
          {groups.length === 0 && (
            <div className="empty-state">
              <span className="empty-state-icon">🏋️</span>
              No groups found. Create one above.
            </div>
          )}
          {groups.map(g => (
            <div
              key={g.id}
              className={`group-card ${selected?.id === g.id ? "active" : ""} ${g.status === "Archived" ? "archived" : ""}`}
              onClick={() => selectGroup(g)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === "Enter" && selectGroup(g)}
            >
              <div className="group-card-header">
                <span className="group-card-name">{g.group_name}</span>
                <span className={`badge ${LEVEL_COLOR[g.target_fitness_level] || "cyan"}`}>
                  {g.target_fitness_level}
                </span>
              </div>
              <div className="group-card-chips">
                <span className="history-chip">{g.target_goal}</span>
                {g.schedule_days && <span className="history-chip">📅 {g.schedule_days}</span>}
                {g.max_capacity  && <span className="history-chip">Cap {g.max_capacity}</span>}
                {g.status === "Archived" && <span className="history-chip" style={{ color: "var(--dim)" }}>Archived</span>}
              </div>
              {g.description && (
                <p className="group-card-desc">{g.description}</p>
              )}
            </div>
          ))}
        </div>

        {/* Group detail */}
        <div className="p2-right-detail">
          {!selected ? (
            <div className="empty-state">
              <span className="empty-state-icon">👈</span>
              Select a group to view details.
            </div>
          ) : (
            <>
              <div className="section-title" style={{ marginBottom: 16 }}>
                <div>
                  <h3 style={{ marginBottom: 4 }}>{selected.group_name}</h3>
                  {selected.location && <p className="muted text-xs">📍 {selected.location}</p>}
                </div>
                {selected.status !== "Archived" && (
                  <button className="danger" type="button" onClick={() => archiveGroup(selected.id)}>
                    Archive
                  </button>
                )}
              </div>

              {/* Stats */}
              {dash && (
                <div className="p2-stats-row" style={{ marginBottom: 20 }}>
                  {[
                    ["Members",      dash.total_members                    ?? 0,    "cyan"],
                    ["Sessions",     dash.total_sessions                   ?? 0,    "purple"],
                    ["Avg Complete", `${(dash.avg_completion ?? 0).toFixed(0)}%`,   "lime"],
                    ["Avg RPE",      (dash.avg_rpe ?? 0).toFixed(1),               "gold"],
                  ].map(([label, value, color]) => (
                    <div key={label} className={`stat-card ${color}`} style={{ padding: "14px 18px" }}>
                      <div className="stat-card-top">
                        <span className="stat-card-label">{label}</span>
                      </div>
                      <div className="stat-value" style={{ fontSize: 28 }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Current plan */}
              <div className="intel-section">
                <div className="plan-section-label">📋 Current Programme</div>
                {currentPlan ? (
                  <div className="plan-card">
                    <div className="plan-card-name">
                      {currentPlan.plan_name || "Unnamed Plan"}
                    </div>
                    <div className="plan-card-meta">
                      <Badge value={currentPlan.status || "Active"} />
                      {currentPlan.assigned_at && (
                        <span className="history-chip">
                          Since {String(currentPlan.assigned_at).slice(0, 10)}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="muted text-sm">No plan assigned to this group.</p>
                )}
              </div>

              {/* Members */}
              <div className="intel-section" style={{ marginTop: 18 }}>
                <div className="plan-section-label">
                  👥 Active Members ({members.length})
                </div>
                {members.length === 0 ? (
                  <p className="muted text-sm">No active members in this group.</p>
                ) : (
                  <div className="list">
                    {members.map(m => (
                      <div key={m.member_id} className="list-item" style={{ cursor: "default" }}>
                        <div className="list-item-info">
                          <div className="list-item-name">{m.member_name}</div>
                          <div className="list-item-meta">
                            Assigned {m.start_date}
                            {m.assignment_reason && ` · ${m.assignment_reason}`}
                          </div>
                        </div>
                        {m.is_system_recommended && (
                          <span className="history-chip highlight">AI Pick</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pain members */}
              {dash?.pain_members > 0 && (
                <div style={{ marginTop: 12 }} className="form-note">
                  ⚠ {dash.pain_members} member{dash.pain_members !== 1 ? "s" : ""} reported
                  pain (≥6) in recent sessions.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
