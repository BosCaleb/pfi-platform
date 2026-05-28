/**
 * api.js — Thin fetch wrapper used by Phase 4.2 components.
 * Signature: apiFetch(path, fetchInit) where fetchInit is a standard
 * RequestInit (with headers, method, body etc.). Throws on non-2xx.
 */
export async function apiFetch(path, options = {}) {
  const r = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (r.status === 204) return null;
  const ct   = r.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await r.json() : await r.text();
  if (!r.ok) {
    const detail = typeof body === "object" ? body.detail || JSON.stringify(body) : body;
    throw new Error(detail || `HTTP ${r.status}`);
  }
  return body;
}
