// ── Pure utility helpers ────────────────────────────────────────────
import { STEP_REQUIRED, emptyProfile } from "../constants.js";

// ── Date ────────────────────────────────────────────────────────────
/** Returns today's date as YYYY-MM-DD. */
export const today = () => new Date().toISOString().slice(0, 10);

// ── Profile cloning ─────────────────────────────────────────────────
/** Deep-clone emptyProfile using structuredClone where available. */
export function cloneProfile() {
  return typeof structuredClone === "function"
    ? structuredClone(emptyProfile)
    : JSON.parse(JSON.stringify(emptyProfile));
}

// ── Object traversal ────────────────────────────────────────────────
/**
 * Read a dot-path value from a nested object without throwing.
 * @param {object} source
 * @param {string} path  e.g. "personal.first_name"
 */
export function deepValue(source, path) {
  return path.split(".").reduce((v, k) => (v != null ? v[k] : undefined), source);
}

// ── Display helpers ─────────────────────────────────────────────────
/** "John Doe" → "JD" */
export function initials(first = "", last = "") {
  return `${first[0] || ""}${last[0] || ""}`.toUpperCase() || "?";
}

/** Deterministic avatar colour variant based on member id. */
export function avatarVariant(id) {
  return ["cyan", "purple", "lime"][(id || 0) % 3];
}

/** Deduplicate and sort a list of values from a key in an array of objects. */
export function unique(items, key) {
  return [...new Set(items.map(i => i[key]).filter(Boolean))].sort();
}

/**
 * Pick selected keys from an object, defaulting missing values to "".
 * @param {object} source
 * @param {string[]} keys
 */
export function pick(source, keys) {
  return Object.fromEntries(keys.map(k => [k, source[k] ?? ""]));
}

// ── Score colour ────────────────────────────────────────────────────
/** Maps a 0–100 score to a CSS colour token. */
export function scoreColor(v) {
  if (v == null) return "cyan";
  if (v >= 75)   return "lime";
  if (v >= 50)   return "cyan";
  if (v >= 25)   return "gold";
  return "danger";
}

// ── Form validation ─────────────────────────────────────────────────
/**
 * Validate required fields for a wizard step.
 * Returns a map of { path: "Required" } for any missing values.
 *
 * @param {number} step
 * @param {object} profile
 * @returns {Record<string, string>}
 */
export function validateStep(step, profile) {
  const errs = {};
  (STEP_REQUIRED[step] || []).forEach(path => {
    const v = deepValue(profile, path);
    if (v === "" || v == null || v === false) errs[path] = "Required";
  });
  return errs;
}
