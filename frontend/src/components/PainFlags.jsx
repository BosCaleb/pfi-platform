// ── Pain & Risk Flags (Phase 3.1) ─────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { request } from "../utils/api.js";

const RISK_COLOR = { Critical: "danger", High: "warn", Medium: "cyan", Low: "purple" };
const RISK_ICON  = { Critical: "🔴", High: "🟠", Medium: "🟡", Low: "🔵" };
const STATUS_COLOR = { Open: "danger", Reviewed: "warn", Closed: "lime" };

function FlagRow({ flag, member, onSelect, selected }) {
  const name = member ? `${member.first_name} ${member.last_name}` : `Member #${flag.member_id}`;
  return (
    <div
      className={`ci-task-row ${selected ? "selected" : ""}`}
      onClick={() => onSelect(flag)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onSelect(flag)}
    >
      <div style={{ fontSize: 20 }}>{RISK_ICON[flag.risk_level]}</div>
      <div className="ci-task-body">
        <div className="ci-task-title">{flag.flag_message}</div>
        <div className="ci-task-meta muted text-xs">
          {name} · {flag.source_type}
          {flag.pain_score != null && ` · Pain ${flag.pain_score}/10`}
          {flag.pain_location && ` · ${flag.pain_location}`}
          <span className="muted" style={{ marginLeft: 8 }}>
            {flag.created_at ? new Date(flag.created_at).toLocaleDateString() : ""}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
        <span className={`flag-chip ${RISK_COLOR[flag.risk_level]}`}>{flag.risk_level}</span>
        <span className={`flag-chip ${STATUS_COLOR[flag.status]}`}>{flag.status}</span>
      </div>
    </div>
  );
}

