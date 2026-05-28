// ── Coaching Intelligence Tab — member profile (Phase 3.2) ────────────────
import { useState, useEffect, useCallback } from "react";
import { request } from "../../utils/api.js";

const TYPE_ICON = {
  "Workout Progression":   "🚀",
  "Workout Regression":    "↘",
  "Deload":                "🔴",
  "Reassessment":          "📋",
  "Coach Follow-Up":       "📞",
  "Nutrition Adjustment":  "🥗",
  "Supplement Review":     "💊",
  "Safety Review":         "⚠",
  "Exercise Substitution": "🔄",
  "Group Change":          "👥",
  "Motivation Intervention":"💪",
};

const SEV_COLOR = {
  Critical: "danger", High: "warn", Medium: "cyan", Low: "purple",
};
const STATUS_COLOR = {
  Approved: "lime", Applied: "cyan", Rejected: "danger", Archived: "purple",
};

// ── Recommendation mini row ───────────────────────────────────────────────────
function RecRow({ rec }) {
  const icon = TYPE_ICON[rec.recommendation_type] || "💡";
  return (
    <div className="ci-rec-row">
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div className="ci-rec-body">
        <div className="ci-rec-title">{rec.title}</div>
        <div className="muted text-xs">{rec.recommendation_type} · {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : ""}</div>
        <div className="muted text-xs" style={{ marginTop: 3 }}>{rec.summary}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
        <span className={`flag-chip ${SEV_COLOR[rec.severity] || "cyan"}`}>{rec.severity}</span>
        <span className={`flag-chip ${STATUS_COLOR[rec.status] || "cyan"}`}>{rec.status}</span>
      </div>
    </div>
  );
}

