import { useEffect, useMemo, useState } from "react";

// ── Constants ──────────────────────────────────────────────────────
const emptyProfile = {
  personal: {
    first_name: "", last_name: "", email: "", phone: "",
    date_of_birth: "", gender: "", emergency_contact_name: "",
    emergency_contact_phone: "", occupation: "", location: "",
    preferred_training_time: "", status: "Active",
  },
  physical: {
    height: "", weight: "", body_fat_percentage: "", waist_measurement: "",
    resting_heart_rate: "", blood_pressure: "", mobility_score: "",
    fitness_level: "Beginner",
  },
  health: {
    injuries: "", pain_areas: "", previous_surgeries: "", chronic_conditions: "",
    medications: "", medical_clearance_required: "No",
    medical_clearance_received: "No", notes: "", risk_level: "Low",
  },
  lifestyle: {
    sleep_hours: "", stress_level: "", activity_level: "", work_schedule: "",
    travel_frequency: "", water_intake: "", nutrition_habits: "",
    smoking: "", alcohol: "", recovery_capacity: "",
  },
  goals: {
    primary_goal: "Fat Loss", secondary_goals: "",
    fat_loss_pct: 0, strength_pct: 0, mobility_pct: 0, performance_pct: 0,
    target_weight: "", target_date: "", coach_notes: "",
  },
  behavior: {
    motivation_type: "Self-motivated", coaching_style: "Encouraging",
    workout_preference: "", training_frequency: "", session_duration: "",
    gamification: "No", notification_frequency: "",
  },
  assessment: {
    assessment_date: "", pushups: "", squats: "", plank_seconds: "",
    cardio_result: "", heart_recovery_notes: "", hamstring_flexibility: "",
    shoulder_mobility: "", balance_test: "", overall_notes: "",
  },
  consent: { privacy_consent: false, medical_disclaimer_accepted: false, marketing_consent: false },
};

const WIZARD_STEPS = [
  { label: "Identity",  icon: "👤", subtitle: "Personal details and contact information" },
  { label: "Physical",  icon: "📏", subtitle: "Body metrics and current fitness level" },
  { label: "Health",    icon: "🩺", subtitle: "Medical history and risk assessment" },
  { label: "Lifestyle", icon: "🌙", subtitle: "Sleep, stress, activity and habits" },
  { label: "Goals",     icon: "🎯", subtitle: "Targets and goal weighting" },
  { label: "Coaching",  icon: "🧠", subtitle: "Motivation style and training preferences" },
  { label: "Baseline",  icon: "📊", subtitle: "Initial fitness assessment and consent" },
];

const STEP_REQUIRED = [
  ["personal.first_name","personal.last_name","personal.email","personal.phone",
   "personal.date_of_birth","personal.emergency_contact_name","personal.emergency_contact_phone"],
  ["physical.height","physical.weight"],
  [], [],
  ["goals.primary_goal"],
  ["behavior.motivation_type","behavior.coaching_style"],
  ["assessment.assessment_date","consent.medical_disclaimer_accepted","consent.privacy_consent"],
];

const TAB_ITEMS = [
  { id: "dashboard", icon: "⚡", label: "Dashboard" },
  { id: "intake",    icon: "➕", label: "Member Intake" },
  { id: "members",   icon: "👥", label: "Members" },
  { id: "tracking",  icon: "📈", label: "Tracking" },
  { id: "settings",  icon: "⚙️",  label: "Settings" },
];

// ── Pure helpers ───────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

function cloneProfile() {
  return typeof structuredClone === "function"
    ? structuredClone(emptyProfile) : JSON.parse(JSON.stringify(emptyProfile));
}

function deepValue(source, path) {
  return path.split(".").reduce((v, k) => (v != null ? v[k] : undefined), source);
}

function numericOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function cleanPayload(profile) {
  const p = JSON.parse(JSON.stringify(profile));
  const nums = ["height","weight","body_fat_percentage","waist_measurement","resting_heart_rate",
    "mobility_score","sleep_hours","water_intake","fat_loss_pct","strength_pct","mobility_pct",
    "performance_pct","target_weight","training_frequency","session_duration",
    "pushups","squats","plank_seconds"];
  for (const g of ["physical","lifestyle","goals","behavior","assessment"]) {
    Object.entries(p[g]).forEach(([k, v]) => {
      if (nums.includes(k)) p[g][k] = numericOrNull(v);
      else if (v === "") p[g][k] = null;
    });
  }
  Object.entries(p.personal).forEach(([k,v]) => { if (v==="") p.personal[k]=null; });
  Object.entries(p.health).forEach(([k,v])   => { if (v==="") p.health[k]=null; });
  p.goals.secondary_goals = profile.goals.secondary_goals
    ? profile.goals.secondary_goals.split(",").map(s=>s.trim()).filter(Boolean)
    : null;
  return p;
}

