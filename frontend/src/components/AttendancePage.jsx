// ── Attendance (Phase 4.1) ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import { request } from "../utils/api.js";

const ATT_STATUSES = ["Attended", "No-Show", "Cancelled Late", "Cancelled Early", "Excused"];

export function AttendancePage({ token, members }) {
  const [sessions, setSessions]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [bookings, setBookings]     = useState([]);
  const [marking, setMarking]       = useState({});
  const [msg, setMsg]               = useState("");
  const [statsId, setStatsId]       = useState("");
  const [stats, setStats]           = useState(null);

  async function loadSessions() {
    try {
      const today = new Date().toISOString().split("T")[0];
      const items = await request(`/api/gym-sessions/?session_date=${today}`, token);
      setSessions(items);
    } catch (e) { setMsg(e.message); }
  }

  async function selectSession(s) {
    setSelected(s);
    setMsg("");
    try {
      const [attData, sessData] = await Promise.all([
        request(`/api/attendance/?session_id=${s.id}`, token),
        request(`/api/gym-sessions/${s.id}`, token),
      ]);
      setAttendance(attData);
      setBookings(sessData.bookings || []);
    } catch (e) { setMsg(e.message); }
  }

  useEffect(() => { loadSessions(); }, []);

  async function mark(memberId, status) {
    setMarking(m => ({ ...m, [memberId]: true }));
    try {
      await request("/api/attendance/", token, {
        method: "POST",
        body: JSON.stringify({ session_id: selected.id, member_id: memberId, attendance_status: status }),
      });
      await selectSession(selected);
      setMsg(`✓ Marked ${status}`);
    } catch (e) { setMsg(e.message); }
    setMarking(m => ({ ...m, [memberId]: false }));
  }

  async function loadStats() {
    if (!statsId) return;
    try {
      const s = await request(`/api/attendance/stats/${statsId}`, token);
      setStats(s);
    } catch (e) { setMsg(e.message); }
  }

  // Build a set of marked member IDs and their status
  const markedMap = {};
  attendance.forEach(a => { markedMap[a.member_id] = a.attendance_status; });

  // Merge bookings with all members for marking
  const bookedMemberIds = new Set(bookings.map(b => b.member_id));

  return (
    <div className="p2-section">
      <div className="p2-section-header">
        <h2>✅ Attendance</h2>
        <button className="ghost" onClick={loadSessions}>Refresh Today</button>
      </div>
      {msg && <p className={msg.startsWith("✓") ? "form-note info" : "form-note danger"}>{msg}</p>}

      <div className="p2-two-col" style={{ gap: "1rem" }}>
        {/* Session list */}
        <div>
          <h3 className="ops-section-title">Today's Sessions</h3>
          <div className="ci-grid">
            {sessions.length === 0 && <p className="ci-empty">No sessions scheduled today.</p>}
            {sessions.map(s => (
              <div
                key={s.id}
                className={`ci-task-row ${selected?.id === s.id ? "active" : ""}`}
                onClick={() => selectSession(s)}
                style={{ cursor: "pointer" }}
              >
                <div>
                  <strong>{s.session_title}</strong>
                  <div className="text-muted">{s.start_time}{s.end_time ? ` – ${s.end_time}` : ""} · {s.session_type}</div>
                  <div className="text-muted" style={{ fontSize: "0.75rem" }}>{s.booked_count}/{s.capacity} booked</div>
                </div>
              </div>
            ))}
          </div>

          {/* Member stats lookup */}
          <h3 className="ops-section-title" style={{ marginTop: "1.5rem" }}>Member Attendance Stats</h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <select value={statsId} onChange={e => setStatsId(e.target.value)} style={{ flex: 1 }}>
              <option value="">— Select member —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
            <button className="primary" onClick={loadStats} disabled={!statsId}>View</button>
          </div>
          {stats && (
            <div className="rec-detail" style={{ marginTop: "0.75rem" }}>
              <strong>Attendance Summary</strong>
              <div className="rec-data-grid" style={{ marginTop: "0.5rem" }}>
                <div><span className="text-muted">Total Sessions</span>{stats.total_sessions}</div>
                <div><span className="text-muted">Attended</span><span style={{ color: "var(--lime)" }}>{stats.attended}</span></div>
                <div><span className="text-muted">No-Show</span><span style={{ color: "var(--danger)" }}>{stats.no_show}</span></div>
                <div><span className="text-muted">Cancelled</span>{stats.cancelled}</div>
                <div><span className="text-muted">Rate</span><strong style={{ color: stats.attendance_rate >= 80 ? "var(--lime)" : stats.attendance_rate >= 60 ? "var(--warn)" : "var(--danger)" }}>{stats.attendance_rate}%</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* Mark attendance panel */}
        {selected && (
          <div>
            <h3 className="ops-section-title">Mark Attendance — {selected.session_title}</h3>

            {/* Booked members */}
            {bookings.length > 0 && (
              <div className="ci-grid">
                {bookings.map(b => {
                  const member = members.find(m => m.id === b.member_id);
                  const currentStatus = markedMap[b.member_id];
                  return (
                    <div key={b.id} className="ci-task-row">
                      <div style={{ flex: 1 }}>
                        <strong>{member ? `${member.first_name} ${member.last_name}` : `Member #${b.member_id}`}</strong>
                        {currentStatus && (
                          <span className={`confidence-badge badge-${currentStatus === "Attended" ? "lime" : currentStatus === "No-Show" ? "danger" : "warn"}`} style={{ marginLeft: "0.5rem" }}>
                            {currentStatus}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                        {ATT_STATUSES.map(st => (
                          <button
                            key={st}
                            className={`ghost ${currentStatus === st ? "active" : ""}`}
                            style={{
                              padding: "0.15rem 0.4rem",
                              fontSize: "0.72rem",
                              backgroundColor: currentStatus === st ? "var(--surface-2)" : undefined,
                            }}
                            onClick={() => mark(b.member_id, st)}
                            disabled={marking[b.member_id]}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Manual add */}
            <div style={{ marginTop: "1rem" }}>
              <strong>Walk-in / Manual Mark</strong>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                <select id="walkin-member" style={{ flex: 1 }} onChange={() => {}}>
                  <option value="">— Select member —</option>
                  {members.filter(m => !bookedMemberIds.has(m.id)).map(m => (
                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                  ))}
                </select>
                <button className="primary" onClick={() => {
                  const sel = document.getElementById("walkin-member");
                  if (sel.value) mark(Number(sel.value), "Attended");
                }}>Mark Attended</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
