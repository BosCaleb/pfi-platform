import { useState, useEffect } from "react";
import { apiFetch } from "../api";

const CATEGORY_ICONS = {
  Calendar:  "📅",
  Messaging: "💬",
  Payments:  "💳",
  Wearables: "⌚",
};

const STATUS_COLORS = {
  "Not Configured": "#475569",
  "Active":         "var(--lime)",
  "Error":          "var(--danger)",
  "Disabled":       "#94a3b8",
};

export default function IntegrationsPage({ token }) {
  const [settings,  setSettings]  = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [logs,      setLogs]      = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [tab,       setTab]       = useState("overview");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const hdr = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const [sett, cat, lg] = await Promise.all([
        apiFetch("/api/integrations/",         { headers: hdr }),
        apiFetch("/api/integrations/catalogue", { headers: hdr }),
        apiFetch("/api/integrations/logs",      { headers: hdr }),
      ]);
      setSettings(sett);
      setCatalogue(cat);
      setLogs(lg);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const enable = async (serviceName) => {
    const existing = settings.find(s => s.service_name === serviceName);
    try {
      if (existing) {
        const res = await apiFetch(`/api/integrations/${existing.id}`, {
          method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
          body: JSON.stringify({ is_enabled: !existing.is_enabled }),
        });
        setSettings(prev => prev.map(s => s.id === existing.id ? res : s));
        if (selected?.id === existing.id) setSelected(res);
      } else {
        const res = await apiFetch("/api/integrations/", {
          method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
          body: JSON.stringify({ service_name: serviceName, is_enabled: true, status: "Not Configured" }),
        });
        setSettings(prev => [...prev, res]);
        setSelected(res);
      }
    } catch (e) { setError(e.message); }
  };

  const updateStatus = async (id, status) => {
    try {
      const res = await apiFetch(`/api/integrations/${id}`, {
        method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setSettings(prev => prev.map(s => s.id === id ? res : s));
      if (selected?.id === id) setSelected(res);
    } catch (e) { setError(e.message); }
  };

  // Group catalogue by category
  const grouped = catalogue.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const getSetting = (name) => settings.find(s => s.service_name === name);

  return (
    <div className="integrations-wrap">
      <div className="ai-coach-header">
        <h2 className="section-title">🔌 Integrations</h2>
        <p className="section-sub">Connect external services. These are readiness stubs — activation requires API keys configured server-side.</p>
        <div className="tab-pills">
          <button className={`tab-pill ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>Overview</button>
          <button className={`tab-pill ${tab === "logs" ? "active" : ""}`} onClick={() => setTab("logs")}>Event Logs ({logs.length})</button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="loading-pulse">Loading…</div>}

      {tab === "overview" && (
        <>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="panel integration-group">
              <h3 className="panel-title">{CATEGORY_ICONS[cat] || "🔗"} {cat}</h3>
              <div className="integration-grid">
                {items.map(item => {
                  const s = getSetting(item.service_name);
                  const isEnabled = s?.is_enabled || false;
                  const status    = s?.status || "Not Configured";
                  return (
                    <div key={item.service_name} className={`integration-card ${isEnabled ? "enabled" : ""}`}
                      onClick={() => s && setSelected(s)}>
                      <div className="int-card-header">
                        <span className="int-name">{item.service_name}</span>
                        <span className="status-chip" style={{ color: STATUS_COLORS[status] || "#94a3b8" }}>
                          {status}
                        </span>
                      </div>
                      <p className="int-desc">{item.description}</p>
                      <div className="int-card-footer">
                        <label className="toggle-label">
                          <input type="checkbox" checked={isEnabled}
                            onChange={() => enable(item.service_name)} />
                          <span className="toggle-slider" />
                          {isEnabled ? "Enabled" : "Disabled"}
                        </label>
                        {s && (
                          <select className="status-select" value={status}
                            onChange={e => updateStatus(s.id, e.target.value)}>
                            {["Not Configured","Active","Error","Disabled"].map(st => (
                              <option key={st}>{st}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {selected && (
            <div className="panel">
              <div className="panel-header">
                <h3 className="panel-title">⚙ {selected.service_name} — Details</h3>
                <button className="btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div className="int-detail">
                <div className="int-detail-row">
                  <span>Status:</span>
                  <span style={{ color: STATUS_COLORS[selected.status] || "#94a3b8" }}>{selected.status}</span>
                </div>
                <div className="int-detail-row">
                  <span>Enabled:</span>
                  <span>{selected.is_enabled ? "✅ Yes" : "❌ No"}</span>
                </div>
                <div className="int-detail-row">
                  <span>Last Sync:</span>
                  <span>{selected.last_sync_at ? new Date(selected.last_sync_at).toLocaleString() : "Never"}</span>
                </div>
                <div className="int-detail-row">
                  <span>Config:</span>
                  <span className="muted">{selected.config_json || "No configuration stored"}</span>
                </div>
              </div>
              <div className="suggestion-box">
                ℹ️ To activate this integration, configure API credentials in your server environment variables and update status to "Active".
              </div>
            </div>
          )}
        </>
      )}

      {tab === "logs" && (
        <div className="panel table-shell">
          <table className="data-table">
            <thead><tr><th>Service</th><th>Event</th><th>Status</th><th>Message</th><th>Time</th></tr></thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>{log.integration_id}</td>
                  <td>{log.event_type}</td>
                  <td>
                    <span className="status-chip" style={{ color: log.status === "Success" ? "var(--lime)" : "var(--danger)" }}>
                      {log.status}
                    </span>
                  </td>
                  <td className="notes-cell">{log.message || "—"}</td>
                  <td>{log.created_at ? new Date(log.created_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="empty-cell">No event logs yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