function FlagDetail({ flag, token, member, onUpdated, onClose }) {
  const name = member ? `${member.first_name} ${member.last_name}` : `Member #${flag.member_id}`;
  const [status, setStatus] = useState(flag.status);
  const [action, setAction] = useState(flag.recommended_action || "");
  const [msg,    setMsg]    = useState("");

  async function save() {
    setMsg("Saving…");
    try {
      const r = await request(`/api/pain-flags/${flag.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status, recommended_action: action }),
      });
      setMsg("✓ Updated");
      onUpdated(r);
    } catch (err) { setMsg("⚠ " + err.message); }
  }

  return (
    <div className="panel ci-task-detail">
      <div className="section-title" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 24 }}>{RISK_ICON[flag.risk_level]}</span>
          <h3 style={{ margin: 0 }}>Pain / Risk Flag</h3>
        </div>
        <button className="ghost" type="button" onClick={onClose} style={{ fontSize: 12 }}>✕ Close</button>
      </div>

      <div className="ci-task-detail-meta muted text-xs" style={{ marginBottom: 14 }}>
        <span>Member: <strong style={{ color: "var(--fg)" }}>{name}</strong></span>
        <span>Source: {flag.source_type}</span>
        <span className={`flag-chip ${RISK_COLOR[flag.risk_level]}`}>{flag.risk_level}</span>
        {flag.pain_score != null && <span>Pain: <strong style={{ color: "var(--danger)" }}>{flag.pain_score}/10</strong></span>}
        {flag.pain_location && <span>Location: {flag.pain_location}</span>}
        <span>Created: {flag.created_at ? new Date(flag.created_at).toLocaleDateString() : "—"}</span>
        {flag.reviewed_at && <span>Reviewed: {new Date(flag.reviewed_at).toLocaleDateString()}</span>}
      </div>

      <div className="ci-task-description" style={{ marginBottom: 16 }}>
        <p className="muted text-sm" style={{ lineHeight: 1.6 }}>{flag.flag_message}</p>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Status
          <select value={status} onChange={e => setStatus(e.target.value)}>
            {["Open","Reviewed","Closed"].map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Recommended Action
          <textarea rows={3} value={action} onChange={e => setAction(e.target.value)} />
        </label>
      </div>

      {msg && <p className={`message text-sm ${msg.startsWith("✓") ? "ok" : msg === "Saving…" ? "" : "error"}`} style={{ marginTop: 10 }}>{msg}</p>}

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button type="button" onClick={save}>Save</button>
        {status === "Open" && (
          <button className="secondary" type="button" onClick={() => { setStatus("Reviewed"); }}>Mark Reviewed</button>
        )}
        {status !== "Closed" && (
          <button className="ghost" type="button" onClick={() => { setStatus("Closed"); }}>Close Flag</button>
        )}
      </div>
    </div>
  );
}

export function PainFlags({ token, members }) {
  const [flags,    setFlags]    = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters,  setFilters]  = useState({ status: "Open", risk_level: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    member_id: "", source_type: "Admin Note", pain_score: "",
    pain_location: "", risk_level: "Medium", flag_message: "", recommended_action: "",
  });
  const [createMsg, setCreateMsg] = useState("");

  const loadFlags = useCallback(async () => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
    try {
      const data = await request(`/api/pain-flags/?${p}`, token);
      setFlags(data);
    } catch { /* silent */ }
  }, [token, filters]);

  useEffect(() => { loadFlags(); }, [loadFlags]);

  function onUpdated(updated) {
    setFlags(fs => fs.map(f => f.id === updated.id ? updated : f));
    setSelected(updated);
    loadFlags();
  }

  async function createFlag(e) {
    e.preventDefault();
    setCreateMsg("Creating…");
    try {
      const body = {
        ...createForm,
        pain_score: createForm.pain_score ? Number(createForm.pain_score) : null,
      };
      await request("/api/pain-flags/", token, { method: "POST", body: JSON.stringify(body) });
      setCreateMsg("✓ Flag created.");
      setShowCreate(false);
      setCreateForm({ member_id: "", source_type: "Admin Note", pain_score: "", pain_location: "", risk_level: "Medium", flag_message: "", recommended_action: "" });
      loadFlags();
    } catch (err) { setCreateMsg("⚠ " + err.message); }
  }

  const open     = flags.filter(f => f.status === "Open").length;
  const critical = flags.filter(f => f.risk_level === "Critical" && f.status === "Open").length;
  const high     = flags.filter(f => f.risk_level === "High" && f.status === "Open").length;

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>🚩 Pain &amp; Risk Flags</h2>
          <p className="muted text-sm" style={{ marginTop: 4 }}>Active pain flags, injury reports and risk monitoring</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ghost" type="button" onClick={loadFlags}>↻ Refresh</button>
          <button type="button" onClick={() => setShowCreate(s => !s)}>
            {showCreate ? "Cancel" : "+ New Flag"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="ci-kpi-row" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
        <div className={`ci-kpi-card ${open > 0 ? "warn" : "lime"}`}>
          <span className="ci-kpi-label">Open Flags</span>
          <strong className="ci-kpi-value">{open}</strong>
        </div>
        <div className={`ci-kpi-card ${critical > 0 ? "danger" : "lime"}`}>
          <span className="ci-kpi-label">🔴 Critical</span>
          <strong className="ci-kpi-value">{critical}</strong>
        </div>
        <div className={`ci-kpi-card ${high > 0 ? "warn" : "lime"}`}>
          <span className="ci-kpi-label">🟠 High Risk</span>
          <strong className="ci-kpi-value">{high}</strong>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <form className="panel" style={{ marginBottom: 16 }} onSubmit={createFlag}>
          <h4 style={{ marginBottom: 12 }}>Create Pain / Risk Flag</h4>
          <div className="ci-grid">
            <label className="ci-field wide">
              Member *
              <select required value={createForm.member_id} onChange={e => setCreateForm(f => ({ ...f, member_id: e.target.value }))}>
                <option value="">— Select member —</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select>
            </label>
            <label className="ci-field">
              Source Type
              <select value={createForm.source_type} onChange={e => setCreateForm(f => ({ ...f, source_type: e.target.value }))}>
                {["Check-In","Workout Session","Exercise Log","Admin Note"].map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="ci-field">
              Risk Level
              <select value={createForm.risk_level} onChange={e => setCreateForm(f => ({ ...f, risk_level: e.target.value }))}>
                {["Low","Medium","High","Critical"].map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="ci-field">
              Pain Score (0–10)
              <input type="number" min="0" max="10" value={createForm.pain_score}
                onChange={e => setCreateForm(f => ({ ...f, pain_score: e.target.value }))} />
            </label>
            <label className="ci-field">
              Pain Location
              <input type="text" value={createForm.pain_location}
                onChange={e => setCreateForm(f => ({ ...f, pain_location: e.target.value }))} />
            </label>
            <label className="ci-field wide">
              Flag Message *
              <textarea required rows={2} value={createForm.flag_message}
                onChange={e => setCreateForm(f => ({ ...f, flag_message: e.target.value }))} />
            </label>
            <label className="ci-field wide">
              Recommended Action
              <textarea rows={2} value={createForm.recommended_action}
                onChange={e => setCreateForm(f => ({ ...f, recommended_action: e.target.value }))} />
            </label>
          </div>
          {createMsg && <p className={`message text-xs ${createMsg.startsWith("✓") ? "ok" : "error"}`} style={{ marginTop: 8 }}>{createMsg}</p>}
          <button type="submit" style={{ marginTop: 10 }}>Create Flag</button>
        </form>
      )}

      {/* Filters */}
      <div className="p2-filter-bar" style={{ marginBottom: 14 }}>
        <div className="p2-filter-row">
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {["Open","Reviewed","Closed"].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filters.risk_level} onChange={e => setFilters(f => ({ ...f, risk_level: e.target.value }))}>
            <option value="">All Risk Levels</option>
            {["Critical","High","Medium","Low"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="p2-two-col">
        <div className="p2-left-list">
          {flags.length === 0
            ? <div className="empty-state"><span className="empty-state-icon">✅</span>No flags match the current filters.</div>
            : flags.map(f => {
                const m = members.find(m => m.id === f.member_id);
                return <FlagRow key={f.id} flag={f} member={m} selected={selected?.id === f.id} onSelect={setSelected} />;
              })
          }
        </div>
        <div className="p2-right-detail">
          {selected
            ? <FlagDetail flag={selected} token={token}
                member={members.find(m => m.id === selected.member_id)}
                onUpdated={onUpdated} onClose={() => setSelected(null)} />
            : (
              <div className="panel" style={{ padding: "32px 24px", textAlign: "center" }}>
                <div className="empty-state-icon" style={{ fontSize: 36 }}>🚩</div>
                <p className="muted text-sm">Select a flag to review or update it.</p>
              </div>
            )
          }
        </div>
      </div>
    </section>
  );
}
