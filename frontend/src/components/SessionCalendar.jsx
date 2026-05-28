// ── Session Calendar / Scheduling (Phase 4.1) ─────────────────────────
import { useEffect, useState } from "react";
import { request } from "../utils/api.js";

const today = () => new Date().toISOString().split("T")[0];

const SESSION_TYPES = [
  "One-on-One", "Group Training", "Workout Group", "Assessment",
  "Reassessment", "Nutrition Review", "Recovery", "Open Gym",
];
const STATUSES = ["Scheduled", "Completed", "Cancelled", "Rescheduled"];

const EMPTY_SESSION = {
  session_title: "", session_type: "One-on-One", session_date: today(),
  start_time: "06:00", end_time: "07:00", capacity: 1,
  location: "", session_status: "Scheduled", notes: "",
  workout_group_id: null, coach_admin_id: null,
};

function SessionForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_SESSION, ...initial });
  const [msg, setMsg] = useState("");

  function field(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setMsg("Saving…");
    try {
      await onSave(form);
      setMsg("");
    } catch (err) { setMsg(err.message); }
  }

  return (
    <form className="ci-form" onSubmit={submit}>
      <div className="p2-two-col">
        <label>Session Title *<input required value={form.session_title} onChange={e => field("session_title", e.target.value)} /></label>
        <label>Type<select value={form.session_type} onChange={e => field("session_type", e.target.value)}>
          {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
        </select></label>
        <label>Date *<input required type="date" value={form.session_date} onChange={e => field("session_date", e.target.value)} /></label>
        <label>Start Time<input type="time" value={form.start_time} onChange={e => field("start_time", e.target.value)} /></label>
        <label>End Time<input type="time" value={form.end_time} onChange={e => field("end_time", e.target.value)} /></label>
        <label>Capacity<input type="number" min="1" value={form.capacity} onChange={e => field("capacity", Number(e.target.value))} /></label>
        <label>Location<input value={form.location || ""} onChange={e => field("location", e.target.value)} /></label>
        <label>Status<select value={form.session_status} onChange={e => field("session_status", e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select></label>
      </div>
      <label>Notes<textarea value={form.notes || ""} onChange={e => field("notes", e.target.value)} rows={2} /></label>
      {msg && <p className={msg.startsWith("✓") ? "form-note info" : "form-note danger"}>{msg}</p>}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button className="primary" type="submit">Save Session</button>
        <button className="ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function SessionDetail({ session, token, members, onRefresh }) {
  const [bookingMember, setBookingMember] = useState("");
  const [bookings, setBookings] = useState([]);
  const [msg, setMsg]           = useState("");

  useEffect(() => {
    request(`/api/gym-sessions/${session.id}`, token).then(s => setBookings(s.bookings || [])).catch(() => {});
  }, [session.id]);

  async function addBooking() {
    if (!bookingMember) return;
    setMsg("Booking…");
    try {
      await request("/api/session-bookings/", token, {
        method: "POST",
        body: JSON.stringify({ session_id: session.id, member_id: Number(bookingMember), booked_by: "Admin" }),
      });
      setBookingMember("");
      const s = await request(`/api/gym-sessions/${session.id}`, token);
      setBookings(s.bookings || []);
      setMsg("✓ Booked.");
      onRefresh();
    } catch (e) { setMsg(e.message); }
  }

  async function cancelBooking(bId) {
    try {
      await request(`/api/session-bookings/${bId}`, token, {
        method: "PUT",
        body: JSON.stringify({ booking_status: "Cancelled", cancellation_reason: "Admin cancelled" }),
      });
      const s = await request(`/api/gym-sessions/${session.id}`, token);
      setBookings(s.bookings || []);
      onRefresh();
    } catch (e) { setMsg(e.message); }
  }

  return (
    <div className="rec-detail">
      <h3 style={{ margin: 0 }}>{session.session_title}</h3>
      <div className="text-muted">{session.session_date} · {session.start_time}{session.end_time && ` – ${session.end_time}`}</div>
      <div className="rec-data-grid" style={{ marginTop: "0.5rem" }}>
        <div><span className="text-muted">Type</span>{session.session_type}</div>
        <div><span className="text-muted">Location</span>{session.location || "—"}</div>
        <div><span className="text-muted">Capacity</span>{session.capacity}</div>
        <div><span className="text-muted">Booked</span>{session.booked_count}</div>
        <div><span className="text-muted">Available</span>{session.spots_available}</div>
        <div><span className="text-muted">Status</span>{session.session_status}</div>
      </div>
      {session.notes && <p className="form-note info" style={{ marginTop: "0.5rem" }}>{session.notes}</p>}

      <strong style={{ display: "block", marginTop: "0.75rem" }}>Bookings ({bookings.length})</strong>
      {bookings.map(b => (
        <div key={b.id} className="rec-note-row" style={{ marginTop: "0.3rem" }}>
          <span>Member #{b.member_id}</span>
          <span className="text-muted">{b.booking_status}</span>
          {b.booking_status === "Booked" && (
            <button className="ghost" style={{ padding: "0.1rem 0.5rem", fontSize: "0.75rem" }} onClick={() => cancelBooking(b.id)}>Cancel</button>
          )}
        </div>
      ))}

      {session.spots_available > 0 && (
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select value={bookingMember} onChange={e => setBookingMember(e.target.value)} style={{ flex: 1 }}>
            <option value="">— Add member —</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select>
          <button className="primary" onClick={addBooking} disabled={!bookingMember}>Book</button>
        </div>
      )}
      {msg && <p className={msg.startsWith("✓") ? "form-note info" : "form-note danger"} style={{ marginTop: "0.5rem" }}>{msg}</p>}
    </div>
  );
}

export function SessionCalendar({ token, members }) {
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing]   = useState(null);
  const [creating, setCreating] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("Scheduled");
  const [msg, setMsg] = useState("");

  async function load() {
    const p = new URLSearchParams();
    if (dateFilter)   p.set("session_date", dateFilter);
    if (typeFilter)   p.set("session_type", typeFilter);
    if (statusFilter) p.set("status", statusFilter);
    try { setSessions(await request(`/api/gym-sessions/?${p}`, token)); }
    catch (e) { setMsg(e.message); }
  }

  useEffect(() => { load(); }, [dateFilter, typeFilter, statusFilter]);

  async function save(form) {
    if (editing) {
      await request(`/api/gym-sessions/${editing.id}`, token, { method: "PUT", body: JSON.stringify(form) });
    } else {
      await request("/api/gym-sessions/", token, { method: "POST", body: JSON.stringify(form) });
    }
    setCreating(false);
    setEditing(null);
    await load();
    setMsg("✓ Session saved.");
  }

  async function del(s) {
    if (!confirm(`Delete session "${s.session_title}"?`)) return;
    try {
      await request(`/api/gym-sessions/${s.id}`, token, { method: "DELETE" });
      if (selected?.id === s.id) setSelected(null);
      await load();
    } catch (e) { setMsg(e.message); }
  }

  const statusColor = { Scheduled: "cyan", Completed: "lime", Cancelled: "danger", Rescheduled: "warn" };

  return (
    <div className="p2-section">
      <div className="p2-section-header">
        <h2>📅 Session Schedule</h2>
        <button className="primary" onClick={() => { setCreating(c => !c); setEditing(null); }}>
          {creating ? "Cancel" : "+ New Session"}
        </button>
      </div>
      {msg && <p className={msg.startsWith("✓") ? "form-note info" : "form-note danger"}>{msg}</p>}

      {(creating || editing) && (
        <SessionForm
          initial={editing || {}}
          onSave={save}
          onCancel={() => { setCreating(false); setEditing(null); }}
        />
      )}

      <div className="p2-filter-bar">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} placeholder="Filter by date" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="ghost" onClick={() => { setDateFilter(""); setTypeFilter(""); setStatusFilter("Scheduled"); }}>Clear</button>
      </div>

      <div className="p2-two-col" style={{ gap: "1rem", marginTop: "1rem" }}>
        <div className="ci-grid">
          {sessions.length === 0 && <p className="ci-empty">No sessions found.</p>}
          {sessions.map(s => (
            <div
              key={s.id}
              className={`ci-task-row ${selected?.id === s.id ? "active" : ""}`}
              onClick={() => setSelected(s)}
              style={{ cursor: "pointer" }}
            >
              <div style={{ flex: 1 }}>
                <strong>{s.session_title}</strong>
                <span className={`confidence-badge badge-${statusColor[s.session_status] || "cyan"}`} style={{ marginLeft: "0.5rem" }}>{s.session_status}</span>
                <span className="badge-neutral" style={{ marginLeft: "0.4rem" }}>{s.session_type}</span>
                <div className="text-muted" style={{ marginTop: "0.2rem" }}>
                  {s.session_date} · {s.start_time}{s.end_time && ` – ${s.end_time}`}
                </div>
                <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                  {s.booked_count}/{s.capacity} booked · {s.spots_available} available
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button className="ghost" onClick={e => { e.stopPropagation(); setEditing(s); setCreating(false); }}>Edit</button>
                <button className="danger-btn" onClick={e => { e.stopPropagation(); del(s); }}>Del</button>
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <SessionDetail session={selected} token={token} members={members} onRefresh={load} />
        )}
      </div>
    </div>
  );
}
