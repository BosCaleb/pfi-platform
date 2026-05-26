const state = {
  token: localStorage.getItem("pfi_token") || "",
  admin: JSON.parse(localStorage.getItem("pfi_admin") || "null"),
  members: [],
  currentStep: 0,
  editingMemberId: null,
  publicSettings: null,
};

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function setMessage(id, text, kind = "") {
  const el = qs(`#${id}`);
  if (!el) return;
  el.textContent = text;
  el.className = `message ${kind}`.trim();
}

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...authHeaders(),
    ...(options.headers || {}),
  };
  const response = await fetch(path, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const detail = typeof body === "object" ? body.detail || JSON.stringify(body) : body;
    throw new Error(detail || `Request failed with ${response.status}`);
  }
  return body;
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function valueFor(input) {
  if (input.type === "checkbox") return input.checked;
  if (input.type === "number") return numberOrNull(input.value);
  if (input.value === "") return null;
  return input.value;
}

function formToNested(form) {
  const data = {};
  qsa("input, select, textarea", form).forEach((input) => {
    if (!input.name) return;
    const path = input.name.split(".");
    let target = data;
    path.forEach((part, index) => {
      if (index === path.length - 1) {
        target[part] = valueFor(input);
      } else {
        target[part] = target[part] || {};
        target = target[part];
      }
    });
  });
  return data;
}

function formToFlat(form) {
  const data = {};
  qsa("input, select, textarea", form).forEach((input) => {
    if (input.name) data[input.name] = valueFor(input);
  });
  return data;
}

function compactPayload(payload) {
  Object.keys(payload).forEach((key) => {
    if (payload[key] && typeof payload[key] === "object" && !Array.isArray(payload[key])) {
      compactPayload(payload[key]);
    }
    if (payload[key] === "") payload[key] = null;
  });
  return payload;
}

function setLoggedIn(loggedIn) {
  qs("#landingView").classList.toggle("hidden", loggedIn);
  qs("#loginView").classList.add("hidden");
  qs("#appView").classList.toggle("hidden", !loggedIn);
  qs("#logoutBtn").classList.toggle("hidden", !loggedIn);
  qs("#adminLoginBtn").classList.toggle("hidden", loggedIn);
  qs("#sessionLabel").textContent = loggedIn && state.admin ? state.admin.email : "Signed out";
  if (loggedIn) {
    refreshAll();
  }
}

function showLogin(message = "") {
  qs("#landingView").classList.add("hidden");
  qs("#appView").classList.add("hidden");
  qs("#loginView").classList.remove("hidden");
  setMessage("loginMessage", message);
}

function showLanding() {
  if (state.token) {
    setLoggedIn(true);
    return;
  }
  qs("#landingView").classList.remove("hidden");
  qs("#loginView").classList.add("hidden");
  qs("#appView").classList.add("hidden");
  setMessage("loginMessage", "");
}

async function refreshAll() {
  await Promise.allSettled([loadMembers(), loadDashboard(), loadSettings()]);
}

async function login(event) {
  event.preventDefault();
  setMessage("loginMessage", "Signing in...");
  try {
    const credentials = formToFlat(event.currentTarget);
    const result = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    state.token = result.access_token;
    state.admin = result.admin;
    localStorage.setItem("pfi_token", state.token);
    localStorage.setItem("pfi_admin", JSON.stringify(state.admin));
    setMessage("loginMessage", "");
    setLoggedIn(true);
  } catch (error) {
    setMessage("loginMessage", error.message, "error");
  }
}

async function seedAdmin() {
  setMessage("loginMessage", "Creating default admin...");
  try {
    const result = await api("/api/auth/seed", { method: "POST", body: "{}" });
    setMessage("loginMessage", result.message, "ok");
  } catch (error) {
    setMessage("loginMessage", error.message, "error");
  }
}

function logout() {
  state.token = "";
  state.admin = null;
  localStorage.removeItem("pfi_token");
  localStorage.removeItem("pfi_admin");
  showLanding();
  qs("#logoutBtn").classList.add("hidden");
  qs("#adminLoginBtn").classList.remove("hidden");
  qs("#sessionLabel").textContent = "Signed out";
}

function setActiveTab(name) {
  qsa(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  qsa(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === name));
  if (name === "settings") loadSettings();
}