async function request(path, token, options = {}) {
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

function initials(first = "", last = "") {
  return `${first[0]||""}${last[0]||""}`.toUpperCase() || "?";
}
function avatarVariant(id) {
  return ["cyan","purple","lime"][(id||0) % 3];
}
function unique(items, key) {
  return [...new Set(items.map(i=>i[key]).filter(Boolean))].sort();
}
function pick(source, keys) {
  return Object.fromEntries(keys.map(k => [k, source[k] ?? ""]));
}
function scoreColor(v) {
  if (v==null) return "cyan";
  if (v>=75) return "lime";
  if (v>=50) return "cyan";
  if (v>=25) return "gold";
  return "danger";
}
function validateStep(step, profile) {
  const errs = {};
  (STEP_REQUIRED[step]||[]).forEach(path => {
    const v = deepValue(profile, path);
    if (v===""||v==null||v===false) errs[path] = "Required";
  });
  return errs;
}

// ── App root ───────────────────────────────────────────────────────
function App() {
  const [token, setToken]       = useState(localStorage.getItem("pfi_token") || "");
  const [admin, setAdmin]       = useState(JSON.parse(localStorage.getItem("pfi_admin")||"null"));
  const [view, setView]         = useState(token ? "app" : "landing");
  const [tab, setTab]           = useState("dashboard");
  const [message, setMessage]   = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [trackMsg, setTrackMsg] = useState("");
  const [dashboard, setDash]    = useState(null);
  const [reassessments, setReassess] = useState([]);
  const [members, setMembers]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [settings, setSettings] = useState(null);
  const [publicSettings, setPub]= useState(null);
  const [filters, setFilters]   = useState({ search:"", goal:"", level:"", risk:"", status:"" });
  const [profile, setProfile]   = useState(() => {
    const p = cloneProfile(); p.assessment.assessment_date = today(); return p;
  });
  const [step, setStep]         = useState(0);
  const [editingId, setEditing] = useState(null);
  const loggedIn = Boolean(token);

  useEffect(() => {
    request("/api/settings/public","").then(setPub).catch(() => setPub({ admin_seed_enabled: false }));
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (token) refreshAll(); }, [token]);

  async function refreshAll() {
    await Promise.allSettled([loadDashboard(), loadMembers(), loadSettings()]);
  }
  async function loadDashboard() {
    if (!token) return;
    const [stats, due] = await Promise.all([
      request("/api/dashboard/stats", token),
      request("/api/dashboard/reassessments", token),
    ]);
    setDash(stats); setReassess(due);
  }
  async function loadMembers(nf = filters) {
    if (!token) return;
    const p = new URLSearchParams();
    Object.entries(nf).forEach(([k,v]) => { if (v) p.set(k,v); });
    setMembers(await request(`/api/members/?${p}`, token));
  }
  async function loadSettings() {
    if (!token) return;
    setSettings(await request("/api/settings/", token));
  }
  function signOut() {
    setToken(""); setAdmin(null);
    localStorage.removeItem("pfi_token"); localStorage.removeItem("pfi_admin");
    setView("landing");
  }
  async function login(event) {
    event.preventDefault(); setLoginMsg("Authenticating…");
    const d = new FormData(event.currentTarget);
    try {
      const r = await request("/api/auth/login","",{
        method:"POST", body: JSON.stringify({email:d.get("email"),password:d.get("password")}),
      });
      setToken(r.access_token); setAdmin(r.admin);
      localStorage.setItem("pfi_token", r.access_token);
      localStorage.setItem("pfi_admin", JSON.stringify(r.admin));
      setLoginMsg(""); setView("app");
    } catch(e) { setLoginMsg(e.message); }
  }
  async function seedAdmin() {
    setLoginMsg("Creating default admin…");
    try { const r = await request("/api/auth/seed","",{method:"POST",body:"{}"}); setLoginMsg(r.message); }
    catch(e) { setLoginMsg(e.message); }
  }
  function updateField(path, value) {
    setProfile(cur => {
      const next = JSON.parse(JSON.stringify(cur));
      const parts = path.split(".");
      let t = next;
      parts.slice(0,-1).forEach(p => { t=t[p]; });
      t[parts.at(-1)] = value;
      return next;
    });
  }
  function resetProfile() {
    const next = cloneProfile(); next.assessment.assessment_date = today();
    setProfile(next); setStep(0); setEditing(null); setMessage("");
  }
  async function submitMember(event) {
    event.preventDefault();
    setMessage(editingId ? "Updating…" : "Saving…");
    try {
      const saved = await request(
        editingId ? `/api/members/${editingId}` : "/api/members/",
        token,
        { method: editingId?"PUT":"POST", body: JSON.stringify(cleanPayload(profile)) },
      );
      setMessage(`✓ ${editingId?"Updated":"Saved"} — ${saved.first_name} ${saved.last_name}.`);
      resetProfile(); await refreshAll(); setTab("members"); await showMember(saved.id);
    } catch(e) { setMessage(e.message); }
  }
  async function showMember(id) {
    setSelected(await request(`/api/members/${id}`, token));
  }
  async function editMember(id) {
    const m = await request(`/api/members/${id}`, token);
    const latest = [...(m.assessments||[])].sort((a,b)=>String(a.assessment_date).localeCompare(String(b.assessment_date))).pop()||{};
    const mp = latest.mobility_score ? String(latest.mobility_score).split(" / ") : [];
    const next = cloneProfile();
    Object.assign(next.personal,  pick(m, Object.keys(emptyProfile.personal)));
    Object.assign(next.physical,  m.physical_metrics||{});
    Object.assign(next.health,    m.health_profile||{});
    Object.assign(next.lifestyle, m.lifestyle_profile||{});
    Object.assign(next.goals,     m.goals||{});
    Object.assign(next.behavior,  m.motivation_profile||{});
    Object.assign(next.assessment, latest, {
      assessment_date: latest.assessment_date||today(),
      hamstring_flexibility: mp[0]||"", shoulder_mobility: mp[1]||"",
      balance_test: latest.balance_score||"",
    });
    Object.assign(next.consent, {
      privacy_consent: Boolean(m.privacy_consent),
      medical_disclaimer_accepted: Boolean(m.medical_disclaimer_accepted),
      marketing_consent: Boolean(m.marketing_consent),
    });
    next.goals.secondary_goals = Array.isArray(next.goals.secondary_goals)
      ? next.goals.secondary_goals.join(", ") : next.goals.secondary_goals||"";
    setProfile(next); setEditing(id); setStep(0); setTab("intake");
    setMessage(`Editing ${m.first_name} ${m.last_name}.`);
  }

  // ── Delete handlers ────────────────────────────────────
  async function deleteMember(id, name) {
    if (!confirm(`Permanently delete ${name}?\n\nThis removes ALL their data and cannot be undone.`)) return;
    try {
      await request(`/api/members/${id}`, token, { method:"DELETE" });
      setSelected(null); await loadMembers();
    } catch(e) { alert(`Delete failed: ${e.message}`); }
  }
  async function deleteAssessment(assessmentId, memberId) {
    if (!confirm("Delete this assessment record?")) return;
    try {
      await request(`/api/assessments/${assessmentId}`, token, { method:"DELETE" });
      await showMember(memberId);
    } catch(e) { alert(`Delete failed: ${e.message}`); }
  }
  async function deleteProgress(entryId, memberId) {
    if (!confirm("Delete this progress entry?")) return;
    try {
      await request(`/api/progress/${entryId}`, token, { method:"DELETE" });
      await showMember(memberId);
    } catch(e) { alert(`Delete failed: ${e.message}`); }
  }
  async function deletePlan(planType, planId, memberId) {
    if (!confirm(`Delete this ${planType} plan?`)) return;
    try {
      await request(`/api/${planType}-plans/${planId}`, token, { method:"DELETE" });
      await showMember(memberId);
    } catch(e) { alert(`Delete failed: ${e.message}`); }
  }

  async function submitQuick(event, endpoint, label) {
    event.preventDefault(); setTrackMsg(`Saving ${label}…`);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    Object.keys(data).forEach(k => {
      if (data[k]==="") data[k]=null;
      if (["member_id","pushups","squats","plank_seconds","adherence_score","calories_target","protein_target","weekly_frequency","session_duration"].includes(k))
        data[k]=numericOrNull(data[k]);
      if (["weight","waist_measurement","body_fat_percentage","hydration_target"].includes(k))
        data[k]=numericOrNull(data[k]);
    });
    try {
      await request(endpoint, token, {method:"POST", body:JSON.stringify(data)});
      event.currentTarget.reset(); setTrackMsg(`✓ ${label} saved.`); await loadDashboard();
    } catch(e) { setTrackMsg(e.message); }
  }

  const filterOptions = useMemo(() => ({
    goal: unique(members,"primary_goal"), level: unique(members,"fitness_level"),
    risk: unique(members,"risk_level"),   status: unique(members,"status"),
  }), [members]);

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
          <button className="ghost" type="button" onClick={() => setView(loggedIn?"app":"landing")}>Home</button>
          {!loggedIn && <button className="secondary" type="button" onClick={() => setView("login")}>Admin Login</button>}
          {loggedIn  && <button className="ghost"     type="button" onClick={signOut}>Sign out</button>}
        </div>
      </header>

      <main>
        {view === "landing" && <Landing onLogin={() => setView("login")} />}
        {view === "login"   && <Login onSubmit={login} onSeed={seedAdmin} message={loginMsg} seedEnabled={publicSettings?.admin_seed_enabled} />}
        {view === "app" && (
          <section className="workspace">
            <nav className="tabs" aria-label="Workspace">
              {TAB_ITEMS.map(({id, icon, label}) => (
                <button key={id} className={`tab ${tab===id?"active":""}`} type="button" onClick={()=>setTab(id)}>
                  <span className="tab-icon">{icon}</span>{label}
                </button>
              ))}
            </nav>
            {tab==="dashboard" && <Dashboard stats={dashboard} reassessments={reassessments} onRefresh={loadDashboard} onSelectMember={id=>{setTab("members");showMember(id);}} />}
            {tab==="intake"    && <Intake profile={profile} step={step} editingId={editingId} message={message} onField={updateField} onStep={setStep} onSubmit={submitMember} onReset={resetProfile} />}
            {tab==="members"   && <Members members={members} selected={selected} filters={filters} options={filterOptions} onFilter={nf=>{setFilters(nf);loadMembers(nf);}} onRefresh={()=>loadMembers()} onSelect={showMember} onEdit={editMember} onDeleteMember={deleteMember} onDeleteAssessment={deleteAssessment} onDeleteProgress={deleteProgress} onDeletePlan={deletePlan} />}
            {tab==="tracking"  && <Tracking members={members} message={trackMsg} onSubmit={submitQuick} onRefresh={loadMembers} />}
            {tab==="settings"  && <Settings settings={settings} onRefresh={loadSettings} />}
          </section>
        )}
      </main>
    </>
  );
}

