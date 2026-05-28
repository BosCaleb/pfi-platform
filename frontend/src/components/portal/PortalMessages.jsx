import { useState, useEffect } from "react";

const TYPE_ICON = {
  "general": "💬", "invoice": "💳", "reminder": "🔔",
  "plan-update": "📋", "check-in": "✅", "milestone": "🏆",
  "emergency": "🚨",
};

export default function PortalMessages({ token }) {
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [open,     setOpen]     = useState(null);

  useEffect(() => {
    fetch("/api/member/messages", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setMessages(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="mp-page"><div className="mp-loading">Loading…</div></div>;

  return (
    <div className="mp-page">
      <h2 className="mp-page-title">💬 Messages from Coach</h2>

      {open !== null ? (
        /* Message detail view */
        <div className="mp-card mp-msg-detail">
          <button className="mp-back-btn" onClick={() => setOpen(null)}>← Back</button>
          <div className="mp-msg-detail-header">
            <span className="mp-msg-detail-icon">{TYPE_ICON[messages[open]?.message_type] || "💬"}</span>
            <div>
              <div className="mp-msg-detail-subject">{messages[open]?.subject || "Message"}</div>
              <div className="mp-msg-detail-date">
                {messages[open]?.sent_at
                  ? new Date(messages[open].sent_at).toLocaleString("en-ZA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
                  : ""}
              </div>
            </div>
          </div>
          <div className="mp-msg-body">{messages[open]?.body}</div>
        </div>
      ) : (
        /* Message list */
        messages.length > 0 ? (
          <div className="mp-card">
            <div className="mp-msg-list">
              {messages.map((msg, i) => (
                <div key={msg.id} className="mp-msg-row" onClick={() => setOpen(i)}>
                  <div className="mp-msg-icon">{TYPE_ICON[msg.message_type] || "💬"}</div>
                  <div className="mp-msg-content">
                    <div className="mp-msg-subject">{msg.subject || "Message from coach"}</div>
                    <div className="mp-msg-preview">
                      {msg.body ? msg.body.slice(0, 80) + (msg.body.length > 80 ? "…" : "") : ""}
                    </div>
                    <div className="mp-msg-date">
                      {msg.sent_at
                        ? new Date(msg.sent_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
                        : ""}
                    </div>
                  </div>
                  <div className="mp-msg-arrow">›</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mp-card">
            <div className="mp-empty-icon">💬</div>
            <p className="mp-empty">No messages yet. Your coach will share updates here.</p>
          </div>
        )
      )}
    </div>
  );
}
