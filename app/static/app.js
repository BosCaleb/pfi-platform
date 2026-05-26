const state = {
  token: localStorage.getItem("pfi_token") || "",
  admin: JSON.parse(localStorage.getItem("pfi_admin") || "null"),
  members: [],
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
  qs("#loginView").classList.toggle("hidden", loggedIn);
  qs("#appView").classList.toggle("hidden", !loggedIn);
  qs("#logoutBtn").classList.toggle("hidden", !loggedIn);
  qs("#sessionLabel").textContent = loggedIn && state.admin ? state.admin.email : "Signed out";
  if (loggedIn) {
    refreshAll();
  }
}

async function refreshAll() {
  await Promise.allSettled([loadMembers(), loadDashboard()]);
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
  setLoggedIn(false);
}

function setActiveTab(name) {
  qsa(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  qsa(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === name));
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
  if (search) params.set("search", search);
  if (goal) params.set("goal", goal);
  if (level) params.set("level", level);
  if (risk) params.set("risk", risk);
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
  setMessage("memberMessage", "Saving profile...");
  const payload = compactPayload(formToNested(event.currentTarget));
  payload.goals.secondary_goals = payload.goals.secondary_goals
    ? payload.goals.secondary_goals.split(",").map((goal) => goal.trim()).filter(Boolean)
    : null;
  try {
    const member = await api("/api/members/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setMessage("memberMessage", `Saved ${member.first_name} ${member.last_name}.`, "ok");
    event.currentTarget.reset();
    setDefaultDates();
    await refreshAll();
    setActiveTab("members");
    await showMember(member.id);
  } catch (error) {
    setMessage("memberMessage", error.message, "error");
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
  qs("#loginForm").addEventListener("submit", login);
  qs("#seedBtn").addEventListener("click", seedAdmin);
  qs("#logoutBtn").addEventListener("click", logout);
  qs("#memberForm").addEventListener("submit", createMember);
  qs("#resetIntakeBtn").addEventListener("click", () => {
    qs("#memberForm").reset();
    setDefaultDates();
    setMessage("memberMessage", "");
  });
  qs("#refreshDashboardBtn").addEventListener("click", loadDashboard);
  qs("#refreshMembersBtn").addEventListener("click", loadMembers);
  qs("#refreshTrackingMembersBtn").addEventListener("click", loadMembers);
  qsa(".tab").forEach((tab) => tab.addEventListener("click", () => setActiveTab(tab.dataset.tab)));
  ["memberSearch", "goalFilter", "levelFilter", "riskFilter"].forEach((id) => {
    qs(`#${id}`).addEventListener("input", loadMembers);
    qs(`#${id}`).addEventListener("change", loadMembers);
  });
  qs("#membersTable").addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (row) showMember(row.dataset.id);
  });
  quickSubmit("assessmentForm", "/api/assessments/", "assessment");
  quickSubmit("progressForm", "/api/progress/", "progress");
  quickSubmit("workoutForm", "/api/workout-plans/", "workout plan");
  quickSubmit("nutritionForm", "/api/nutrition-plans/", "nutrition plan");
  quickSubmit("supplementForm", "/api/supplement-plans/", "supplement plan");
}

bindEvents();
setDefaultDates();
setLoggedIn(Boolean(state.token));
