// ── Gym Setup / Settings (Phase 4.1) ──────────────────────────────────
import { useEffect, useState } from "react";
import { request } from "../utils/api.js";

const CURRENCIES  = ["ZAR", "USD", "GBP", "EUR", "AUD", "CAD"];
const TIMEZONES   = ["Africa/Johannesburg", "UTC", "America/New_York", "Europe/London", "Australia/Sydney"];

export function GymSetup({ token }) {
  const [form, setForm] = useState(null);
  const [msg, setMsg]   = useState("");

  async function load() {
    try { setForm(await request("/api/gym-settings/", token)); }
    catch (e) { setMsg(e.message); }
  }

  useEffect(() => { load(); }, []);

  function field(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function save(e) {
    e.preventDefault();
    setMsg("Saving…");
    try {
      const updated = await request("/api/gym-settings/", token, { method: "PUT", body: JSON.stringify(form) });
      setForm(updated);
      setMsg("✓ Gym settings saved.");
    } catch (err) { setMsg(err.message); }
  }

  if (!form) return <div className="ci-empty">Loading gym settings…</div>;

  return (
    <div className="p2-section">
      <div className="p2-section-header">
        <h2>🏋️ Gym Setup</h2>
      </div>
      {msg && <p className={msg.startsWith("✓") ? "form-note info" : "form-note danger"}>{msg}</p>}

      <form className="ci-form" onSubmit={save}>

        <h3 className="ops-section-title">Gym Identity</h3>
        <div className="p2-two-col">
          <label>Gym Name<input value={form.gym_name || ""} onChange={e => field("gym_name", e.target.value)} /></label>
          <label>Contact Email<input type="email" value={form.contact_email || ""} onChange={e => field("contact_email", e.target.value)} /></label>
          <label>Contact Phone<input value={form.contact_phone || ""} onChange={e => field("contact_phone", e.target.value)} /></label>
          <label>Location / Address<input value={form.location || ""} onChange={e => field("location", e.target.value)} /></label>
        </div>
        <label>Operating Hours
          <textarea value={form.operating_hours || ""} onChange={e => field("operating_hours", e.target.value)} rows={2} placeholder="e.g. Mon–Fri 05:00–21:00, Sat 06:00–14:00" />
        </label>

        <h3 className="ops-section-title">Session Defaults</h3>
        <div className="p2-two-col">
          <label>Default Session Duration (min)<input type="number" min="1" value={form.default_session_duration || ""} onChange={e => field("default_session_duration", Number(e.target.value))} /></label>
          <label>Default Capacity<input type="number" min="1" value={form.default_session_capacity || ""} onChange={e => field("default_session_capacity", Number(e.target.value))} /></label>
          <label>Cancellation Window (hours)<input type="number" min="0" value={form.default_cancellation_window_hours || ""} onChange={e => field("default_cancellation_window_hours", Number(e.target.value))} /></label>
        </div>

        <h3 className="ops-section-title">Billing & Finance</h3>
        <div className="p2-two-col">
          <label>Currency
            <select value={form.currency || "ZAR"} onChange={e => field("currency", e.target.value)}>
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Invoice Prefix<input value={form.invoice_prefix || ""} onChange={e => field("invoice_prefix", e.target.value)} placeholder="e.g. INV" /></label>
          <label>Timezone
            <select value={form.timezone || "Africa/Johannesburg"} onChange={e => field("timezone", e.target.value)}>
              {TIMEZONES.map(tz => <option key={tz}>{tz}</option>)}
            </select>
          </label>
        </div>

        <h3 className="ops-section-title">Policies & Terms</h3>
        <label>Membership Terms
          <textarea value={form.membership_terms || ""} onChange={e => field("membership_terms", e.target.value)} rows={4} placeholder="Your membership terms and conditions…" />
        </label>
        <label>Cancellation Policy
          <textarea value={form.cancellation_policy || ""} onChange={e => field("cancellation_policy", e.target.value)} rows={3} placeholder="Your cancellation policy…" />
        </label>
        <label>Privacy Policy
          <textarea value={form.privacy_policy || ""} onChange={e => field("privacy_policy", e.target.value)} rows={4} placeholder="Your privacy policy…" />
        </label>

        <button className="primary" type="submit" style={{ marginTop: "0.5rem" }}>Save Gym Settings</button>
      </form>
    </div>
  );
}