async function loadDashboard() {
  if (!state.token) return;
  const [stats, reassessments] = await Promise.all([
    api("/api/dashboard/stats"),
    api("/api/dashboard/reassessments"),
  ]);
  renderStats(stats);
  renderRecent(stats.recent || []);
  renderReassessments(reassessments || []);
}

function renderStats(stats) {
  const items = [
    ["Total members", stats.total_members],
    ["Active", stats.active_members],
    ["New this month", stats.new_this_month],
    ["High risk", stats.high_risk],
  ];
  qs("#statsGrid").innerHTML = items
    .map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value ?? 0}</strong></div>`)
    .join("");
}

function renderRecent(recent) {
  qs("#recentMembers").innerHTML = recent.length
    ? recent.map((m) => `<div class="list-item"><div><strong>${m.name}</strong><br><small>${m.goal || "No goal"} / ${m.level || "No level"}</small></div><span class="badge ${(m.risk || "").toLowerCase()}">${m.risk || "Low"}</span></div>`).join("")
    : `<p class="muted">No members yet.</p>`;
}

function renderReassessments(items) {
  qs("#reassessmentList").innerHTML = items.length
    ? items.map((item) => `<div class="list-item"><div><strong>${item.name}</strong><br><small>Last ${item.last_assessment}</small></div><span>${item.due_date}</span></div>`).join("")
    : `<p class="muted">No reassessments due.</p>`;
}

async function loadMembers() {
  if (!state.token) return;
  const params = new URLSearchParams();
  const search = qs("#memberSearch")?.value;
  const goal = qs("#goalFilter")?.value;
  const level = qs("#levelFilter")?.value;
  const risk = qs("#riskFilter")?.value;
  const status = qs("#statusFilter")?.value;
  if (search) params.set("search", search);
  if (goal) params.set("goal", goal);
  if (level) params.set("level", level);
  if (risk) params.set("risk", risk);
  if (status) params.set("status", status);
  state.members = await api(`/api/members/?${params.toString()}`);
  renderMembers();
  populateFilters();
  populateMemberSelects();
}

function populateFilters() {
  const configs = [
    ["#goalFilter", "primary_goal", "All goals"],
    ["#levelFilter", "fitness_level", "All levels"],
    ["#riskFilter", "risk_level", "All risks"],
    ["#statusFilter", "status", "All statuses"],
  ];
  configs.forEach(([selector, key, label]) => {
    const select = qs(selector);
    if (!select) return;
    const current = select.value;
    const values = [...new Set(state.members.map((m) => m[key]).filter(Boolean))].sort();
    select.innerHTML = `<option value="">${label}</option>${values.map((v) => `<option>${v}</option>`).join("")}`;
    select.value = values.includes(current) ? current : "";
  });
}

function populateMemberSelects() {
  const options = state.members
    .map((m) => `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`)
    .join("");
  qsa(".member-select").forEach((select) => {
    const current = select.value;
    select.innerHTML = `<option value="">Select member</option>${options}`;
    select.value = current;
  });
}

function renderMembers() {
  const tbody = qs("#membersTable");
  tbody.innerHTML = state.members.length
    ? state.members.map((m) => `
      <tr data-id="${m.id}">
        <td><strong>${m.first_name} ${m.last_name}</strong><br><small>${m.email}</small></td>
        <td>${m.primary_goal || ""}</td>
        <td>${m.fitness_level || ""}</td>
        <td><span class="badge ${(m.risk_level || "").toLowerCase()}">${m.risk_level || "Low"}</span></td>
        <td><span class="badge ${(m.status || "").toLowerCase()}">${m.status || ""}</span></td>
      </tr>
    `).join("")
    : `<tr><td colspan="5">No members found.</td></tr>`;
}

async function showMember(id) {
  const member = await api(`/api/members/${id}`);
  const computed = member.computed || {};
  qs("#memberDetail").innerHTML = `
    <h3>${member.first_name} ${member.last_name}</h3>
    <p class="muted">${member.email} / ${member.phone || "No phone"}</p>
    <div class="detail-grid">
      ${metric("Goal", member.primary_goal)}
      ${metric("Level", member.fitness_level)}
      ${metric("Risk", member.risk_level)}
      ${metric("BMI", member.physical_metrics?.bmi)}
      ${metric("Fitness age", computed.fitness_age)}
      ${metric("Recovery", score(computed.recovery_score))}
      ${metric("Injury risk", score(computed.injury_risk_score))}
      ${metric("Compliance", score(computed.compliance_probability))}
      ${metric("Segment", computed.member_segment)}
      ${metric("Progress logs", member.progress_entries?.length || 0)}
    </div>
    <h3>Coach Notes</h3>
    <p class="muted">${member.goals?.coach_notes || member.health_profile?.notes || "No notes recorded."}</p>
    <div class="form-actions">
      <button class="secondary" data-edit-member="${member.id}" type="button">Edit profile</button>
    </div>
  `;
}

function metric(label, value) {
  return `<div class="detail-metric"><span>${label}</span><strong>${value ?? "-"}</strong></div>`;
}

function score(value) {
  return value === null || value === undefined ? "-" : `${value}%`;
}

async function createMember(event) {
  event.preventDefault();
  if (!validateStep(state.currentStep)) return;
  setMessage("memberMessage", state.editingMemberId ? "Updating profile..." : "Saving profile...");
  const payload = compactPayload(formToNested(event.currentTarget));
  payload.goals.secondary_goals = payload.goals.secondary_goals
    ? payload.goals.secondary_goals.split(",").map((goal) => goal.trim()).filter(Boolean)
    : null;
  try {
    const path = state.editingMemberId ? `/api/members/${state.editingMemberId}` : "/api/members/";
    const method = state.editingMemberId ? "PUT" : "POST";
    const member = await api(path, {
      method,
      body: JSON.stringify(payload),
    });
    setMessage("memberMessage", `${state.editingMemberId ? "Updated" : "Saved"} ${member.first_name} ${member.last_name}.`, "ok");
    clearMemberForm();
    await refreshAll();
    setActiveTab("members");
    await showMember(member.id);
  } catch (error) {
    setMessage("memberMessage", error.message, "error");
  }
}

function wizardLabels() {
  return ["Identity", "Physical", "Health", "Lifestyle", "Goals", "Motivation", "Baseline"];
}

function renderWizardProgress() {
  qs("#wizardProgress").innerHTML = wizardLabels()
    .map((label, index) => `<button class="${index === state.currentStep ? "active" : ""}" data-step-jump="${index}" type="button">${index + 1}. ${label}</button>`)
    .join("");
}

function showStep(step) {
  const steps = qsa(".wizard-step");
  state.currentStep = Math.max(0, Math.min(step, steps.length - 1));
  steps.forEach((item, index) => item.classList.toggle("active", index === state.currentStep));
  qs("#prevStepBtn").classList.toggle("hidden", state.currentStep === 0);
  qs("#nextStepBtn").classList.toggle("hidden", state.currentStep === steps.length - 1);
  qs("#submitMemberBtn").classList.toggle("hidden", state.currentStep !== steps.length - 1);
  renderWizardProgress();
}

function validateStep(step) {
  const current = qs(`.wizard-step[data-step="${step}"]`);
  const invalid = current ? qsa("input, select, textarea", current).find((input) => !input.checkValidity()) : null;
  if (invalid) {
    invalid.reportValidity();
    return false;
  }
  return true;
}

function nextStep() {
  if (validateStep(state.currentStep)) showStep(state.currentStep + 1);
}

function previousStep() {
  showStep(state.currentStep - 1);
}

function setInput(name, value) {
  const input = qs(`[name="${name}"]`);
  if (!input) return;
  if (input.type === "checkbox") {
    input.checked = Boolean(value);
  } else {
    input.value = value ?? "";
  }
}

function fillMemberForm(member) {
  const latest = [...(member.assessments || [])].sort((a, b) => String(a.assessment_date).localeCompare(String(b.assessment_date))).pop() || {};
  const mobilityParts = latest.mobility_score ? latest.mobility_score.split(" / ") : [];
  const mappings = {
    "personal.first_name": member.first_name,
    "personal.last_name": member.last_name,
    "personal.email": member.email,
    "personal.phone": member.phone,
    "personal.date_of_birth": member.date_of_birth,
    "personal.gender": member.gender,
    "personal.status": member.status,
    "personal.occupation": member.occupation,
    "personal.location": member.location,
    "personal.preferred_training_time": member.preferred_training_time,
    "personal.emergency_contact_name": member.emergency_contact_name,
    "personal.emergency_contact_phone": member.emergency_contact_phone,
    "physical.height": member.physical_metrics?.height,
    "physical.weight": member.physical_metrics?.weight,
    "physical.body_fat_percentage": member.physical_metrics?.body_fat_percentage,
    "physical.waist_measurement": member.physical_metrics?.waist_measurement,
    "physical.resting_heart_rate": member.physical_metrics?.resting_heart_rate,
    "physical.blood_pressure": member.physical_metrics?.blood_pressure,
    "physical.mobility_score": member.physical_metrics?.mobility_score,
    "physical.fitness_level": member.physical_metrics?.fitness_level || member.fitness_level,
    "health.injuries": member.health_profile?.injuries,
    "health.pain_areas": member.health_profile?.pain_areas,
    "health.previous_surgeries": member.health_profile?.previous_surgeries,
    "health.chronic_conditions": member.health_profile?.chronic_conditions,
    "health.medications": member.health_profile?.medications,
    "health.medical_clearance_required": member.health_profile?.medical_clearance_required,
    "health.medical_clearance_received": member.health_profile?.medical_clearance_received,
    "health.risk_level": member.health_profile?.risk_level || member.risk_level,
    "health.notes": member.health_profile?.notes,
    "lifestyle.sleep_hours": member.lifestyle_profile?.sleep_hours,
    "lifestyle.stress_level": member.lifestyle_profile?.stress_level,
    "lifestyle.activity_level": member.lifestyle_profile?.activity_level,
    "lifestyle.work_schedule": member.lifestyle_profile?.work_schedule,
    "lifestyle.travel_frequency": member.lifestyle_profile?.travel_frequency,
    "lifestyle.water_intake": member.lifestyle_profile?.water_intake,
    "lifestyle.nutrition_habits": member.lifestyle_profile?.nutrition_habits,
    "lifestyle.smoking": member.lifestyle_profile?.smoking,
    "lifestyle.alcohol": member.lifestyle_profile?.alcohol,
    "lifestyle.recovery_capacity": member.lifestyle_profile?.recovery_capacity,
    "goals.primary_goal": member.goals?.primary_goal || member.primary_goal,
    "goals.secondary_goals": member.goals?.secondary_goals,
    "goals.fat_loss_pct": member.goals?.fat_loss_pct ?? 0,
    "goals.strength_pct": member.goals?.strength_pct ?? 0,
    "goals.mobility_pct": member.goals?.mobility_pct ?? 0,
    "goals.performance_pct": member.goals?.performance_pct ?? 0,
    "goals.target_weight": member.goals?.target_weight,
    "goals.target_date": member.goals?.target_date,
    "goals.coach_notes": member.goals?.coach_notes,
    "behavior.motivation_type": member.motivation_profile?.motivation_type,
    "behavior.coaching_style": member.motivation_profile?.coaching_style,
    "behavior.workout_preference": member.motivation_profile?.workout_preference,
    "behavior.training_frequency": member.motivation_profile?.training_frequency,
    "behavior.session_duration": member.motivation_profile?.session_duration,
    "behavior.gamification": member.motivation_profile?.gamification,
    "behavior.notification_frequency": member.motivation_profile?.notification_frequency,
    "assessment.assessment_date": latest.assessment_date || today(),
    "assessment.pushups": latest.pushups,
    "assessment.squats": latest.squats,
    "assessment.plank_seconds": latest.plank_seconds,
    "assessment.cardio_result": latest.cardio_result,
    "assessment.hamstring_flexibility": mobilityParts[0],
    "assessment.shoulder_mobility": mobilityParts[1],
    "assessment.balance_test": latest.balance_score,
    "assessment.overall_notes": latest.overall_notes,
    "consent.privacy_consent": member.privacy_consent,
    "consent.medical_disclaimer_accepted": member.medical_disclaimer_accepted,
    "consent.marketing_consent": member.marketing_consent,
  };
  Object.entries(mappings).forEach(([name, value]) => setInput(name, value));
}

async function editMember(id) {
  const member = await api(`/api/members/${id}`);
  state.editingMemberId = id;
  qs("#memberForm").reset();
  fillMemberForm(member);
  qs("#submitMemberBtn").textContent = "Update member profile";
  qs("#cancelEditBtn").classList.remove("hidden");
  setMessage("memberMessage", `Editing ${member.first_name} ${member.last_name}.`, "ok");
  showStep(0);
  setActiveTab("intake");
}

function clearMemberForm() {
  state.editingMemberId = null;
  qs("#memberForm").reset();
  qs("#submitMemberBtn").textContent = "Save member profile";
  qs("#cancelEditBtn").classList.add("hidden");
  setDefaultDates();
  showStep(0);
}

async function loadPublicSettings() {
  try {
    state.publicSettings = await api("/api/settings/public", { headers: {} });
    qs("#seedBtn").classList.toggle("hidden", !state.publicSettings.admin_seed_enabled);
  } catch {
    qs("#seedBtn").classList.add("hidden");
  }
}

async function loadSettings() {
  if (!state.token) return;
  try {
    const settings = await api("/api/settings/");
    qs("#settingsPanel").innerHTML = `
      ${metric("Platform", settings.short_name)}
      ${metric("Admin", settings.admin_email)}
      ${metric("Default admin seed", settings.admin_seed_enabled ? "Enabled" : "Disabled")}
      ${metric("Member login", settings.member_login_enabled ? "Enabled" : "Future")}
      ${metric("AI recommendations", settings.ai_recommendations_enabled ? "Enabled" : "Future")}
      ${metric("Data access", "Admin only")}
    `;
  } catch (error) {
    qs("#settingsPanel").innerHTML = `<p class="message error">${error.message}</p>`;
  }
}

function quickSubmit(formId, endpoint, messagePrefix) {
  qs(`#${formId}`).addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("trackingMessage", `Saving ${messagePrefix}...`);
    const payload = compactPayload(formToFlat(event.currentTarget));
    try {
      await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
      setMessage("trackingMessage", `${messagePrefix} saved.`, "ok");
      event.currentTarget.reset();
      setDefaultDates();
      await loadDashboard();
    } catch (error) {
      setMessage("trackingMessage", error.message, "error");
    }
  });
}

