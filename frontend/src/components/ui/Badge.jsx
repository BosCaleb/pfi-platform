// ── Badge ───────────────────────────────────────────────────────────
/**
 * Coloured status chip. The CSS class is derived from the value so that
 * styles.css can target e.g. `.badge.high`, `.badge.active`, etc.
 */
export function Badge({ value }) {
  const cls = String(value).toLowerCase().replace(/\s+/g, "-");
  return <span className={`badge ${cls}`}>{value}</span>;
}
