// ── Members ───────────────────────────────────────────────────────────
import { useEffect }          from "react";
import { createPortal }       from "react-dom";
import { Badge }              from "./ui/Badge.jsx";
import { Filter }             from "./ui/Filter.jsx";
import { MemberDetail }       from "./MemberDetail.jsx";

export function Members({
  members, selected, filters, options, token,
  onFilter, onRefresh, onSelect, onClose,
  onEdit, onDeleteMember, onDeleteAssessment, onDeleteProgress, onDeletePlan,
}) {
  const set = (k, v) => onFilter({ ...filters, [k]: v });

  // Close on Escape key
  useEffect(() => {
    if (!selected) return;
    const handle = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [selected, onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selected]);

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>Member Directory</h2>
          <p className="muted text-sm" style={{ marginTop: "4px" }}>
            {members.length} member{members.length !== 1 ? "s" : ""} loaded
            {" — "}
            <span style={{ color: "var(--dim)" }}>click a row to open profile</span>
          </p>
        </div>
        <button className="ghost" type="button" onClick={onRefresh}>↻ Refresh</button>
      </div>

      <div className="filters">
        <label>
          Search
          <input
            value={filters.search}
            onChange={e => set("search", e.target.value)}
            placeholder="Name, email, goal…"
          />
        </label>
        <Filter label="Goal"   value={filters.goal}   values={options.goal}   onChange={v => set("goal",   v)} />
        <Filter label="Level"  value={filters.level}  values={options.level}  onChange={v => set("level",  v)} />
        <Filter label="Risk"   value={filters.risk}   values={options.risk}   onChange={v => set("risk",   v)} />
        <Filter label="Status" value={filters.status} values={options.status} onChange={v => set("status", v)} />
      </div>

      {/* ── Full-width member table ──────────────────────── */}
      <div className="panel table-shell">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Goal</th>
              <th>Level</th>
              <th>Risk</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {members.length ? (
              members.map(m => (
                <tr
                  key={m.id}
                  onClick={() => onSelect(m.id)}
                  style={{ cursor: "pointer" }}
                  className={selected?.id === m.id ? "row-selected" : ""}
                >
                  <td>
                    <strong>{m.first_name} {m.last_name}</strong>
                    <br />
                    <small style={{ color: "var(--dim)" }}>{m.email}</small>
                  </td>
                  <td>{m.primary_goal}</td>
                  <td>{m.fitness_level}</td>
                  <td><Badge value={m.risk_level  || "Low"} /></td>
                  <td><Badge value={m.status      || ""} /></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: "center", color: "var(--dim)", padding: "32px" }}>
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Liquid glass profile modal (portal → document.body) ── */}
      {/* Rendered via createPortal so it escapes any overflow/stacking
          context on ancestor elements and is truly full-screen. */}
      {selected && createPortal(
        <div
          className="member-modal-overlay"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.first_name} ${selected.last_name} — profile`}
        >
          <div
            className="member-modal"
            onClick={e => e.stopPropagation()}
          >
            {/* Close button — pinned top-right, rotates on hover */}
            <button
              className="member-modal-close"
              type="button"
              onClick={onClose}
              aria-label="Close profile"
              title="Close  (Esc)"
            >
              ✕
            </button>

            {/* Scrollable inner content */}
            <div className="member-modal-body">
              <MemberDetail
                member={selected}
                token={token}
                onEdit={onEdit}
                onDeleteMember={onDeleteMember}
                onDeleteAssessment={onDeleteAssessment}
                onDeleteProgress={onDeleteProgress}
                onDeletePlan={onDeletePlan}
              />
            </div>
          </div>
        </div>,
        document.body          /* ← mounts outside ALL ancestor constraints */
      )}
    </section>
  );
}
