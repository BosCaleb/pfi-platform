// ── API utilities ───────────────────────────────────────────────────

/**
 * Coerce an empty string or null-ish value to null; otherwise parse as Number.
 * @param {string|number|null|undefined} v
 * @returns {number|null}
 */
export function numericOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/**
 * Generic authenticated fetch wrapper.
 * Throws an Error with the API detail message on non-2xx responses.
 *
 * @param {string} path  - URL path (relative or absolute)
 * @param {string} token - JWT bearer token (pass "" for unauthenticated)
 * @param {RequestInit} [options] - fetch options override
 * @returns {Promise<any>} Parsed JSON or raw text
 */
export async function request(path, token, options = {}) {
  const r = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const ct   = r.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await r.json() : await r.text();
  if (!r.ok) {
    const detail = typeof body === "object" ? body.detail || JSON.stringify(body) : body;
    throw new Error(detail || `HTTP ${r.status}`);
  }
  return body;
}

/**
 * Transform a wizard profile object into the flat payload the API expects.
 * Converts empty strings to null and numeric fields to numbers.
 *
 * @param {object} profile - Raw wizard profile state
 * @returns {object} API-ready payload
 */
export function cleanPayload(profile) {
  const p = JSON.parse(JSON.stringify(profile));

  const numericFields = [
    "height", "weight", "body_fat_percentage", "waist_measurement",
    "resting_heart_rate", "mobility_score", "sleep_hours", "water_intake",
    "fat_loss_pct", "strength_pct", "mobility_pct", "performance_pct",
    "target_weight", "training_frequency", "session_duration",
    "pushups", "squats", "plank_seconds",
  ];

  for (const group of ["physical", "lifestyle", "goals", "behavior", "assessment"]) {
    Object.entries(p[group]).forEach(([k, v]) => {
      if (numericFields.includes(k)) p[group][k] = numericOrNull(v);
      else if (v === "") p[group][k] = null;
    });
  }

  Object.entries(p.personal).forEach(([k, v]) => { if (v === "") p.personal[k] = null; });
  Object.entries(p.health).forEach(([k, v])   => { if (v === "") p.health[k]   = null; });

  // secondary_goals: comma-separated string → array
  p.goals.secondary_goals = profile.goals.secondary_goals
    ? profile.goals.secondary_goals.split(",").map(s => s.trim()).filter(Boolean)
    : null;

  return p;
}
