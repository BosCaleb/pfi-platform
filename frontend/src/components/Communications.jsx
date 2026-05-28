// ── Communications (Phase 4.1) ─────────────────────────────────────────
import { useEffect, useState } from "react";
import { request } from "../utils/api.js";

const MSG_TYPES = [
  "Direct Message", "Announcement", "Payment Reminder",
  "Session Reminder", "Check-In Follow-Up", "General",
];

function MessageForm({ members, templates, onSend, onCancel, initial }) {
  const [form, setForm] = useState({
    recipient_member_id: "", message_type: "Direct Message",
    subject: "", message_body: "", visible_in_member_portal: true,
    delivery_channel: "In-App",
    ...initial,
  });
  const [bulk, setBulk]   = useState(false);
  const [bulkIds, setBulkIds] = useState([]);
  const [msg, setMsg]     = useState("");

  function field(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function applyTemplate(tId) {
    const t = templates.find(t => t.id === Number(tId));
    if (t) { field("subject", t.subject || ""); field("message_body", t.body || ""); }
  }

  async function submit(e) {
    e.preventDefault();
    setMsg("Sending…");
    try {
      if (bulk && bulkIds.length > 0) {
        await onSend({ ...form, member_ids: bulkIds.map(Number), bulk: true });
      } else {
        await onSend({ ...form, recipient_member_id: Number(form.recipient_member_id) });
      }
      setMsg("");
    } catch (err) { setMsg(err.message); }
  }

  return (
    <form className="ci-form" onSubmit={submit}>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <label style={{ display: "flex", gap: "0.4rem", alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={bulk} onChange={e => setBulk(e.target.checked)} />
          Bulk send to multiple members
        </label>
      </div>

      {templates.length > 0 && (
        <label>Use Template
          <select onChange={e => applyTemplate(e.target.value)} defaultValue="">
            <option value="">— None —</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
          </select>
        </label>
      )}

      <div className="p2-two-col">
        {bulk ? (
          <label>Recipients (hold Ctrl/Cmd for multiple)
            <select multiple value={bulkIds} onChange={e => setBulkIds(Array.from(e.target.selectedOptions, o => o.value))} style={{ height: "100px" }}>
              {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
          </label>
        ) : (
          <label>Recipient
            <select value={form.recipient_member_id} onChange={e => field("recipient_member_id", e.target.value)}>
              <option value="">— Select Member —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
          </label>
        )}
        <label>Type
          <select value={form.message_type} onChange={e => field("message_type", e.target.value)}>
            {MSG_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label>Subject<input value={form.subject || ""} onChange={e => field("subject", e.target.value)} /></label>
        <label>Channel
          <select value={form.delivery_channel} onChange={e => field("delivery_channel", e.target.value)}>
            {["In-App", "Email", "WhatsApp", "SMS"].map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <label>Message *
        <textarea required value={form.message_body} onChange={e => field("message_body", e.target.value)} rows={4} placeholder="Type your message here…" />
      </label>
      <label style={{ display: "flex", gap: "0.4rem", alignItems: "center", cursor: "pointer" }}>
        <input type="checkbox" checked={form.visible_in_member_portal} onChange={e => field("visible_in_member_portal", e.target.checked)} />
        Visible in Member Portal
      </label>
      {msg && <p className={msg.startsWith("✓") ? "form-note info" : "form-note danger"}>{msg}</p>}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button className="primary" type="submit">Send Message</button>
        <button className="ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function TemplateManager({ templates, token, onRefresh }) {
  const [form, setForm] = useState({ template_name: "", template_type: "", subject: "", body: "" });
  const [msg, setMsg]   = useState("");

  async function save(e) {
    e.preventDefault();
    setMsg("Saving…");
    try {
      await request("/api/communications/templates", token, { method: "POST", body: JSON.stringify(form) });
      setForm({ template_name: "", template_type: "", subject: "", body: "" });
      setMsg("✓ Template saved.");
      onRefresh();
    } catch (err) { setMsg(err.message); }
  }

  async function del(id) {
    if (!confirm("Delete this template?")) return;
    try {
      await request(`/api/communications/templates/${id}`, token, { method: "DELETE" });
      onRefresh();
    } catch (e) { setMsg(e.message); }
  }

  return (
    <div>
      <h3 className="ops-section-title">Message Templates</h3>
      <form className="ci-form" onSubmit={save}>
        <div className="p2-two-col">
          <label>Template Name *<input required value={form.template_name} onChange={e => setForm(f => ({ ...f, template_name: e.target.value }))} /></label>
          <label>Type<input value={form.template_type} onChange={e => setForm(f => ({ ...f, template_type: e.target.value }))} placeholder="e.g. Payment Reminder" /></label>
          <label>Subject<input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></label>
        </div>
        <label>Body<textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} /></label>
        {msg && <p className={msg.startsWith("✓") ? "form-note info" : "form-note danger"}>{msg}</p>}
        <button className="primary" type="submit">Save Template</button>
      </form>
      <div className="ci-grid" style={{ marginTop: "0.75rem" }}>
        {templates.map(t => (
          <div key={t.id} className="ci-task-row">
            <div style={{ flex: 1 }}>
              <strong>{t.template_name}</strong>
              {t.template_type && <span className="badge-neutral" style={{ marginLeft: "0.4rem" }}>{t.template_type}</span>}
              {t.subject && <div className="text-muted">{t.subject}</div>}
            </div>
            <button className="danger-btn" onClick={() => del(t.id)}>Delete</button>
          </div>
        ))}
        {templates.length === 0 && <p className="ci-empty">No templates yet.</p>}
      </div>
    </div>
  );
}

export function Communications({ token, members }) {
  const [tab, setTab]           = useState("messages");
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [composing, setComposing] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [msg, setMsg]           = useState("");

  async function loadMessages() {
    const p = new URLSearchParams();
    if (typeFilter)   p.set("message_type", typeFilter);
    if (memberFilter) p.set("member_id", memberFilter);
    try { setMessages(await request(`/api/communications/messages?${p}`, token)); }
    catch (e) { setMsg(e.message); }
  }
  async function loadTemplates() {
    try { setTemplates(await request("/api/communications/templates", token)); }
    catch (e) {}
  }

  useEffect(() => { loadMessages(); loadTemplates(); }, []);
  useEffect(() => { if (tab === "messages") loadMessages(); }, [typeFilter, memberFilter]);

  async function sendMessage(form) {
    if (form.bulk) {
      await request("/api/communications/messages/bulk", token, { method: "POST", body: JSON.stringify(form) });
    } else {
      await request("/api/communications/messages", token, { method: "POST", body: JSON.stringify(form) });
    }
    setComposing(false);
    await loadMessages();
    setMsg("✓ Message sent.");
  }

  async function deleteMessage(id) {
    if (!confirm("Delete this message?")) return;
    try {
      await request(`/api/communications/messages/${id}`, token, { method: "DELETE" });
      await loadMessages();
    } catch (e) { setMsg(e.message); }
  }

  const statusColor = { Sent: "cyan", Read: "lime", Draft: "muted", Archived: "muted" };

  return (
    <div className="p2-section">
      <div className="p2-section-header">
        <h2>📨 Communications</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {["messages", "templates"].map(t => (
            <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "messages" ? "💬 Messages" : "📄 Templates"}
            </button>
          ))}
        </div>
      </div>
      {msg && <p className={msg.startsWith("✓") ? "form-note info" : "form-note danger"}>{msg}</p>}

      {tab === "messages" && (
        <>
          <div className="p2-filter-bar">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {MSG_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={memberFilter} onChange={e => setMemberFilter(e.target.value)}>
              <option value="">All Members</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
            <button className="primary" onClick={() => setComposing(c => !c)}>{composing ? "Cancel" : "✉ Compose"}</button>
            <button className="ghost" onClick={loadMessages}>Refresh</button>
          </div>

          {composing && (
            <MessageForm
              members={members}
              templates={templates}
              onSend={sendMessage}
              onCancel={() => setComposing(false)}
              initial={{}}
            />
          )}

          <div className="ci-grid" style={{ marginTop: "0.75rem" }}>
            {messages.length === 0 && <p className="ci-empty">No messages yet.</p>}
            {messages.map(m => (
              <div key={m.id} className="ci-task-row">
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <strong>{m.subject || m.message_type}</strong>
                    <span className={`confidence-badge badge-${statusColor[m.message_status] || "cyan"}`}>{m.message_status}</span>
                    <span className="badge-neutral">{m.message_type}</span>
                  </div>
                  {m.recipient_name && <div className="text-muted">To: {m.recipient_name}</div>}
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>{m.message_body?.slice(0, 80)}{m.message_body?.length > 80 ? "…" : ""}</div>
                  <div className="text-muted" style={{ fontSize: "0.72rem" }}>{m.sent_at?.slice(0, 16)}</div>
                </div>
                <button className="danger-btn" onClick={() => deleteMessage(m.id)}>Delete</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "templates" && (
        <TemplateManager templates={templates} token={token} onRefresh={loadTemplates} />
      )}
    </div>
  );
}