function setDefaultDates() {
  qsa('input[type="date"][required]').forEach((input) => {
    if (!input.value) input.value = today();
  });
}

function bindEvents() {
  qs("#homeBtn").addEventListener("click", showLanding);
  qs("#adminLoginBtn").addEventListener("click", () => showLogin());
  qs("#landingLoginBtn").addEventListener("click", () => showLogin());
  qs("#landingRegisterBtn").addEventListener("click", () => showLogin("Admin login required to register a member profile."));
  qs("#loginForm").addEventListener("submit", login);
  qs("#seedBtn").addEventListener("click", seedAdmin);
  qs("#logoutBtn").addEventListener("click", logout);
  qs("#memberForm").addEventListener("submit", createMember);
  qs("#prevStepBtn").addEventListener("click", previousStep);
  qs("#nextStepBtn").addEventListener("click", nextStep);
  qs("#cancelEditBtn").addEventListener("click", () => {
    clearMemberForm();
    setMessage("memberMessage", "Edit cancelled.");
  });
  qs("#wizardProgress").addEventListener("click", (event) => {
    const target = event.target.closest("[data-step-jump]");
    if (target) showStep(Number(target.dataset.stepJump));
  });
  qs("#resetIntakeBtn").addEventListener("click", () => {
    clearMemberForm();
    setMessage("memberMessage", "");
  });
  qs("#refreshDashboardBtn").addEventListener("click", loadDashboard);
  qs("#refreshMembersBtn").addEventListener("click", loadMembers);
  qs("#refreshTrackingMembersBtn").addEventListener("click", loadMembers);
  qs("#refreshSettingsBtn").addEventListener("click", loadSettings);
  qsa(".tab").forEach((tab) => tab.addEventListener("click", () => setActiveTab(tab.dataset.tab)));
  ["memberSearch", "goalFilter", "levelFilter", "riskFilter", "statusFilter"].forEach((id) => {
    qs(`#${id}`).addEventListener("input", loadMembers);
    qs(`#${id}`).addEventListener("change", loadMembers);
  });
  qs("#membersTable").addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (row) showMember(row.dataset.id);
  });
  qs("#memberDetail").addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-member]");
    if (edit) editMember(edit.dataset.editMember);
  });
  quickSubmit("assessmentForm", "/api/assessments/", "assessment");
  quickSubmit("progressForm", "/api/progress/", "progress");
  quickSubmit("workoutForm", "/api/workout-plans/", "workout plan");
  quickSubmit("nutritionForm", "/api/nutrition-plans/", "nutrition plan");
  quickSubmit("supplementForm", "/api/supplement-plans/", "supplement plan");
}

bindEvents();
setDefaultDates();
showStep(0);
loadPublicSettings();
setLoggedIn(Boolean(state.token));
