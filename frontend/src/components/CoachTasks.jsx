// ── Coach Tasks (Phase 3.1) ───────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { request } from "../utils/api.js";

const PRIORITY_COLOR = { Urgent: "danger", High: "warn", Medium: "cyan", Low: "purple" };
const PRIORITY_ORDER = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
const STATUS_COLOR   = { Open: "cyan", "In Progress": "warn", Completed: "lime", Dismissed: "purple" };

const TASK_TYPES = [
  "Pain Review", "Readiness Review", "Low Adherence", "Reassessment",
  "Nutrition Review", "Supplement Review", "Injury Review", "Coach Follow-Up", "General",
];

function TaskRow({ task, members, onSelect, selected }) {
  const member = members.find(m => m.id === task.member_id);
  const name   = member ? `${member.first_name} ${member.last_name}` : `Member #${task.member_id}`;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status === "Open";

  return (
    <div
      className={`ci-task-row ${selected ? "selected" : ""} ${isOverdue ? "overdue" : ""}`}
      onClick={() => onSelect(task)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onSelect(task)}
    >
      <div className="ci-task-priority">
        <span className={`flag-chip ${PRIORITY_COLOR[task.priority]}`}>{task.priority}</span>
      </div>
      <div className="ci-task-body">
        <div className="ci-task-title">{task.title}</div>
        <div className="ci-task-meta muted text-xs">
          {name} · {task.task_type}
          {task.due_date && ` · Due ${task.due_date}`}
          {isOverdue && <span style={{ color: "var(--danger)", marginLeft: 6 }}>OVERDUE</span>}
          {task.created_by_system && <span className="history-chip" style={{ marginLeft: 6 }}>Auto</span>}
        </div>
      </div>
      <span className={`flag-chip ${STATUS_COLOR[task.status]}`}>{task.status}</span>
    </div>
  );
}

