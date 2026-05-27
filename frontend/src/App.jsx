/**
 * App.jsx — Root component and application shell.
 *
 * Responsibilities:
 *  - Auth state (token, admin) persisted to localStorage.
 *  - Global data loading (dashboard stats, reassessments, member list, settings).
 *  - Route/tab switching.
 *  - CRUD handlers delegated down to page components via props.
 *
 * All UI is split into focused components under src/components/.
 */
import { useEffect, useMemo, useState } from "react";

// ── Constants & utilities ────────────────────────────────────────────
import { TAB_ITEMS, emptyProfile }     from "./constants.js";
import { request, cleanPayload, numericOrNull } from "./utils/api.js";
import { cloneProfile, today, unique, pick }    from "./utils/helpers.js";

// ── Page components ──────────────────────────────────────────────────
import { Landing }              from "./components/Landing.jsx";
import { Disclaimers }          from "./components/Disclaimers.jsx";
import { Login }                from "./components/Login.jsx";
import { Dashboard }            from "./components/Dashboard.jsx";
import { Intake }               from "./components/Intake.jsx";
import { Members }              from "./components/Members.jsx";
import { Tracking }             from "./components/Tracking.jsx";
import { Settings }             from "./components/Settings.jsx";

// Phase 2 — Workout Intelligence
import { WorkoutGroups }        from "./components/WorkoutGroups.jsx";
import { ExerciseLibrary }      from "./components/ExerciseLibrary.jsx";
import { PlanBuilder }          from "./components/PlanBuilder.jsx";
import { WorkoutSessions }      from "./components/WorkoutSessions.jsx";
import { ReassessmentAlerts }   from "./components/ReassessmentAlerts.jsx";

// ── App ──────────────────────────────────────────────────────────────

