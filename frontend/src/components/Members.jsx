// ── Members ───────────────────────────────────────────────────────────
import { Badge }        from "./ui/Badge.jsx";
import { Filter }       from "./ui/Filter.jsx";
import { MemberDetail } from "./MemberDetail.jsx";

export function Members({
  members, selected, filters, options,
  onFilter, onRefresh, onSelect,
  onEdit, onDeleteMember, onDeleteAssessment, onDeleteProgress, onDeletePlan,
}) {
  const set = (k, v) => onFilter({ ...filters, [k]: v });

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>Member Directory</h2>
          <p className="muted text-sm" style={{ marginTop: "4px" }}>
            {members.length} member{members.length !== 1 ? "s" : ""} loaded
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

      <div className="directory detail-expanded">
        {/* Member table */}
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
                  <tr key={m.id} onClick={() => onSelect(m.id)} style={{ cursor: "pointer" }}>
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

        {/* Detail panel */}
        <aside className="panel detail-panel">
          {selected ? (
            <MemberDetail
              member={selected}
              onEdit={onEdit}
              onDeleteMember={onDeleteMember}
              onDeleteAssessment={onDeleteAssessment}
              onDeleteProgress={onDeleteProgress}
              onDeletePlan={onDeletePlan}
            />
          ) : (
            <div style={{ textAlign: "center", padding: "32px 16px" }}>
              <p style={{ fontSize: "32px", marginBottom: "12px" }}>👆</p>
              <p className="muted text-sm">Select a member to view their intelligence profile.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