function TaskDetail({ task, token, members, onUpdated, onClose }) {
  const member = members.find(m => m.id === task.member_id);
  const name   = member ? `${member.first_name} ${member.last_name}` : `Member #${task.member_id}`;
  const [note,    setNote]    = useState(task.coach_note || "");
  const [status,  setStatus]  = useState(task.status);
  const [dismiss, setDismiss] = useState(task.dismiss_reason || "");
  const [msg,     setMsg]     = useState("");

  async function save() {
    setMsg("Saving…");
    try {
      const body = { status, coach_note: note };
      if (status === "Dismissed") body.dismiss_reason = dismiss;
      const r = await request(`/api/coach-tasks/${task.id}`, token, {
        method: "PATCH", body: JSON.stringify(body),
      });
      setMsg("✓ Updated");
      onUpdated(r);
    } catch (err) { setMsg("⚠ " + err.message); }
  }

  return (
    <div className="panel ci-task-detail">
      <div className="section-title" style={{ marginBottom: 14 }}>
        <h3 style={{ marginBottom: 0 }}>{task.title}</h3>
        <button className="ghost" type="button" onClick={onClose} style={{ fontSize: 12 }}>✕ Close</button>
      </div>
      <div className="ci-task-detail-meta muted text-xs" style={{ marginBottom: 14 }}>
        <span>Member: <strong style={{ color: "var(--fg)" }}>{name}</strong></span>
        <span>Type: {task.task_type}</span>
        <span>Priority: <span className={`flag-chip ${PRIORITY_COLOR[task.priority]}`}>{task.priority}</span></span>
        {task.due_date && <span>Due: {task.due_date}</span>}
        <span>Created: {task.created_at ? new Date(task.created_at).toLocaleDateString() : "—"}</span>
        {task.created_by_system && <span className="history-chip">System-generated</span>}
      </div>

      {task.description && (
        <div className="ci-task-description">
          <p className="muted text-sm" style={{ lineHeight: 1.6 }}>{task.description}</p>
        </div>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label>
          Status
          <select value={status} onChange={e => setStatus(e.target.value)}>
            {["Open", "In Progress", "Completed", "Dismissed"].map(s => <option key={s}>{s}</option>)}
          </select>
        </label>

        {status === "Dismissed" && (
          <label>
            Dismiss Reason
            <textarea rows={2} value={dismiss} onChange={e => setDismiss(e.target.value)} />
          </label>
        )}

        <label>
          Coach Note
          <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Add a note for this task…" />
        </label>
      </div>

      {msg && <p className={`message text-sm ${msg.startsWith("✓") ? "ok" : msg === "Saving…" ? "" : "error"}`} style={{ marginTop: 10 }}>{msg}</p>}

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button type="button" onClick={save}>Save Changes</button>
        {status === "Open" && (
          <button className="secondary" type="button" onClick={() => { setStatus("Completed"); save(); }}>
            ✓ Complete
          </button>
        )}
      </div>
    </div>
  );
}

export function CoachTasks({ token, members }) {
  const [tasks,      setTasks]      = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [filters,    setFilters]    = useState({ status: "Open", priority: "", task_type: "", member_id: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ member_id: "", task_type: "General", title: "", description: "", priority: "Medium" });
  const [createMsg,  setCreateMsg]  = useState("");

  const loadTasks = useCallback(async () => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
    try {
      const data = await request(`/api/coach-tasks/?${p}`, token);
      const sorted = [...data].sort((a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
      );
      setTasks(sorted);
    } catch { /* silent */ }
  }, [token, filters]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  function onUpdated(updated) {
    setTasks(ts => ts.map(t => t.id === updated.id ? updated : t));
    setSelected(updated);
    loadTasks();
  }

  async function createTask(e) {
    e.preventDefault();
    setCreateMsg("Creating…");
    try {
      const r = await request("/api/coach-tasks/", token, {
        method: "POST", body: JSON.stringify(createForm),
      });
      setCreateMsg("✓ Task created.");
      setShowCreate(false);
      setCreateForm({ member_id: "", task_type: "General", title: "", description: "", priority: "Medium" });
      loadTasks();
    } catch (err) { setCreateMsg("⚠ " + err.message); }
  }

  const open      = tasks.filter(t => t.status === "Open").length;
  const urgent    = tasks.filter(t => t.priority === "Urgent" && t.status === "Open").length;
  const today     = new Date().toISOString().split("T")[0];
  const dueToday  = tasks.filter(t => t.due_date === today && t.status === "Open").length;

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>📋 Coach Tasks</h2>
          <p className="muted text-sm" style={{ marginTop: 4 }}>Review, assign and complete coaching tasks</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ghost" type="button" onClick={loadTasks}>↻ Refresh</button>
          <button type="button" onClick={() => setShowCreate(s => !s)}>
            {showCreate ? "Cancel" : "+ New Task"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="ci-kpi-row" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
        <div className={`ci-kpi-card ${open > 0 ? "cyan" : "lime"}`}>
          <span className="ci-kpi-label">Open Tasks</span>
          <strong className="ci-kpi-value">{open}</strong>
        </div>
        <div className={`ci-kpi-card ${urgent > 0 ? "danger" : "lime"}`}>
          <span className="ci-kpi-label">Urgent</span>
          <strong className="ci-kpi-value">{urgent}</strong>
        </div>
        <div className={`ci-kpi-card ${dueToday > 0 ? "warn" : "lime"}`}>
          <span className="ci-kpi-label">Due Today</span>
          <strong className="ci-kpi-value">{dueToday}</strong>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <form className="panel" style={{ marginBottom: 16 }} onSubmit={createTask}>
          <h4 style={{ marginBottom: 12 }}>Create Task</h4>
          <div className="ci-grid">
            <label className="ci-field wide">
              Member *
              <select required value={createForm.member_id} onChange={e => setCreateForm(f => ({ ...f, member_id: e.target.value }))}>
                <option value="">— Select member —</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select>
            </label>
            <label className="ci-field">
              Task Type
              <select value={createForm.task_type} onChange={e => setCreateForm(f => ({ ...f, task_type: e.target.value }))}>
                {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="ci-field">
              Priority
              <select value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value }))}>
                {["Low","Medium","High","Urgent"].map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="ci-field wide">
              Title *
              <input required value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} />
            </label>
            <label className="ci-field wide">
              Description
              <textarea rows={2} value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} />
            </label>
          </div>
          {createMsg && <p className={`message text-xs ${createMsg.startsWith("✓") ? "ok" : "error"}`} style={{ marginTop: 8 }}>{createMsg}</p>}
          <button type="submit" style={{ marginTop: 10 }}>Create Task</button>
        </form>
      )}

      {/* Filters */}
      <div className="p2-filter-bar" style={{ marginBottom: 14 }}>
        <div className="p2-filter-row">
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {["Open","In Progress","Completed","Dismissed"].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}>
            <option value="">All Priorities</option>
            {["Urgent","High","Medium","Low"].map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={filters.task_type} onChange={e => setFilters(f => ({ ...f, task_type: e.target.value }))}>
            <option value="">All Types</option>
            {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={filters.member_id} onChange={e => setFilters(f => ({ ...f, member_id: e.target.value }))}>
            <option value="">All Members</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select>
        </div>
      </div>

      <div className="p2-two-col">
        <div className="p2-left-list">
          {tasks.length === 0
            ? <p className="muted text-sm">No tasks match the current filters.</p>
            : tasks.map(t => (
                <TaskRow key={t.id} task={t} members={members}
                  selected={selected?.id === t.id}
                  onSelect={setSelected} />
              ))
          }
        </div>
        <div className="p2-right-detail">
          {selected
            ? <TaskDetail task={selected} token={token} members={members}
                onUpdated={onUpdated} onClose={() => setSelected(null)} />
            : (
              <div className="panel" style={{ padding: "32px 24px", textAlign: "center" }}>
                <div className="empty-state-icon" style={{ fontSize: 36 }}>📋</div>
                <p className="muted text-sm">Select a task to review or update it.</p>
              </div>
            )
          }
        </div>
      </div>
    </section>
  );
}
