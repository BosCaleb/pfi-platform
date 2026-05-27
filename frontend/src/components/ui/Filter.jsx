// ── Filter ───────────────────────────────────────────────────────────
/** Labelled select that drives list filtering in the Members directory. */
export function Filter({ label, value, values, onChange }) {
  return (
    <label>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">All</option>
        {values.map(v => <option key={v}>{v}</option>)}
      </select>
    </label>
  );
}