// ── Landing ────────────────────────────────────────────────────────
function Landing({ onLogin }) {
  return (
    <section className="landing-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Sports Intelligence OS</p>
          <h2>Train Smarter.<br /><em>Perform Better.</em><br />Become Unstoppable.</h2>
          <p className="hero-subtext">A professional coaching intelligence platform for personalised training, nutrition, supplementation, and progress analytics.</p>
          <div className="hero-actions">
            <button type="button" onClick={onLogin}>Get Started</button>
            <button className="secondary" type="button" onClick={onLogin}>Admin Login</button>
          </div>
          <div className="hero-tag">
            {[["1,200+","Data Points"],["7","Intelligence Scores"],["∞","Member Capacity"]].map(([n,l])=>(
              <div className="hero-tag-item" key={l}><strong>{n}</strong>{l}</div>
            ))}
          </div>
        </div>
        <div className="performance-panel">
          <div className="scanline" aria-hidden="true" />
          <div className="panel-header">
            <span className="panel-header-label">PFI Live Profile</span>
            <span className="live-badge"><span className="live-dot" />Live</span>
          </div>
          <div className="hero-metrics">
            {[["cyan","Strength Index","84"],["purple","Recovery Score","72"],["lime","Mobility Rating","91"],["blue","Goal Progress","63%"]].map(([color,label,value])=>(
              <div className={`metric-card ${color}`} key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </div>
          <div className="signal-bars" aria-hidden="true">
            {[38,62,48,82,56,90,68].map((h,i)=><span key={i} style={{height:`${h}%`,animationDelay:`${i*0.07}s`}} />)}
          </div>
        </div>
      </section>
      <section className="feature-grid">
        {[["🔬","Personalised Profiles","Deep member data — metrics, health history, lifestyle, and goals."],["💪","Smart Plan Generation","Coaching-ready workout, nutrition, and supplement blueprints."],["📈","Progress Intelligence","Track body metrics with real-time trend analytics."],["🎯","AI Scoring Engine","Recovery, injury risk, strength index, and compliance — automated."]].map(([icon,t,d])=>(
          <article className="panel glow-card" key={t}><span className="glow-card-icon">{icon}</span><h3>{t}</h3><p>{d}</p></article>
        ))}
      </section>
      <section className="how-grid">
        <div className="section-title"><h2>How PFI Works</h2><span className="section-label">Register → Assess → Profile → Plan → Track → Adapt</span></div>
        <div className="steps">
          {["Register","Assess","Profile","Plan","Track","Adapt"].map((label,i)=>(
            <div className="step-item" key={label}><span className="step-num">{String(i+1).padStart(2,"0")}</span><strong>{label}</strong></div>
          ))}
        </div>
      </section>
      <footer className="landing-footer"><span>PFI Platform</span><span>Fitness Intelligence for Serious Coaches</span><span>Private — Admin Access Only</span></footer>
    </section>
  );
}

// ── Login ──────────────────────────────────────────────────────────
function Login({ onSubmit, onSeed, message, seedEnabled }) {
  const isError = message && (message.toLowerCase().includes("invalid")||message.toLowerCase().includes("failed")||message.toLowerCase().includes("disabled"));
  return (
    <section className="auth-shell">
      <form className="panel auth-panel" onSubmit={onSubmit}>
        <p className="auth-eyebrow">⚡ Admin Access</p>
        <h2>Staff Login</h2>
        <p className="muted text-sm" style={{marginTop:"6px"}}>Enter your credentials to access the platform.</p>
        <div className="auth-form-fields">
          <label>Email Address<input name="email" type="email" defaultValue="admin@pfi-platform.local" autoComplete="username" required /></label>
          <label>Password<input name="password" type="password" defaultValue="admin123" autoComplete="current-password" required /></label>
        </div>
        <div className="form-actions">
          <button type="submit">Sign in →</button>
          {seedEnabled && <button className="secondary" type="button" onClick={onSeed}>Create default admin</button>}
        </div>
        {message && <p className={`message ${isError?"error":"ok"}`} style={{marginTop:"14px"}}>{isError?"⚠ ":"✓ "}{message}</p>}
      </form>
    </section>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────
function Dashboard({ stats, reassessments, onRefresh, onSelectMember }) {
  const s = stats || {};
  const statCards = [
    { label:"Total Members",  value:s.total_members??0,  color:"cyan",   icon:"👥" },
    { label:"Active",         value:s.active_members??0, color:"purple", icon:"⚡" },
    { label:"New This Month", value:s.new_this_month??0, color:"lime",   icon:"🆕" },
    { label:"High Risk",      value:s.high_risk??0,      color:"danger", icon:"⚠" },
  ];
  const critical = reassessments.filter(r=>r.urgency==="critical").length;

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>Command Centre</h2>
          <p className="muted text-sm" style={{marginTop:"4px"}}>Platform intelligence snapshot</p>
        </div>
        <div className="section-title-right">
          {critical > 0 && <span className="badge high">⚠ {critical} critical</span>}
          <button className="ghost" type="button" onClick={onRefresh}>↻ Refresh</button>
        </div>
      </div>

      <div className="stats-grid">
        {statCards.map(({label,value,color,icon}) => (
          <div className={`stat-card ${color}`} key={label}>
            <div className="stat-card-top">
              <span className="stat-card-label">{label}</span>
              <span className="stat-icon">{icon}</span>
            </div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-lower">
        {/* Recent members */}
        <section className="panel">
          <h3>Recent Members</h3>
          <div className="list">
            {(s.recent||[]).length ? (s.recent||[]).map((m,i) => (
              <div className="list-item" key={m.id} onClick={() => onSelectMember(m.id)} role="button" tabIndex={0}>
                <div className={`list-item-avatar avatar-${avatarVariant(i)}`}>{initials(m.name?.split(" ")[0],m.name?.split(" ")[1])}</div>
                <div className="list-item-info">
                  <div className="list-item-name">{m.name}</div>
                  <div className="list-item-meta">{m.goal||"No goal"} · {m.level||"No level"}</div>
                </div>
                <Badge value={m.risk||"Low"} />
              </div>
            )) : <p className="muted text-sm">No members yet.</p>}
          </div>

          {/* Platform health scores */}
          <div style={{marginTop:"24px"}}>
            <h4>Platform Health</h4>
            <div className="intel-score-list">
              {[
                ["Members on file", Math.min(100, (s.total_members||0)*10), "cyan"],
                ["Active rate", s.total_members ? Math.round((s.active_members/s.total_members)*100) : 0, "lime"],
                ["Risk load",   s.total_members ? Math.round(((s.high_risk||0)/s.total_members)*100) : 0, "danger"],
              ].map(([label,value,color]) => <ScoreBar key={label} label={label} value={value} color={color} />)}
            </div>
          </div>
        </section>

        {/* Reassessment alerts */}
        <section className="panel">
          <h3>🔔 Reassessment Alerts</h3>
          {reassessments.length === 0
            ? <div className="empty-state"><span className="empty-state-icon">✅</span>All active members are up to date.</div>
            : (
              <>
                {critical > 0 && <p className="muted text-xs" style={{marginBottom:"10px"}}>⚠ {critical} member{critical!==1?"s":""} critically overdue (&gt;30 days)</p>}
                <div className="alert-list">
                  {reassessments.slice(0,8).map(r => (
                    <div
                      key={r.member_id}
                      className={`alert-row ${r.urgency}`}
                      onClick={() => onSelectMember(r.member_id)}
                      role="button"
                      tabIndex={0}
                      style={{cursor:"pointer"}}
                    >
                      <span className="alert-urgency-dot" />
                      <div className="alert-info">
                        <div className="alert-name">{r.name}</div>
                        <div className="alert-meta">
                          Due {r.due_date}{r.last_assessment ? ` · Last ${r.last_assessment}` : " · Never assessed"}
                        </div>
                      </div>
                      <div className="alert-days">
                        {r.days_overdue > 0
                          ? `${r.days_overdue}d overdue`
                          : r.days_overdue === 0
                            ? "Due today"
                            : `Due in ${Math.abs(r.days_overdue)}d`}
                      </div>
                    </div>
                  ))}
                </div>
                {reassessments.length > 8 && (
                  <p className="muted text-xs" style={{marginTop:"10px",textAlign:"center"}}>
                    +{reassessments.length-8} more — go to Members to see all
                  </p>
                )}
              </>
            )
          }
        </section>
      </div>
    </section>
  );
}

function ScoreBar({ label, value, color }) {
  return (
    <div className="intel-score-row">
      <div className="intel-score-header">
        <span className="intel-score-label">{label}</span>
        <span className="intel-score-value">{value}%</span>
      </div>
      <div className="score-track">
        <div className={`score-fill ${color}`} style={{width:`${Math.min(100,Math.max(0,value))}%`}} />
      </div>
    </div>
  );
}

// ── Intake wizard ──────────────────────────────────────────────────
function Intake({ profile, step, editingId, message, onField, onStep, onSubmit, onReset }) {
  const [errors, setErrors] = useState({});
  function handleNext() {
    const e = validateStep(step, profile);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); onStep(step+1);
  }
  function handleStepClick(i) {
    if (i < step) { onStep(i); return; }
    const e = validateStep(step, profile);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); onStep(i);
  }
  const fp = { profile, onField, errors };
  const msgIsError = message && !message.startsWith("✓");
  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>{editingId ? "Edit Member Profile" : "New Member Intake"}</h2>
          <p className="muted text-sm" style={{marginTop:"4px"}}>Step {step+1} of {WIZARD_STEPS.length} — {WIZARD_STEPS[step].subtitle}</p>
        </div>
        <button className="ghost" type="button" onClick={onReset}>{editingId?"Cancel edit":"Clear form"}</button>
      </div>
      <div className="wizard-progress-bar" role="tablist">
        {WIZARD_STEPS.map(({label,icon},i) => (
          <button key={label} className={`wizard-step-btn ${step===i?"active":""} ${i<step?"completed":""}`} type="button" role="tab" aria-selected={step===i} onClick={()=>handleStepClick(i)}>
            <span className="step-num-circle">{i<step?"✓":i+1}</span>
            {icon} {label}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit}>
        <div className="intake-grid">
          <div className="intake-step-header">
            <span className="intake-step-icon">{WIZARD_STEPS[step].icon}</span>
            <div>
              <div className="intake-step-title">{WIZARD_STEPS[step].label}</div>
              <div className="intake-step-subtitle">{WIZARD_STEPS[step].subtitle}</div>
            </div>
          </div>
          <div className="intake-step-body">
            {step===0 && <Identity {...fp} />}
            {step===1 && <Physical {...fp} />}
            {step===2 && <Health   {...fp} />}
            {step===3 && <Lifestyle {...fp} />}
            {step===4 && <Goals    {...fp} />}
            {step===5 && <Behavior {...fp} />}
            {step===6 && <Baseline {...fp} />}
          </div>
          <div className="wide-actions">
            <button className="secondary" type="button" disabled={step===0} onClick={()=>onStep(step-1)}>← Previous</button>
            {step < WIZARD_STEPS.length-1 && <button type="button" onClick={handleNext}>Next →</button>}
            {step === WIZARD_STEPS.length-1 && <button type="submit">{editingId?"Update profile →":"Save profile →"}</button>}
            {message && <span className={`message ${msgIsError?"error":"ok"}`}>{message}</span>}
          </div>
        </div>
      </form>
    </section>
  );
}

// ── Field primitives ───────────────────────────────────────────────
function Field({ profile, path, label, type="text", options, textarea, required, min, max, step: s, onField, placeholder, errors={}, wide }) {
  const value    = deepValue(profile, path);
  const hasError = errors[path];
  const cls      = hasError ? "field-error" : "";
  const common   = { required, className: cls };
  let control;
  if (options) {
    control = <select {...common} value={value??""} onChange={e=>onField(path,e.target.value)}>{options.map(o=><option key={o} value={o}>{o||"— Select —"}</option>)}</select>;
  } else if (textarea) {
    control = <textarea {...common} value={value??""} onChange={e=>onField(path,e.target.value)} />;
  } else {
    control = <input {...common} type={type} min={min} max={max} step={s} placeholder={placeholder} value={value??""} onChange={e=>onField(path,e.target.value)} />;
  }
  return (
    <label className={wide?"wide":""}>
      {label}{required && <span style={{color:"var(--danger)"}}> *</span>}
      {control}
      {hasError && <span className="field-error-msg">⚠ {hasError}</span>}
    </label>
  );
}

function Checkbox({ profile, path, label, required, onField, errors={} }) {
  const checked  = Boolean(deepValue(profile, path));
  const hasError = errors[path];
  return (
    <div className={`check-row wide ${hasError?"field-error":""}`}>
      <input required={required} type="checkbox" checked={checked} onChange={e=>onField(path,e.target.checked)} id={path} />
      <label htmlFor={path}>{label}{required&&<span style={{color:"var(--danger)"}}> *</span>}</label>
    </div>
  );
}

// ── Wizard steps ───────────────────────────────────────────────────
function Identity({profile,onField,errors}) {
  const f=(path,label,opts={})=><Field key={path} profile={profile} path={path} label={label} onField={onField} errors={errors} {...opts} />;
  return (<>
    {f("personal.first_name","First name",{required:true})} {f("personal.last_name","Last name",{required:true})}
    {f("personal.email","Email",{type:"email",required:true})} {f("personal.phone","Phone",{required:true})}
    {f("personal.date_of_birth","Date of birth",{type:"date",required:true})} {f("personal.gender","Gender",{options:["","Female","Male","Non-binary","Prefer not to say"]})}
    {f("personal.status","Status",{options:["Active","Inactive","Paused"]})} {f("personal.occupation","Occupation")}
    {f("personal.location","Location")} {f("personal.preferred_training_time","Preferred time",{options:["","Early morning","Morning","Lunch","Afternoon","Evening"]})}
    {f("personal.emergency_contact_name","Emergency contact",{required:true})} {f("personal.emergency_contact_phone","Emergency phone",{required:true})}
  </>);
}
function Physical({profile,onField,errors}) {
  const f=(path,label,opts={})=><Field key={path} profile={profile} path={path} label={label} onField={onField} errors={errors} {...opts} />;
  return (<>
    {f("physical.height","Height (cm)",{type:"number",min:"80",max:"260",step:"0.1",required:true})}
    {f("physical.weight","Weight (kg)",{type:"number",min:"20",max:"350",step:"0.1",required:true})}
    {f("physical.body_fat_percentage","Body fat %",{type:"number",min:"0",max:"80",step:"0.1"})}
    {f("physical.waist_measurement","Waist (cm)",{type:"number",min:"20",max:"250",step:"0.1"})}
    {f("physical.resting_heart_rate","Resting HR",{type:"number",min:"30",max:"220"})}
    {f("physical.blood_pressure","Blood pressure",{placeholder:"120/80"})}
    {f("physical.mobility_score","Mobility score (1–10)",{type:"number",min:"1",max:"10"})}
    {f("physical.fitness_level","Fitness level",{options:["Beginner","Intermediate","Advanced","Athlete"]})}
  </>);
}
function Health({profile,onField,errors}) {
  const f=(path,label,opts={})=><Field key={path} profile={profile} path={path} label={label} onField={onField} errors={errors} {...opts} />;
  return (<>
    <p className="form-note wide">⚕ PFI does not replace medical advice. High-risk members should seek medical clearance before intense exercise.</p>
    {f("health.injuries","Injuries",{textarea:true})} {f("health.pain_areas","Pain areas",{textarea:true})}
    {f("health.previous_surgeries","Previous surgeries",{textarea:true})} {f("health.chronic_conditions","Chronic conditions",{textarea:true})}
    {f("health.medications","Medications",{textarea:true})}
    {f("health.medical_clearance_required","Clearance required",{options:["No","Yes"]})}
    {f("health.medical_clearance_received","Clearance received",{options:["No","Yes"]})}
    {f("health.risk_level","Risk level",{options:["Low","Medium","High"]})}
    <Field profile={profile} path="health.notes" label="Health notes" textarea onField={onField} errors={errors} wide />
  </>);
}
function Lifestyle({profile,onField,errors}) {
  const f=(path,label,opts={})=><Field key={path} profile={profile} path={path} label={label} onField={onField} errors={errors} {...opts} />;
  return (<>
    {f("lifestyle.sleep_hours","Sleep hours",{type:"number",min:"0",max:"16",step:"0.5"})}
    {f("lifestyle.stress_level","Stress level",{options:["","Low","Medium","High"]})}
    {f("lifestyle.activity_level","Activity level",{options:["","Sedentary","Lightly Active","Active","Very Active"]})}
    {f("lifestyle.work_schedule","Work schedule")} {f("lifestyle.travel_frequency","Travel frequency")}
    {f("lifestyle.water_intake","Water (litres)",{type:"number",min:"0",max:"12",step:"0.1"})}
    {f("lifestyle.smoking","Smoking")} {f("lifestyle.alcohol","Alcohol")}
    {f("lifestyle.recovery_capacity","Recovery capacity",{options:["","Low","Medium","High"]})}
    <Field profile={profile} path="lifestyle.nutrition_habits" label="Nutrition habits" textarea onField={onField} errors={errors} wide />
  </>);
}
function Goals({profile,onField,errors}) {
  const f=(path,label,opts={})=><Field key={path} profile={profile} path={path} label={label} onField={onField} errors={errors} {...opts} />;
  return (<>
    {f("goals.primary_goal","Primary goal",{options:["Fat Loss","Muscle Gain","Strength","Sports Performance","Mobility","General Fitness","Rehabilitation"],required:true})}
    {f("goals.secondary_goals","Secondary goals",{placeholder:"Strength, Mobility"})}
    {f("goals.fat_loss_pct","Fat loss %",{type:"number",min:"0",max:"100"})}
    {f("goals.strength_pct","Strength %",{type:"number",min:"0",max:"100"})}
    {f("goals.mobility_pct","Mobility %",{type:"number",min:"0",max:"100"})}
    {f("goals.performance_pct","Performance %",{type:"number",min:"0",max:"100"})}
    {f("goals.target_weight","Target weight",{type:"number",min:"20",max:"350",step:"0.1"})}
    {f("goals.target_date","Target date",{type:"date"})}
    <Field profile={profile} path="goals.coach_notes" label="Coach notes" textarea onField={onField} errors={errors} wide />
  </>);
}
function Behavior({profile,onField,errors}) {
  const f=(path,label,opts={})=><Field key={path} profile={profile} path={path} label={label} onField={onField} errors={errors} {...opts} />;
  return (<>
    {f("behavior.motivation_type","Motivation type",{options:["Competitive","Coaching-driven","Self-motivated","Accountability-driven","Social"],required:true})}
    {f("behavior.coaching_style","Coaching style",{options:["Strict","Friendly","Encouraging","Technical"],required:true})}
    {f("behavior.workout_preference","Workout preference",{options:["","Solo","Partner","Group"]})}
    {f("behavior.training_frequency","Training days/week",{type:"number",min:"0",max:"14"})}
    {f("behavior.session_duration","Session minutes",{type:"number",min:"10",max:"240"})}
    {f("behavior.gamification","Gamification",{options:["No","Yes"]})}
    {f("behavior.notification_frequency","Notifications",{placeholder:"Weekly"})}
  </>);
}
function Baseline({profile,onField,errors}) {
  const f=(path,label,opts={})=><Field key={path} profile={profile} path={path} label={label} onField={onField} errors={errors} {...opts} />;
  return (<>
    {f("assessment.assessment_date","Assessment date",{type:"date",required:true})}
    {f("assessment.pushups","Pushups",{type:"number",min:"0"})}
    {f("assessment.squats","Squats",{type:"number",min:"0"})}
    {f("assessment.plank_seconds","Plank (seconds)",{type:"number",min:"0"})}
    {f("assessment.cardio_result","Cardio result",{placeholder:"05:30"})}
    {f("assessment.hamstring_flexibility","Hamstring flex")}
    {f("assessment.shoulder_mobility","Shoulder mobility")}
    {f("assessment.balance_test","Balance test")}
    <Field profile={profile} path="assessment.overall_notes" label="Overall notes" textarea onField={onField} errors={errors} wide />
    <p className="form-note info wide">🔒 Member data is private and visible only to authorised admins. Consent is required to store and use this profile.</p>
    <Checkbox profile={profile} path="consent.medical_disclaimer_accepted" label="Medical disclaimer accepted" required onField={onField} errors={errors} />
    <Checkbox profile={profile} path="consent.privacy_consent" label="Privacy notice and member data consent accepted" required onField={onField} errors={errors} />
    <Checkbox profile={profile} path="consent.marketing_consent" label="Optional — communication and program update consent" onField={onField} errors={errors} />
  </>);
}

// ── Members ────────────────────────────────────────────────────────
function Members({ members, selected, filters, options, onFilter, onRefresh, onSelect, onEdit, onDeleteMember, onDeleteAssessment, onDeleteProgress, onDeletePlan }) {
  const set = (k,v) => onFilter({...filters,[k]:v});
  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>Member Directory</h2>
          <p className="muted text-sm" style={{marginTop:"4px"}}>{members.length} member{members.length!==1?"s":""} loaded</p>
        </div>
        <button className="ghost" type="button" onClick={onRefresh}>↻ Refresh</button>
      </div>
      <div className="filters">
        <label>Search<input value={filters.search} onChange={e=>set("search",e.target.value)} placeholder="Name, email, goal…" /></label>
        <Filter label="Goal"   value={filters.goal}   values={options.goal}   onChange={v=>set("goal",v)} />
        <Filter label="Level"  value={filters.level}  values={options.level}  onChange={v=>set("level",v)} />
        <Filter label="Risk"   value={filters.risk}   values={options.risk}   onChange={v=>set("risk",v)} />
        <Filter label="Status" value={filters.status} values={options.status} onChange={v=>set("status",v)} />
      </div>
      <div className="directory detail-expanded">
        <div className="panel table-shell">
          <table>
            <thead><tr><th>Member</th><th>Goal</th><th>Level</th><th>Risk</th><th>Status</th></tr></thead>
            <tbody>
              {members.length ? members.map(m => (
                <tr key={m.id} onClick={()=>onSelect(m.id)}>
                  <td><strong>{m.first_name} {m.last_name}</strong><br /><small style={{color:"var(--dim)"}}>{m.email}</small></td>
                  <td>{m.primary_goal}</td><td>{m.fitness_level}</td>
                  <td><Badge value={m.risk_level||"Low"} /></td>
                  <td><Badge value={m.status||""} /></td>
                </tr>
              )) : (
                <tr><td colSpan="5" style={{textAlign:"center",color:"var(--dim)",padding:"32px"}}>No members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <aside className="panel detail-panel">
          {selected
            ? <MemberDetail member={selected} onEdit={onEdit} onDeleteMember={onDeleteMember} onDeleteAssessment={onDeleteAssessment} onDeleteProgress={onDeleteProgress} onDeletePlan={onDeletePlan} />
            : <div style={{textAlign:"center",padding:"32px 16px"}}><p style={{fontSize:"32px",marginBottom:"12px"}}>👆</p><p className="muted text-sm">Select a member to view their intelligence profile.</p></div>
          }
        </aside>
      </div>
    </section>
  );
}

// ── Member detail — inner tabs ─────────────────────────────────────
function MemberDetail({ member, onEdit, onDeleteMember, onDeleteAssessment, onDeleteProgress, onDeletePlan }) {
  const [innerTab, setInnerTab] = useState("overview");
  const computed  = member.computed || {};
  const variant   = avatarVariant(member.id);

  const INNER_TABS = [
    { id:"overview",  label:"Overview" },
    { id:"progress",  label:`Progress (${(member.progress_entries||[]).length})` },
    { id:"plans",     label:`Plans (${(member.workout_plans||[]).length+(member.nutrition_plans||[]).length+(member.supplement_plans||[]).length})` },
    { id:"manage",    label:"Manage" },
  ];

  return (
    <>
      {/* Profile header */}
      <div className="member-profile-header">
        <div className={`member-avatar avatar-${variant}`}>{initials(member.first_name,member.last_name)}</div>
        <div>
          <div className="member-profile-name">{member.first_name} {member.last_name}</div>
          <div className="member-profile-email">{member.email}</div>
          {member.phone && <div className="member-profile-email">{member.phone}</div>}
          <div className="member-profile-badges">
            <Badge value={member.risk_level||"Low"} />
            <Badge value={member.status||"Active"} />
            {member.fitness_level && <Badge value={member.fitness_level} />}
          </div>
        </div>
      </div>

      {/* Inner tabs */}
      <div className="detail-inner-tabs">
        {INNER_TABS.map(({id,label}) => (
          <button key={id} className={`detail-inner-tab ${innerTab===id?"active":""}`} type="button" onClick={()=>setInnerTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {innerTab === "overview"  && <OverviewTab member={member} computed={computed} onEdit={onEdit} />}
      {innerTab === "progress"  && <ProgressTab member={member} onDeleteAssessment={onDeleteAssessment} onDeleteProgress={onDeleteProgress} />}
      {innerTab === "plans"     && <PlansTab member={member} onDeletePlan={onDeletePlan} />}
      {innerTab === "manage"    && <ManageTab member={member} onEdit={onEdit} onDeleteMember={onDeleteMember} />}
    </>
  );
}

// ── Overview tab ───────────────────────────────────────────────────
function OverviewTab({ member, computed, onEdit }) {
  const scores = [
    { label:"Recovery",   value:computed.recovery_score,           color:scoreColor(computed.recovery_score) },
    { label:"Strength",   value:computed.strength_index,           color:scoreColor(computed.strength_index) },
    { label:"Cardio",     value:computed.cardiovascular_score,     color:scoreColor(computed.cardiovascular_score) },
    { label:"Mobility",   value:computed.mobility_rating,          color:scoreColor(computed.mobility_rating) },
    { label:"Compliance", value:computed.compliance_probability,   color:scoreColor(computed.compliance_probability) },
    { label:"Inj. Risk",  value:computed.injury_risk_score,        color: computed.injury_risk_score>50?"danger":scoreColor(computed.injury_risk_score) },
  ];
  return (
    <>
      <div className="intel-section">
        <h4>Key Metrics</h4>
        <div className="detail-grid">
          <div className="detail-metric"><span>Primary Goal</span><strong style={{fontSize:"14px"}}>{member.primary_goal||"—"}</strong></div>
          <div className="detail-metric"><span>BMI</span><strong>{member.physical_metrics?.bmi||"—"}</strong></div>
          <div className="detail-metric"><span>Fitness Age</span><strong>{computed.fitness_age||"—"}</strong></div>
          <div className="detail-metric"><span>Segment</span><strong style={{fontSize:"13px"}}>{computed.member_segment||"—"}</strong></div>
          <div className="detail-metric"><span>Progress Logs</span><strong>{(member.progress_entries||[]).length}</strong></div>
          <div className="detail-metric"><span>Assessments</span><strong>{(member.assessments||[]).length}</strong></div>
        </div>
      </div>
      <div className="intel-section">
        <h4>Intelligence Scores</h4>
        <div className="profile-scores">
          {scores.map(({label,value,color}) => (
            <div className="profile-score-row" key={label}>
              <span className="profile-score-label">{label}</span>
              <div className="profile-score-track">
                <div className={`profile-score-fill score-fill ${color}`} style={{width:`${Math.min(100,Math.max(0,value||0))}%`}} />
              </div>
              <span className="profile-score-val">{value!=null?`${value}%`:"—"}</span>
            </div>
          ))}
        </div>
      </div>
      {(member.goals?.coach_notes||member.health_profile?.notes) && (
        <div className="intel-section">
          <h4>Coach Notes</h4>
          <p className="muted text-sm" style={{lineHeight:"1.6"}}>{member.goals?.coach_notes||member.health_profile?.notes}</p>
        </div>
      )}
      <button className="secondary" type="button" onClick={()=>onEdit(member.id)} style={{width:"100%"}}>✏ Edit Profile</button>
    </>
  );
}

// ── Progress tab ───────────────────────────────────────────────────
function ProgressTab({ member, onDeleteAssessment, onDeleteProgress }) {
  const progress    = useMemo(()=>[...(member.progress_entries||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date))), [member]);
  const assessments = useMemo(()=>[...(member.assessments||[])].sort((a,b)=>String(a.assessment_date).localeCompare(String(b.assessment_date))), [member]);

  return (
    <>
      {/* Trend chart */}
      <div className="intel-section">
        <TrendChart entries={progress} />
      </div>

      {/* Assessment history */}
      <div className="intel-section">
        <h4>Assessment History ({assessments.length})</h4>
        {assessments.length === 0
          ? <div className="empty-state"><span className="empty-state-icon">📊</span>No assessments recorded.</div>
          : (
            <div className="history-list">
              {[...assessments].reverse().map(a => (
                <div className="history-row" key={a.id}>
                  <div>
                    <div className="history-row-date">{a.assessment_date}</div>
                    <div className="history-row-chips">
                      {a.pushups!=null      && <span className="history-chip highlight">{a.pushups} pushups</span>}
                      {a.squats!=null       && <span className="history-chip highlight">{a.squats} squats</span>}
                      {a.plank_seconds!=null && <span className="history-chip highlight">{a.plank_seconds}s plank</span>}
                      {a.cardio_result      && <span className="history-chip">Cardio {a.cardio_result}</span>}
                      {a.mobility_score     && <span className="history-chip">Mobility {a.mobility_score}</span>}
                      {a.balance_score      && <span className="history-chip">Balance {a.balance_score}</span>}
                    </div>
                    {a.overall_notes && <div className="history-row-note">{a.overall_notes}</div>}
                  </div>
                  <button className="delete-btn" type="button" title="Delete assessment" onClick={()=>onDeleteAssessment(a.id,member.id)}>🗑</button>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* Progress entries */}
      <div className="intel-section">
        <h4>Progress Entries ({progress.length})</h4>
        {progress.length === 0
          ? <div className="empty-state"><span className="empty-state-icon">📈</span>No progress entries yet.</div>
          : (
            <div className="history-list">
              {[...progress].reverse().map(e => (
                <div className="history-row" key={e.id}>
                  <div>
                    <div className="history-row-date">{e.date}</div>
                    <div className="history-row-chips">
                      {e.weight!=null            && <span className="history-chip highlight">{e.weight} kg</span>}
                      {e.waist_measurement!=null && <span className="history-chip">{e.waist_measurement} cm waist</span>}
                      {e.body_fat_percentage!=null && <span className="history-chip">{e.body_fat_percentage}% BF</span>}
                      {e.adherence_score!=null   && <span className="history-chip">{e.adherence_score}% adherence</span>}
                    </div>
                    {e.progress_note && <div className="history-row-note">{e.progress_note}</div>}
                    {e.coach_note    && <div className="history-row-note" style={{color:"var(--cyan)",marginTop:"4px"}}>Coach: {e.coach_note}</div>}
                  </div>
                  <button className="delete-btn" type="button" title="Delete entry" onClick={()=>onDeleteProgress(e.id,member.id)}>🗑</button>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </>
  );
}

// ── Pure SVG trend chart ───────────────────────────────────────────
function TrendChart({ entries }) {
  const W = 340, H = 110;
  const PAD = { t:10, r:10, b:24, l:34 };
  const IW = W - PAD.l - PAD.r;
  const IH = H - PAD.t - PAD.b;

  // Build series: weight and body_fat_percentage
  const pts = entries.filter(e => e.weight!=null || e.body_fat_percentage!=null);
  if (pts.length < 2) {
    return (
      <div className="chart-container">
        <div className="chart-title">Progress Trend</div>
        <div className="chart-empty">
          <span style={{fontSize:"24px",opacity:0.4}}>📈</span>
          Log at least 2 progress entries to see the trend chart.
        </div>
      </div>
    );
  }

  function buildLine(key, data, color) {
    const vals = data.map(d => d[key]).filter(v => v != null);
    if (vals.length < 2) return null;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const n = data.length;
    const points = data.map((d, i) => {
      const v = d[key];
      if (v == null) return null;
      const x = PAD.l + (i / (n - 1)) * IW;
      const y = PAD.t + IH - ((v - min) / range) * IH;
      return { x, y, v };
    }).filter(Boolean);
    const poly = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    return { poly, points, min, max, color };
  }

  const weightLine  = buildLine("weight",          pts, "#00e5ff");
  const bfLine      = buildLine("body_fat",        pts, "#a3ff12");
  const adhereLine  = buildLine("adherence",       pts, "#a855f7");

  // X axis labels (show up to 5 evenly spaced dates)
  const labelIdxs = pts.length <= 5
    ? pts.map((_,i)=>i)
    : [0, Math.round(pts.length/4), Math.round(pts.length/2), Math.round(3*pts.length/4), pts.length-1];
  const xLabels = labelIdxs.map(i => ({
    i,
    x: PAD.l + (i / (pts.length-1)) * IW,
    label: pts[i].date?.slice(5), // MM-DD
  }));

  return (
    <div className="chart-container">
      <div className="chart-title">Progress Trend</div>
      <div className="chart-legend">
        {weightLine  && <span className="chart-legend-item"><span className="legend-dot" style={{background:"#00e5ff",boxShadow:"0 0 6px #00e5ff"}} />Weight (kg)</span>}
        {bfLine      && <span className="chart-legend-item"><span className="legend-dot" style={{background:"#a3ff12",boxShadow:"0 0 6px #a3ff12"}} />Body fat %</span>}
        {adhereLine  && <span className="chart-legend-item"><span className="legend-dot" style={{background:"#a855f7",boxShadow:"0 0 6px #a855f7"}} />Adherence %</span>}
      </div>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} aria-label="Progress trend chart">
        {/* Grid lines */}
        {[0,0.25,0.5,0.75,1].map(f => (
          <line key={f} x1={PAD.l} y1={PAD.t+f*IH} x2={W-PAD.r} y2={PAD.t+f*IH}
            stroke="rgba(130,219,255,0.08)" strokeWidth="1" />
        ))}

        {/* Lines */}
        {[weightLine, bfLine, adhereLine].filter(Boolean).map((line,i) => (
          <g key={i}>
            <polyline points={line.poly} fill="none" stroke={line.color} strokeWidth="2" strokeLinejoin="round"
              style={{filter:`drop-shadow(0 0 4px ${line.color})`}} />
            {line.points.map((p,j) => (
              <circle key={j} cx={p.x} cy={p.y} r="3" fill={line.color}
                style={{filter:`drop-shadow(0 0 4px ${line.color})`}}>
                <title>{p.v}</title>
              </circle>
            ))}
          </g>
        ))}

        {/* X axis labels */}
        {xLabels.map(({x,label},i) => (
          <text key={i} x={x} y={H-4} textAnchor="middle"
            fill="rgba(122,150,188,0.8)" fontSize="9" fontFamily="inherit">{label}</text>
        ))}

        {/* Y axis label */}
        {weightLine && (
          <text x={PAD.l-2} y={PAD.t} textAnchor="end" fill="rgba(0,229,255,0.6)" fontSize="9" fontFamily="inherit">
            {weightLine.max}
          </text>
        )}
      </svg>
    </div>
  );
}

// ── Plans tab ──────────────────────────────────────────────────────
function PlansTab({ member, onDeletePlan }) {
  const workout    = member.workout_plans    || [];
  const nutrition  = member.nutrition_plans  || [];
  const supplement = member.supplement_plans || [];

  const empty = workout.length===0 && nutrition.length===0 && supplement.length===0;
  if (empty) return <div className="empty-state" style={{minHeight:"140px"}}><span className="empty-state-icon">📋</span>No plans created yet. Use the Tracking tab to add plans.</div>;

  return (
    <>
      {workout.length > 0 && (
        <div className="intel-section">
          <div className="plan-section-label">💪 Workout Plans ({workout.length})</div>
          <div className="plans-stack">
            {workout.map(p => (
              <div className="plan-card" key={p.id}>
                <div className="plan-card-header">
                  <div>
                    <div className="plan-card-name">{p.plan_name}</div>
                    <div className="plan-card-meta">
                      <Badge value={p.status||"Draft"} />
                      {p.goal_type     && <span className="history-chip">{p.goal_type}</span>}
                      {p.weekly_frequency && <span className="history-chip">{p.weekly_frequency}×/week</span>}
                      {p.intensity_level  && <span className="history-chip">{p.intensity_level}</span>}
                    </div>
                  </div>
                  <button className="delete-btn" type="button" title="Delete plan" onClick={()=>onDeletePlan("workout",p.id,member.id)}>🗑</button>
                </div>
                {p.notes && <p className="history-row-note">{p.notes}</p>}
                {p.injury_considerations && <p className="history-row-note" style={{color:"var(--warn)"}}>⚠ {p.injury_considerations}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {nutrition.length > 0 && (
        <div className="intel-section">
          <div className="plan-section-label">🥗 Nutrition Plans ({nutrition.length})</div>
          <div className="plans-stack">
            {nutrition.map(p => (
              <div className="plan-card" key={p.id}>
                <div className="plan-card-header">
                  <div>
                    <div className="plan-card-name">{p.nutrition_goal||"Nutrition Plan"}</div>
                    <div className="plan-card-meta">
                      <Badge value={p.status||"Draft"} />
                      {p.calories_target && <span className="history-chip">{p.calories_target} kcal</span>}
                      {p.protein_target  && <span className="history-chip">{p.protein_target}g protein</span>}
                      {p.hydration_target && <span className="history-chip">{p.hydration_target}L hydration</span>}
                    </div>
                  </div>
                  <button className="delete-btn" type="button" title="Delete plan" onClick={()=>onDeletePlan("nutrition",p.id,member.id)}>🗑</button>
                </div>
                {p.dietary_restrictions && <p className="history-row-note">Restrictions: {p.dietary_restrictions}</p>}
                {p.coach_notes && <p className="history-row-note" style={{color:"var(--cyan)"}}>Coach: {p.coach_notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {supplement.length > 0 && (
        <div className="intel-section">
          <div className="plan-section-label">💊 Supplement Plans ({supplement.length})</div>
          <div className="plans-stack">
            {supplement.map(p => (
              <div className="plan-card" key={p.id}>
                <div className="plan-card-header">
                  <div>
                    <div className="plan-card-name">{p.supplement_name}</div>
                    <div className="plan-card-meta">
                      <Badge value={p.status||"Draft"} />
                      {p.suggested_timing && <span className="history-chip">⏱ {p.suggested_timing}</span>}
                      {p.purpose && <span className="history-chip">{p.purpose}</span>}
                    </div>
                  </div>
                  <button className="delete-btn" type="button" title="Delete plan" onClick={()=>onDeletePlan("supplement",p.id,member.id)}>🗑</button>
                </div>
                {p.safety_notes && <p className="history-row-note" style={{color:"var(--warn)"}}>⚠ Safety: {p.safety_notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Manage tab ─────────────────────────────────────────────────────
function ManageTab({ member, onEdit, onDeleteMember }) {
  return (
    <>
      <div className="intel-section">
        <h4>Member Information</h4>
        <div className="detail-grid">
          <div className="detail-metric"><span>Status</span><strong style={{fontSize:"14px"}}><Badge value={member.status||"Active"} /></strong></div>
          <div className="detail-metric"><span>Gender</span><strong style={{fontSize:"14px"}}>{member.gender||"—"}</strong></div>
          <div className="detail-metric"><span>Age</span><strong>{member.age||"—"}</strong></div>
          <div className="detail-metric"><span>Location</span><strong style={{fontSize:"13px"}}>{member.location||"—"}</strong></div>
          <div className="detail-metric"><span>Occupation</span><strong style={{fontSize:"13px"}}>{member.occupation||"—"}</strong></div>
          <div className="detail-metric"><span>Reg. Date</span><strong style={{fontSize:"12px"}}>{member.registration_date?.slice(0,10)||"—"}</strong></div>
        </div>
        <div className="detail-grid" style={{marginTop:"8px"}}>
          <div className="detail-metric"><span>Emergency Contact</span><strong style={{fontSize:"13px"}}>{member.emergency_contact_name||"—"}</strong></div>
          <div className="detail-metric"><span>Emergency Phone</span><strong style={{fontSize:"13px"}}>{member.emergency_contact_phone||"—"}</strong></div>
        </div>
      </div>

      <div className="intel-section">
        <h4>Consents</h4>
        <div className="detail-grid">
          <div className="detail-metric"><span>Privacy Consent</span><strong style={{color:member.privacy_consent?"var(--success)":"var(--danger)"}}>{member.privacy_consent?"✓ Yes":"✗ No"}</strong></div>
          <div className="detail-metric"><span>Medical Disclaimer</span><strong style={{color:member.medical_disclaimer_accepted?"var(--success)":"var(--danger)"}}>{member.medical_disclaimer_accepted?"✓ Yes":"✗ No"}</strong></div>
          <div className="detail-metric"><span>Marketing Consent</span><strong style={{color:member.marketing_consent?"var(--success)":"var(--muted)"}}>{member.marketing_consent?"✓ Yes":"— No"}</strong></div>
          <div className="detail-metric"><span>Consent Date</span><strong style={{fontSize:"12px"}}>{member.consent_signed_at?.slice(0,10)||"—"}</strong></div>
        </div>
      </div>

      <button className="secondary" type="button" onClick={()=>onEdit(member.id)} style={{width:"100%",marginBottom:"12px"}}>✏ Edit Full Profile</button>

      <div className="danger-zone">
        <h4>⚠ Danger Zone</h4>
        <p>Permanently delete <strong>{member.first_name} {member.last_name}</strong> and all their associated data — assessments, progress entries, workout plans, nutrition plans, and supplement plans. This action cannot be undone.</p>
        <button className="danger" type="button" onClick={()=>onDeleteMember(member.id,`${member.first_name} ${member.last_name}`)}>
          🗑 Delete Member
        </button>
      </div>
    </>
  );
}

// ── Tracking ───────────────────────────────────────────────────────
function Tracking({ members, message, onSubmit, onRefresh }) {
  const isError = message && !message.startsWith("✓");
  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>Tracking &amp; Plans</h2>
          <p className="muted text-sm" style={{marginTop:"4px"}}>Log assessments, progress, and coaching plans</p>
        </div>
        <button className="ghost" type="button" onClick={onRefresh}>↻ Refresh</button>
      </div>
      {message && <p className={`message ${isError?"error":"ok"}`} style={{marginBottom:"16px"}}>{message}</p>}
      <div className="tracking-grid">
        <QuickForm icon="📊" title="Assessment"     members={members} fields={assessmentFields}  onSubmit={e=>onSubmit(e,"/api/assessments/","assessment")} />
        <QuickForm icon="📈" title="Progress"       members={members} fields={progressFields}    onSubmit={e=>onSubmit(e,"/api/progress/","progress")} />
        <QuickForm icon="💪" title="Workout Plan"   members={members} fields={workoutFields}     onSubmit={e=>onSubmit(e,"/api/workout-plans/","workout plan")} />
        <QuickForm icon="🥗" title="Nutrition Plan" members={members} fields={nutritionFields}   onSubmit={e=>onSubmit(e,"/api/nutrition-plans/","nutrition plan")} />
        <QuickForm icon="💊" title="Supplement"     members={members} fields={supplementFields}  onSubmit={e=>onSubmit(e,"/api/supplement-plans/","supplement")} />
      </div>
    </section>
  );
}

function QuickForm({ icon, title, members, fields, onSubmit }) {
  return (
    <form className="panel quick-form" onSubmit={onSubmit}>
      <div className="quick-form-header">
        <span className="quick-form-icon">{icon}</span>
        <h3>{title}</h3>
      </div>
      <label className="wide">Member<select name="member_id" required><option value="">— Select member —</option>{members.map(m=><option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}</select></label>
      {fields.map(field=>(
        <label key={field.name} className={field.wide?"wide":""}>
          {field.label}
          {field.textarea ? <textarea name={field.name} /> : field.options ? <select name={field.name}>{field.options.map(o=><option key={o}>{o}</option>)}</select> : <input name={field.name} type={field.type||"text"} required={field.required} />}
        </label>
      ))}
      <button type="submit" className="wide">Save {title.toLowerCase()}</button>
    </form>
  );
}

// ── Settings ───────────────────────────────────────────────────────
function Settings({ settings, onRefresh }) {
  const s = settings || {};
  const cards = [
    {label:"Platform",          value:s.short_name,                                           icon:"⚡"},
    {label:"Admin Email",       value:s.admin_email,                                          icon:"📧"},
    {label:"Admin Seed",        value:s.admin_seed_enabled?"Enabled":"Disabled",              icon:"🔑"},
    {label:"Member Login",      value:s.member_login_enabled?"Enabled":"Future",              icon:"👤"},
    {label:"AI Recommendations",value:s.ai_recommendations_enabled?"Enabled":"Future",        icon:"🤖"},
    {label:"Data Access",       value:"Admin only",                                           icon:"🔒"},
  ];
  return (
    <section className="animate-in">
      <div className="section-title">
        <div><h2>Platform Settings</h2><p className="muted text-sm" style={{marginTop:"4px"}}>System configuration and feature flags</p></div>
        <button className="ghost" type="button" onClick={onRefresh}>↻ Refresh</button>
      </div>
      <div className="settings-grid">
        {cards.map(({label,value,icon})=>(
          <div className="panel settings-card" key={label}><h4>{icon} {label}</h4><div className="settings-value">{value??"—"}</div></div>
        ))}
      </div>
    </section>
  );
}

// ── Primitives ─────────────────────────────────────────────────────
function Filter({ label, value, values, onChange }) {
  return <label>{label}<select value={value} onChange={e=>onChange(e.target.value)}><option value="">All</option>{values.map(i=><option key={i}>{i}</option>)}</select></label>;
}

function Badge({ value }) {
  return <span className={`badge ${String(value).toLowerCase().replace(/\s+/g,"-")}`}>{value}</span>;
}

// ── Field configs ──────────────────────────────────────────────────
const assessmentFields = [
  {name:"assessment_date",label:"Date",type:"date",required:true},
  {name:"pushups",label:"Pushups",type:"number"},
  {name:"squats",label:"Squats",type:"number"},
  {name:"plank_seconds",label:"Plank (sec)",type:"number"},
  {name:"cardio_result",label:"Cardio result"},
  {name:"mobility_score",label:"Mobility score"},
  {name:"balance_score",label:"Balance score"},
  {name:"overall_notes",label:"Notes",textarea:true,wide:true},
];
const progressFields = [
  {name:"date",label:"Date",type:"date",required:true},
  {name:"weight",label:"Weight (kg)",type:"number"},
  {name:"waist_measurement",label:"Waist (cm)",type:"number"},
  {name:"body_fat_percentage",label:"Body fat %",type:"number"},
  {name:"adherence_score",label:"Adherence",type:"number"},
  {name:"progress_note",label:"Progress note",textarea:true,wide:true},
  {name:"coach_note",label:"Coach note",textarea:true,wide:true},
];
const workoutFields = [
  {name:"plan_name",label:"Plan name",required:true},
  {name:"goal_type",label:"Goal type"},
  {name:"weekly_frequency",label:"Frequency/week",type:"number"},
  {name:"session_duration",label:"Session (min)",type:"number"},
  {name:"intensity_level",label:"Intensity"},
  {name:"equipment",label:"Equipment"},
  {name:"status",label:"Status",options:["Draft","Active","Completed"]},
  {name:"injury_considerations",label:"Injury considerations",textarea:true,wide:true},
  {name:"notes",label:"Notes",textarea:true,wide:true},
];
const nutritionFields = [
  {name:"nutrition_goal",label:"Goal"},
  {name:"calories_target",label:"Calories",type:"number"},
  {name:"protein_target",label:"Protein (g)",type:"number"},
  {name:"hydration_target",label:"Hydration (L)",type:"number"},
  {name:"dietary_restrictions",label:"Restrictions"},
  {name:"status",label:"Status",options:["Draft","Active","Completed"]},
  {name:"meal_preference",label:"Meal preference",textarea:true,wide:true},
  {name:"coach_notes",label:"Coach notes",textarea:true,wide:true},
];
const supplementFields = [
  {name:"supplement_name",label:"Supplement",required:true},
  {name:"purpose",label:"Purpose"},
  {name:"suggested_timing",label:"Timing"},
  {name:"status",label:"Status",options:["Draft","Active","Stopped"]},
  {name:"notes",label:"Notes",textarea:true,wide:true},
  {name:"safety_notes",label:"Safety notes",textarea:true,wide:true},
];

export default App;
