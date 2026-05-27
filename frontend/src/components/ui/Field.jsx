// ── Form field primitives ────────────────────────────────────────────
import { deepValue } from "../../utils/helpers.js";

/**
 * Unified form control — renders <input>, <select>, or <textarea>
 * depending on the props supplied, with error state and label.
 */
export function Field({
  profile, path, label, type = "text",
  options, textarea, required, min, max,
  step: s, onField, placeholder, errors = {}, wide,
}) {
  const value    = deepValue(profile, path);
  const hasError = errors[path];
  const cls      = hasError ? "field-error" : "";
  const common   = { required, className: cls };

  let control;
  if (options) {
    control = (
      <select {...common} value={value ?? ""} onChange={e => onField(path, e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o || "— Select —"}</option>)}
      </select>
    );
  } else if (textarea) {
    control = (
      <textarea {...common} value={value ?? ""} onChange={e => onField(path, e.target.value)} />
    );
  } else {
    control = (
      <input
        {...common}
        type={type}
        min={min} max={max} step={s}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={e => onField(path, e.target.value)}
      />
    );
  }

  return (
    <label className={wide ? "wide" : ""}>
      {label}
      {required && <span style={{ color: "var(--danger)" }}> *</span>}
      {control}
      {hasError && <span className="field-error-msg">⚠ {hasError}</span>}
    </label>
  );
}

/**
 * Boolean checkbox with label — used for consent fields.
 */
export function Checkbox({ profile, path, label, required, onField, errors = {} }) {
  const checked  = Boolean(deepValue(profile, path));
  const hasError = errors[path];
  return (
    <div className={`check-row wide ${hasError ? "field-error" : ""}`}>
      <input
        required={required}
        type="checkbox"
        checked={checked}
        onChange={e => onField(path, e.target.checked)}
        id={path}
      />
      <label htmlFor={path}>
        {label}
        {required && <span style={{ color: "var(--danger)" }}> *</span>}
      </label>
    </div>
  );
}