// ── AI Insight panel ──────────────────────────────────────────────────────────
function InsightPanel({ insight }) {
  const [open, setOpen] = useState(false);
  if (!insight) return null;

  const sections = [
    { label: "📈 Progress",    text: insight.progress_analysis },
    { label: "⚡ Readiness",   text: insight.readiness_analysis },
    { label: "⚠ Risk",        text: insight.risk_analysis },
    { label: "📊 Adherence",   text: insight.adherence_analysis },
    { label: "🥗 Nutrition",   text: insight.nutrition_analysis },
    { label: "💊 Supplements", text: insight.supplement_analysis },
    { label: "🛡 Safety",      text: insight.safety_notes },
  ].filter(s => s.text);

  return (
    <div className="intel-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>
          🧠 AI Coaching Insight
          {insight.confidence_score != null && (
            <span className="flag-chip cyan" style={{ marginLeft: 8, fontSize: 10, verticalAlign: "middle" }}>
              {Math.round(insight.confidence_score * 100)}% confidence
            </span>
          )}
        </h4>
        <button className="ghost" type="button" style={{ fontSize: 11 }} onClick={() => setOpen(o => !o)}>
          {open ? "Collapse ↑" : "Expand ↓"}
        </button>
      </div>

      <div className="disc-callout" style={{ marginBottom: open ? 12 : 0 }}>
        {insight.summary}
      </div>

      {open && (
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {sections.map(({ label, text }) => (
            <div key={label}>
              <div className="muted text-xs" style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <p className="text-sm" style={{ margin: 0, lineHeight: 1.6, color: "var(--muted)" }}>{text}</p>
            </div>
          ))}

          {insight.recommended_next_steps && (
            <div style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.18)", borderRadius: 8, padding: "10px 14px" }}>
              <div className="muted text-xs" style={{ fontWeight: 600, marginBottom: 6 }}>✅ Recommended Next Steps</div>
              {insight.recommended_next_steps.split(" | ").map((step, i) => (
                <div key={i} className="text-sm" style={{ marginBottom: 4, color: "var(--fg)" }}>• {step}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="muted text-xs" style={{ marginTop: 10 }}>
        Generated {insight.generated_at ? new Date(insight.generated_at).toLocaleDateString() : "—"}
      </div>
    </div>
  );
}

// ── Coach notes ───────────────────────────────────────────────────────────────
function CoachNoteForm({ memberId, token, onAdded }) {
  const [noteType, setNoteType] = useState("Internal");
  const [noteText, setNoteText] = useState("");
  const [msg, setMsg]           = useState("");

  async function submit(e) {
    e.preventDefault();
    setMsg("Saving…");
    try {
      const r = await request("/api/coach-notes/", token, {
        method: "POST",
        body: JSON.stringify({ member_id: memberId, note_type: noteType, note_text: noteText }),
      });
      setNoteText("");
      setMsg("✓ Note added");
      onAdded(r);
    } catch (err) { setMsg("⚠ " + err.message); }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input type="radio" value="Internal"       checked={noteType === "Internal"}       onChange={() => setNoteType("Internal")} />
          Internal (admin only)
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input type="radio" value="Member Visible" checked={noteType === "Member Visible"} onChange={() => setNoteType("Member Visible")} />
          Member Visible
        </label>
      </div>
      <textarea
        required
        rows={2}
        value={noteText}
        onChange={e => setNoteText(e.target.value)}
        placeholder="Add a coaching note…"
      />
      {msg && <p className={`message text-xs ${msg.startsWith("✓") ? "ok" : msg === "Saving…" ? "" : "error"}`}>{msg}</p>}
      <button type="submit" style={{ alignSelf: "flex-start" }}>Add Note</button>
    </form>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export function CoachingIntelligenceTab({ member, token }) {
  const [recs,       setRecs]       = useState([]);
  const [latestInsight, setInsight] = useState(null);
  const [notes,      setNotes]      = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genInsight, setGenInsight] = useState(false);
  const [msg,        setMsg]        = useState("");

  const load = useCallback(async () => {
    if (!token || !member?.id) return;
    try {
      const [recsRes, insightRes, notesRes] = await Promise.allSettled([
        request(`/api/coaching-recommendations/?member_id=${member.id}`, token),
        request(`/api/ai-insights/?member_id=${member.id}&limit=1`, token),
        request(`/api/coach-notes/?member_id=${member.id}`, token),
      ]);
      if (recsRes.status === "fulfilled")    setRecs(recsRes.value);
      if (insightRes.status === "fulfilled") setInsight(insightRes.value[0] || null);
      if (notesRes.status === "fulfilled")   setNotes(notesRes.value);
    } catch { /* silent */ }
  }, [token, member?.id]);

  useEffect(() => { load(); }, [load]);

  async function runEngine() {
    setGenerating(true);
    setMsg("Running recommendation engine…");
    try {
      const r = await request(`/api/coaching-recommendations/generate/${member.id}`, token, { method: "POST" });
      setMsg(`✓ ${r.message}`);
      load();
    } catch (err) {
      setMsg("⚠ " + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function generateInsight() {
    setGenInsight(true);
    setMsg("Generating insight…");
    try {
      const r = await request(`/api/ai-insights/generate/${member.id}`, token, { method: "POST" });
      setInsight(r);
      setMsg("✓ Insight generated");
      load();
    } catch (err) {
      setMsg("⚠ " + err.message);
    } finally {
      setGenInsight(false);
    }
  }

  const activeRecs = recs.filter(r => !["Rejected","Archived"].includes(r.status));
  const criticalRecs = activeRecs.filter(r => r.severity === "Critical");

  return (
    <div className="animate-in" style={{ display: "grid", gap: 20 }}>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={runEngine} disabled={generating}>
          {generating ? "Running…" : "⚡ Generate Recommendations"}
        </button>
        <button className="secondary" type="button" onClick={generateInsight} disabled={genInsight}>
          {genInsight ? "Generating…" : "🧠 Generate Coaching Insight"}
        </button>
      </div>

      {msg && (
        <p className={`message text-sm ${msg.startsWith("✓") ? "ok" : msg.includes("…") ? "" : "error"}`}>
          {msg}
        </p>
      )}

      {/* Critical banner */}
      {criticalRecs.length > 0 && (
        <div style={{
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: 10, padding: "12px 16px",
        }}>
          <strong style={{ color: "var(--danger)" }}>
            ⚠ {criticalRecs.length} critical recommendation(s) require immediate attention
          </strong>
        </div>
      )}

      {/* Latest AI insight */}
      <InsightPanel insight={latestInsight} />

      {/* Active recommendations */}
      <div className="intel-section">
        <h4>
          Active Recommendations ({activeRecs.length})
          {activeRecs.length === 0 && (
            <span className="muted text-xs" style={{ marginLeft: 8 }}>
              Click "Generate Recommendations" to run the engine
            </span>
          )}
        </h4>
        {activeRecs.length === 0
          ? <p className="muted text-sm">No active recommendations.</p>
          : activeRecs.map(r => <RecRow key={r.id} rec={r} />)
        }
      </div>

      {/* Coach notes */}
      <div className="intel-section">
        <h4 style={{ marginBottom: 12 }}>📝 Coach Notes ({notes.length})</h4>
        <CoachNoteForm memberId={member.id} token={token} onAdded={n => setNotes(ns => [n, ...ns])} />
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.length === 0
            ? <p className="muted text-sm">No notes yet.</p>
            : notes.map(n => (
              <div key={n.id} className="rec-note-row">
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span className={`flag-chip ${n.note_type === "Internal" ? "purple" : "cyan"}`}>
                    {n.note_type}
                  </span>
                  <span className="muted text-xs">
                    {n.created_at ? new Date(n.created_at).toLocaleDateString() : "—"}
                  </span>
                </div>
                <p className="text-sm" style={{ margin: 0, lineHeight: 1.55 }}>{n.note_text}</p>
              </div>
            ))
          }
        </div>
      </div>

      {/* All recommendations (history) */}
      {recs.filter(r => ["Rejected","Archived","Applied"].includes(r.status)).length > 0 && (
        <div className="intel-section">
          <h4>Recommendation History</h4>
          {recs
            .filter(r => ["Rejected","Archived","Applied"].includes(r.status))
            .map(r => <RecRow key={r.id} rec={r} />)
          }
        </div>
      )}

    </div>
  );
}