function App() {
  // Auth
  const [token, setToken] = useState(localStorage.getItem("pfi_token") || "");
  const [admin, setAdmin] = useState(JSON.parse(localStorage.getItem("pfi_admin") || "null"));

  // Navigation
  const [view, setView] = useState(token ? "app" : "landing");
  const [tab,  setTab]  = useState("dashboard");

  // Messages
  const [message,  setMessage]  = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [trackMsg, setTrackMsg] = useState("");

  // Data
  const [dashboard,      setDash]     = useState(null);
  const [reassessments,  setReassess] = useState([]);
  const [members,        setMembers]  = useState([]);
  const [selected,       setSelected] = useState(null);
  const [settings,       setSettings] = useState(null);
  const [publicSettings, setPub]      = useState(null);

  // Filters
  const [filters, setFilters] = useState({ search: "", goal: "", level: "", risk: "", status: "" });

  // Intake wizard
  const [profile,   setProfile]  = useState(() => {
    const p = cloneProfile(); p.assessment.assessment_date = today(); return p;
  });
  const [step,      setStep]     = useState(0);
  const [editingId, setEditing]  = useState(null);

  const loggedIn = Boolean(token);

  // ── Effects ───────────────────────────────────────────────────────

  useEffect(() => {
    request("/api/settings/public", "")
      .then(setPub)
      .catch(() => setPub({ admin_seed_enabled: false }));
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (token) refreshAll(); }, [token]);

  // ── Data loaders ─────────────────────────────────────────────────

  async function refreshAll() {
    await Promise.allSettled([loadDashboard(), loadMembers(), loadSettings()]);
  }

  async function loadDashboard() {
    if (!token) return;
    const [stats, due] = await Promise.all([
      request("/api/dashboard/stats", token),
      request("/api/dashboard/reassessments", token),
    ]);
    setDash(stats);
    setReassess(due);
  }

  async function loadMembers(nf = filters) {
    if (!token) return;
    const p = new URLSearchParams();
    Object.entries(nf).forEach(([k, v]) => { if (v) p.set(k, v); });
    setMembers(await request(`/api/members/?${p}`, token));
  }

  async function loadSettings() {
    if (!token) return;
    setSettings(await request("/api/settings/", token));
  }

  // ── Auth handlers ─────────────────────────────────────────────────

  function signOut() {
    setToken(""); setAdmin(null);
    localStorage.removeItem("pfi_token");
    localStorage.removeItem("pfi_admin");
    setView("landing");
  }

  async function login(event) {
    event.preventDefault();
    setLoginMsg("Authenticating…");
    const d = new FormData(event.currentTarget);
    try {
      const r = await request("/api/auth/login", "", {
        method: "POST",
        body: JSON.stringify({ email: d.get("email"), password: d.get("password") }),
      });
      setToken(r.access_token);
      setAdmin(r.admin);
      localStorage.setItem("pfi_token", r.access_token);
      localStorage.setItem("pfi_admin", JSON.stringify(r.admin));
      setLoginMsg("");
      setView("app");
    } catch (e) {
      setLoginMsg(e.message);
    }
  }

  async function seedAdmin() {
    setLoginMsg("Creating default admin…");
    try {
      const r = await request("/api/auth/seed", "", { method: "POST", body: "{}" });
      setLoginMsg(r.message);
    } catch (e) {
      setLoginMsg(e.message);
    }
  }

  // ── Profile helpers ───────────────────────────────────────────────

  function updateField(path, value) {
    setProfile(cur => {
      const next   = JSON.parse(JSON.stringify(cur));
      const parts  = path.split(".");
      let t = next;
      parts.slice(0, -1).forEach(p => { t = t[p]; });
      t[parts.at(-1)] = value;
      return next;
    });
  }

  function resetProfile() {
    const next = cloneProfile();
    next.assessment.assessment_date = today();
    setProfile(next);
    setStep(0);
    setEditing(null);
    setMessage("");
  }

  // ── Member CRUD ───────────────────────────────────────────────────

  async function submitMember(event) {
    event.preventDefault();
    setMessage(editingId ? "Updating…" : "Saving…");
    try {
      const saved = await request(
        editingId ? `/api/members/${editingId}` : "/api/members/",
        token,
        { method: editingId ? "PUT" : "POST", body: JSON.stringify(cleanPayload(profile)) },
      );
      setMessage(`✓ ${editingId ? "Updated" : "Saved"} — ${saved.first_name} ${saved.last_name}.`);
      resetProfile();
      await refreshAll();
      setTab("members");
      await showMember(saved.id);
    } catch (e) {
      setMessage(e.message);
    }
  }

  async function showMember(id) {
    setSelected(await request(`/api/members/${id}`, token));
  }

  async function editMember(id) {
    const m = await request(`/api/members/${id}`, token);
    const latest = [...(m.assessments || [])]
      .sort((a, b) => String(a.assessment_date).localeCompare(String(b.assessment_date)))
      .pop() || {};
    const mp   = latest.mobility_score ? String(latest.mobility_score).split(" / ") : [];
    const next = cloneProfile();

    Object.assign(next.personal,  pick(m, Object.keys(emptyProfile.personal)));
    Object.assign(next.physical,  m.physical_metrics  || {});
    Object.assign(next.health,    m.health_profile    || {});
    Object.assign(next.lifestyle, m.lifestyle_profile || {});
    Object.assign(next.goals,     m.goals             || {});
    Object.assign(next.behavior,  m.motivation_profile || {});
    Object.assign(next.assessment, latest, {
      assessment_date:      latest.assessment_date || today(),
      hamstring_flexibility: mp[0] || "",
      shoulder_mobility:     mp[1] || "",
      balance_test:          latest.balance_score || "",
    });
    Object.assign(next.consent, {
      privacy_consent:              Boolean(m.privacy_consent),
      medical_disclaimer_accepted:  Boolean(m.medical_disclaimer_accepted),
      marketing_consent:            Boolean(m.marketing_consent),
    });
    next.goals.secondary_goals = Array.isArray(next.goals.secondary_goals)
      ? next.goals.secondary_goals.join(", ")
      : (next.goals.secondary_goals || "");

    setProfile(next);
    setEditing(id);
    setStep(0);
    setTab("intake");
    setMessage(`Editing ${m.first_name} ${m.last_name}.`);
  }

  // ── Delete handlers ───────────────────────────────────────────────

  async function deleteMember(id, name) {
    if (!confirm(`Permanently delete ${name}?\n\nThis removes ALL their data and cannot be undone.`)) return;
    try {
      await request(`/api/members/${id}`, token, { method: "DELETE" });
      setSelected(null);
      await loadMembers();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  }

  async function deleteAssessment(assessmentId, memberId) {
    if (!confirm("Delete this assessment record?")) return;
    try {
      await request(`/api/assessments/${assessmentId}`, token, { method: "DELETE" });
      await showMember(memberId);
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  }

  async function deleteProgress(entryId, memberId) {
    if (!confirm("Delete this progress entry?")) return;
    try {
      await request(`/api/progress/${entryId}`, token, { method: "DELETE" });
      await showMember(memberId);
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  }

  async function deletePlan(planType, planId, memberId) {
    if (!confirm(`Delete this ${planType} plan?`)) return;
    try {
      await request(`/api/${planType}-plans/${planId}`, token, { method: "DELETE" });
      await showMember(memberId);
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  }

  // ── Tracking quick-form ───────────────────────────────────────────

  async function submitQuick(event, endpoint, label) {
    event.preventDefault();
    setTrackMsg(`Saving ${label}…`);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const numericKeys = [
      "member_id", "pushups", "squats", "plank_seconds",
      "adherence_score", "calories_target", "protein_target",
      "weekly_frequency", "session_duration",
      "weight", "waist_measurement", "body_fat_percentage", "hydration_target",
    ];
    Object.keys(data).forEach(k => {
      if (data[k] === "") data[k] = null;
      if (numericKeys.includes(k)) data[k] = numericOrNull(data[k]);
    });
    try {
      await request(endpoint, token, { method: "POST", body: JSON.stringify(data) });
      event.currentTarget.reset();
      setTrackMsg(`✓ ${label} saved.`);
      await loadDashboard();
    } catch (e) {
      setTrackMsg(e.message);
    }
  }

  // ── Filter options ────────────────────────────────────────────────

  const filterOptions = useMemo(() => ({
    goal:   unique(members, "primary_goal"),
    level:  unique(members, "fitness_level"),
    risk:   unique(members, "risk_level"),
    status: unique(members, "status"),
  }), [members]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon" aria-hidden="true">⚡</div>
          <div>
            <p className="eyebrow">Fitness Intelligence Platform</p>
            <h1>PFI Platform</h1>
          </div>
        </div>
        <div className="session">
          {loggedIn && admin && <span className="session-email">{admin.email}</span>}
          <button className="ghost" type="button" onClick={() => setView(loggedIn ? "app" : "landing")}>
            Home
          </button>
          {!loggedIn && (
            <button className="secondary" type="button" onClick={() => setView("login")}>
              Admin Login
            </button>
          )}
          {loggedIn && (
            <button className="ghost" type="button" onClick={signOut}>
              Sign out
            </button>
          )}
        </div>
      </header>

      <main>
        {view === "landing"      && <Landing onLogin={() => setView("login")} onDisclaimers={() => setView("disclaimers")} />}
        {view === "disclaimers"  && <Disclaimers onBack={() => setView("landing")} />}
        {view === "login"   && (
          <Login
            onSubmit={login}
            onSeed={seedAdmin}
            message={loginMsg}
            seedEnabled={publicSettings?.admin_seed_enabled}
          />
        )}
        {view === "app" && (
          <section className="workspace">
            <nav className="tabs" aria-label="Workspace">
              {TAB_ITEMS.map(({ id, icon, label }) => (
                <button
                  key={id}
                  className={`tab ${tab === id ? "active" : ""}`}
                  type="button"
                  onClick={() => setTab(id)}
                >
                  <span className="tab-icon">{icon}</span>{label}
                </button>
              ))}
            </nav>

            {tab === "dashboard" && (
              <Dashboard
                stats={dashboard}
                reassessments={reassessments}
                token={token}
                onRefresh={loadDashboard}
                onSelectMember={id => { setTab("members"); showMember(id); }}
              />
            )}
            {tab === "intake" && (
              <Intake
                profile={profile}
                step={step}
                editingId={editingId}
                message={message}
                onField={updateField}
                onStep={setStep}
                onSubmit={submitMember}
                onReset={resetProfile}
              />
            )}
            {tab === "members" && (
              <Members
                members={members}
                selected={selected}
                filters={filters}
                options={filterOptions}
                token={token}
                onFilter={nf => { setFilters(nf); loadMembers(nf); }}
                onRefresh={() => loadMembers()}
                onSelect={showMember}
                onEdit={editMember}
                onDeleteMember={deleteMember}
                onDeleteAssessment={deleteAssessment}
                onDeleteProgress={deleteProgress}
                onDeletePlan={deletePlan}
              />
            )}
            {tab === "tracking" && (
              <Tracking
                members={members}
                message={trackMsg}
                onSubmit={submitQuick}
                onRefresh={loadMembers}
              />
            )}
            {/* Phase 2 — Workout Intelligence */}
            {tab === "groups"    && <WorkoutGroups      token={token} />}
            {tab === "exercises" && <ExerciseLibrary    token={token} />}
            {tab === "plans"     && <PlanBuilder        token={token} />}
            {tab === "sessions"  && <WorkoutSessions    token={token} members={members} />}
            {tab === "alerts"    && <ReassessmentAlerts token={token} members={members} />}
            {tab === "settings" && (
              <Settings settings={settings} token={token} onRefresh={loadSettings} />
            )}
          </section>
        )}
      </main>
    </>
  );
}

export default App;
