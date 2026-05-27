// ── Plan Builder ──────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { request } from "../utils/api.js";
import { Badge }   from "./ui/Badge.jsx";

const GOAL_TYPES    = ["Fat Loss","Strength","Endurance","Mobility","Performance","Rehabilitation","General Fitness"];
const DIFFICULTIES  = ["Beginner","Intermediate","Advanced","Mixed"];
const SECTION_TYPES = ["Warm-up","Main Workout","Core","Cardio","Cool-down","Other"];
const DAY_LABELS    = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","Day A","Day B","Day C","Rest Day"];

export function PlanBuilder({ token }) {
  const [plans,    setPlans]    = useState([]);
  const [selected, setSelected] = useState(null);  // full plan object with nested versions
  const [msg,      setMsg]      = useState("");
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanForm, setNewPlan]     = useState({ plan_name: "", description: "", goal_type: "Strength", difficulty: "Intermediate" });

  // Track which sections are open (versions / weeks / days / sections)
  const [openVersions, setOpenVersions] = useState({});
  const [openWeeks,    setOpenWeeks]    = useState({});
  const [openDays,     setOpenDays]     = useState({});
  const [openSections, setOpenSections] = useState({});

  // Inline add forms
  const [addingWeek,    setAddingWeek]    = useState(null);   // version_id
  const [addingDay,     setAddingDay]     = useState(null);   // week_id
  const [addingSection, setAddingSection] = useState(null);   // day_id
  const [addingExercise, setAddingEx]     = useState(null);   // section_id
  const [exercises,     setExercises]     = useState([]);     // exercise library

  const loadPlans = useCallback(async () => {
    setPlans(await request("/api/plan-builder/plans/", token));
  }, [token]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  async function selectPlan(p) {
    const full = await request(`/api/plan-builder/plans/${p.id}`, token);
    setSelected(full);
    // Auto-open the first active version
    const active = full.versions?.find(v => v.is_active);
    if (active) setOpenVersions({ [active.id]: true });
    setMsg("");
  }

  async function refreshSelected() {
    if (!selected) return;
    const full = await request(`/api/plan-builder/plans/${selected.id}`, token);
    setSelected(full);
  }

  async function createPlan(e) {
    e.preventDefault();
    setMsg("Creating plan…");
    try {
      const p = await request("/api/plan-builder/plans/", token, {
        method: "POST", body: JSON.stringify(newPlanForm),
      });
      setMsg("✓ Plan created with Version 1.");
      setShowNewPlan(false);
      setNewPlan({ plan_name: "", description: "", goal_type: "Strength", difficulty: "Intermediate" });
      await loadPlans();
      await selectPlan(p);
    } catch (err) { setMsg(err.message); }
  }

  async function deletePlan(id) {
    if (!confirm("Delete this plan template and all its versions?")) return;
    try {
      await request(`/api/plan-builder/plans/${id}`, token, { method: "DELETE" });
      setSelected(null);
      await loadPlans();
    } catch (err) { alert(err.message); }
  }

  async function addVersion() {
    if (!selected) return;
    try {
      await request(`/api/plan-builder/plans/${selected.id}/versions/`, token, {
        method: "POST", body: JSON.stringify({ description: "" }),
      });
      await refreshSelected();
    } catch (err) { alert(err.message); }
  }

  async function publishVersion(vid) {
    if (!confirm("Publish this version? It will become the active version.")) return;
    try {
      await request(`/api/plan-builder/versions/${vid}/publish`, token, { method: "POST" });
      await refreshSelected();
    } catch (err) { alert(err.message); }
  }

  async function deleteVersion(vid) {
    if (!confirm("Delete this version?")) return;
    try {
      await request(`/api/plan-builder/versions/${vid}`, token, { method: "DELETE" });
      await refreshSelected();
    } catch (err) { alert(err.message); }
  }

  async function addWeek(versionId, weekNumber) {
    try {
      await request(`/api/plan-builder/versions/${versionId}/weeks/`, token, {
        method: "POST", body: JSON.stringify({ week_number: weekNumber, description: "" }),
      });
      setAddingWeek(null);
      await refreshSelected();
      setOpenVersions(p => ({ ...p, [versionId]: true }));
    } catch (err) { alert(err.message); }
  }

  async function addDay(weekId, label) {
    try {
      await request(`/api/plan-builder/weeks/${weekId}/days/`, token, {
        method: "POST", body: JSON.stringify({ day_label: label, day_number: 1, notes: "" }),
      });
      setAddingDay(null);
      await refreshSelected();
      setOpenWeeks(p => ({ ...p, [weekId]: true }));
    } catch (err) { alert(err.message); }
  }

  async function addSection(dayId, sectionName, sectionType, displayOrder) {
    try {
      await request(`/api/plan-builder/days/${dayId}/sections/`, token, {
        method: "POST",
        body: JSON.stringify({ section_name: sectionName, section_type: sectionType, display_order: displayOrder, notes: "" }),
      });
      setAddingSection(null);
      await refreshSelected();
      setOpenDays(p => ({ ...p, [dayId]: true }));
    } catch (err) { alert(err.message); }
  }

  async function loadExercisesFor(sectionId) {
    if (!exercises.length) {
      const exs = await request("/api/exercises/?status=Active", token);
      setExercises(exs);
    }
    setAddingEx(sectionId);
  }

  async function addExercise(sectionId, payload) {
    try {
      await request(`/api/plan-builder/sections/${sectionId}/exercises/`, token, {
        method: "POST", body: JSON.stringify(payload),
      });
      setAddingEx(null);
      await refreshSelected();
      setOpenSections(p => ({ ...p, [sectionId]: true }));
    } catch (err) { alert(err.message); }
  }

  async function deleteSectionExercise(peId) {
    try {
      await request(`/api/plan-builder/section-exercises/${peId}`, token, { method: "DELETE" });
      await refreshSelected();
    } catch (err) { alert(err.message); }
  }

  async function deleteSection(sId) {
    if (!confirm("Delete this section and all its exercises?")) return;
    try {
      await request(`/api/plan-builder/sections/${sId}`, token, { method: "DELETE" });
      await refreshSelected();
    } catch (err) { alert(err.message); }
  }

  async function deleteDay(dId) {
    if (!confirm("Delete this day and all sections within it?")) return;
    try {
      await request(`/api/plan-builder/days/${dId}`, token, { method: "DELETE" });
      await refreshSelected();
    } catch (err) { alert(err.message); }
  }

  async function deleteWeek(wId) {
    if (!confirm("Delete this week and all days within it?")) return;
    try {
      await request(`/api/plan-builder/weeks/${wId}`, token, { method: "DELETE" });
      await refreshSelected();
    } catch (err) { alert(err.message); }
  }

  function toggleVersion(id) { setOpenVersions(p => ({ ...p, [id]: !p[id] })); }
  function toggleWeek(id)    { setOpenWeeks(p => ({ ...p, [id]: !p[id] })); }
  function toggleDay(id)     { setOpenDays(p => ({ ...p, [id]: !p[id] })); }
  function toggleSection(id) { setOpenSections(p => ({ ...p, [id]: !p[id] })); }

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>🗂 Plan Builder</h2>
          <p className="muted text-sm" style={{ marginTop: 4 }}>
            Build modular workout plan templates
          </p>
        </div>
        <div className="section-title-right">
          {msg && <span className="message">{msg}</span>}
          <button type="button" onClick={() => { setShowNewPlan(s => !s); setMsg(""); }}>
            {showNewPlan ? "Cancel" : "+ New Plan"}
          </button>
        </div>
      </div>

      {/* New plan form */}
      {showNewPlan && (
        <form className="panel" style={{ marginBottom: 20 }} onSubmit={createPlan}>
          <h3>New Plan Template</h3>
          <div className="form-grid-2">
            <label>Plan Name *
              <input required value={newPlanForm.plan_name}
                onChange={e => setNewPlan(f => ({ ...f, plan_name: e.target.value }))} />
            </label>
            <label>Goal Type
              <select value={newPlanForm.goal_type}
                onChange={e => setNewPlan(f => ({ ...f, goal_type: e.target.value }))}>
                {GOAL_TYPES.map(g => <option key={g}>{g}</option>)}
              </select>
            </label>
            <label>Difficulty
              <select value={newPlanForm.difficulty}
                onChange={e => setNewPlan(f => ({ ...f, difficulty: e.target.value }))}>
                {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
              </select>
            </label>
          </div>
          <label style={{ marginTop: 12 }}>Description
            <textarea rows={2} value={newPlanForm.description}
              onChange={e => setNewPlan(f => ({ ...f, description: e.target.value }))} />
          </label>
          <div style={{ marginTop: 14 }}><button type="submit">Create Plan</button></div>
        </form>
      )}

      <div className="p2-two-col">
        {/* Plan list */}
        <div className="p2-left-list">
          {plans.length === 0 && (
            <div className="empty-state">
              <span className="empty-state-icon">🗂</span>
              No plans yet.
            </div>
          )}
          {plans.map(p => (
            <div
              key={p.id}
              className={`group-card ${selected?.id === p.id ? "active" : ""}`}
              onClick={() => selectPlan(p)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === "Enter" && selectPlan(p)}
            >
              <div className="group-card-header">
                <span className="group-card-name">{p.plan_name}</span>
                <Badge value={p.status || "Draft"} />
              </div>
              <div className="group-card-chips">
                {p.goal_type  && <span className="history-chip">{p.goal_type}</span>}
                {p.difficulty && <span className="history-chip">{p.difficulty}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Plan detail */}
        <div className="p2-right-detail">
          {!selected ? (
            <div className="empty-state">
              <span className="empty-state-icon">👈</span>
              Select a plan to build its structure.
            </div>
          ) : (
            <>
              <div className="section-title" style={{ marginBottom: 16 }}>
                <div>
                  <h3 style={{ marginBottom: 4 }}>{selected.plan_name}</h3>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {selected.goal_type  && <span className="history-chip">{selected.goal_type}</span>}
                    {selected.difficulty && <span className="history-chip">{selected.difficulty}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="ghost" type="button" onClick={addVersion}>+ Version</button>
                  <button className="danger" type="button" onClick={() => deletePlan(selected.id)}>Delete Plan</button>
                </div>
              </div>

              {/* Versions */}
              {(selected.versions || []).map(v => (
                <div key={v.id} className="plan-version-block">
                  <div className="plan-version-header" onClick={() => toggleVersion(v.id)}>
                    <span className="plan-version-label">
                      {openVersions[v.id] ? "▼" : "▶"} Version {v.version_number}
                      {v.is_active && <span className="badge low" style={{ marginLeft: 8 }}>Active</span>}
                    </span>
                    <div className="plan-version-actions" onClick={e => e.stopPropagation()}>
                      {!v.is_active && (
                        <>
                          <button className="ghost" type="button" style={{ fontSize: 11, padding: "4px 10px", minHeight: 28 }}
                            onClick={() => publishVersion(v.id)}>
                            Publish
                          </button>
                          <button className="delete-btn" type="button" onClick={() => deleteVersion(v.id)}>🗑</button>
                        </>
                      )}
                    </div>
                  </div>

                  {openVersions[v.id] && (
                    <div className="plan-version-body">
                      {/* Weeks */}
                      {(v.weeks || []).map(w => (
                        <div key={w.id} className="plan-week-block">
                          <div className="plan-week-header" onClick={() => toggleWeek(w.id)}>
                            <span>{openWeeks[w.id] ? "▼" : "▶"} Week {w.week_number}</span>
                            <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 6 }}>
                              <button className="ghost" type="button"
                                style={{ fontSize: 11, padding: "3px 8px", minHeight: 24 }}
                                onClick={() => setAddingDay(w.id)}>+ Day</button>
                              <button className="delete-btn" type="button" onClick={() => deleteWeek(w.id)}>🗑</button>
                            </div>
                          </div>

                          {addingDay === w.id && (
                            <AddDayForm
                              onAdd={label => addDay(w.id, label)}
                              onCancel={() => setAddingDay(null)}
                            />
                          )}

                          {openWeeks[w.id] && (
                            <div className="plan-days">
                              {(w.days || []).map(d => (
                                <div key={d.id} className="plan-day-block">
                                  <div className="plan-day-header" onClick={() => toggleDay(d.id)}>
                                    <span>{openDays[d.id] ? "▼" : "▶"} {d.day_label}</span>
                                    <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 6 }}>
                                      <button className="ghost" type="button"
                                        style={{ fontSize: 11, padding: "3px 8px", minHeight: 24 }}
                                        onClick={() => setAddingSection(d.id)}>+ Section</button>
                                      <button className="delete-btn" type="button" onClick={() => deleteDay(d.id)}>🗑</button>
                                    </div>
                                  </div>

                                  {addingSection === d.id && (
                                    <AddSectionForm
                                      displayOrder={(d.sections || []).length + 1}
                                      onAdd={(name, type, order) => addSection(d.id, name, type, order)}
                                      onCancel={() => setAddingSection(null)}
                                    />
                                  )}

                                  {openDays[d.id] && (
                                    <div className="plan-sections">
                                      {(d.sections || []).map(sec => (
                                        <div key={sec.id} className="plan-section-block">
                                          <div className="plan-section-header" onClick={() => toggleSection(sec.id)}>
                                            <span>
                                              {openSections[sec.id] ? "▼" : "▶"} {sec.section_name}
                                              <span className="history-chip" style={{ marginLeft: 8, fontSize: 10 }}>
                                                {sec.section_type}
                                              </span>
                                            </span>
                                            <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 6 }}>
                                              <button className="ghost" type="button"
                                                style={{ fontSize: 11, padding: "3px 8px", minHeight: 24 }}
                                                onClick={() => loadExercisesFor(sec.id)}>+ Exercise</button>
                                              <button className="delete-btn" type="button"
                                                onClick={() => deleteSection(sec.id)}>🗑</button>
                                            </div>
                                          </div>

                                          {addingExercise === sec.id && (
                                            <AddExerciseForm
                                              exercises={exercises}
                                              displayOrder={(sec.exercises || []).length + 1}
                                              onAdd={payload => addExercise(sec.id, payload)}
                                              onCancel={() => setAddingEx(null)}
                                            />
                                          )}

                                          {openSections[sec.id] && (
                                            <div className="plan-exercise-list">
                                              {(sec.exercises || []).length === 0 && (
                                                <p className="muted text-xs" style={{ padding: "6px 0" }}>
                                                  No exercises — click + Exercise above.
                                                </p>
                                              )}
                                              {(sec.exercises || []).map(pe => (
                                                <div key={pe.id} className="plan-exercise-row">
                                                  <div className="plan-exercise-info">
                                                    <span className="plan-exercise-name">{pe.exercise_name || pe.exercise?.exercise_name || "Unknown"}</span>
                                                    <div className="plan-exercise-chips">
                                                      {pe.prescribed_sets     && <span className="history-chip">{pe.prescribed_sets} sets</span>}
                                                      {pe.prescribed_reps     && <span className="history-chip">{pe.prescribed_reps} reps</span>}
                                                      {pe.prescribed_weight   && <span className="history-chip">{pe.prescribed_weight}kg</span>}
                                                      {pe.prescribed_duration_seconds && <span className="history-chip">{pe.prescribed_duration_seconds}s</span>}
                                                      {pe.prescribed_rest_seconds     && <span className="history-chip">Rest {pe.prescribed_rest_seconds}s</span>}
                                                    </div>
                                                  </div>
                                                  <button className="delete-btn" type="button"
                                                    onClick={() => deleteSectionExercise(pe.id)}>🗑</button>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Add week button */}
                      {addingWeek === v.id ? (
                        <AddWeekForm
                          nextNum={(v.weeks || []).length + 1}
                          onAdd={num => addWeek(v.id, num)}
                          onCancel={() => setAddingWeek(null)}
                        />
                      ) : (
                        <button className="ghost" type="button"
                          style={{ marginTop: 10, fontSize: 12 }}
                          onClick={() => setAddingWeek(v.id)}>
                          + Add Week {(v.weeks || []).length + 1}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Inline sub-forms ──────────────────────────────────────────────────

function AddWeekForm({ nextNum, onAdd, onCancel }) {
  const [n, setN] = useState(nextNum);
  return (
    <div className="plan-inline-form">
      <label>Week number
        <input type="number" min="1" value={n} onChange={e => setN(Number(e.target.value))}
          style={{ width: 80 }} />
      </label>
      <button type="button" onClick={() => onAdd(n)}>Add</button>
      <button className="ghost" type="button" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function AddDayForm({ onAdd, onCancel }) {
  const [label, setLabel] = useState("");
  return (
    <div className="plan-inline-form">
      <label>Day label
        <select value={label} onChange={e => setLabel(e.target.value)}>
          <option value="">Select…</option>
          {DAY_LABELS.map(d => <option key={d}>{d}</option>)}
        </select>
      </label>
      <button type="button" disabled={!label} onClick={() => onAdd(label)}>Add Day</button>
      <button className="ghost" type="button" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function AddSectionForm({ displayOrder, onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Main Workout");
  const [order, setOrder] = useState(displayOrder);
  return (
    <div className="plan-inline-form">
      <label>Section name
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Strength Block" />
      </label>
      <label>Type
        <select value={type} onChange={e => setType(e.target.value)}>
          {SECTION_TYPES.map(s => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label>Order
        <input type="number" min="1" value={order} onChange={e => setOrder(Number(e.target.value))}
          style={{ width: 60 }} />
      </label>
      <button type="button" disabled={!name} onClick={() => onAdd(name, type, order)}>Add</button>
      <button className="ghost" type="button" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function AddExerciseForm({ exercises, displayOrder, onAdd, onCancel }) {
  const [exId,   setExId]   = useState("");
  const [sets,   setSets]   = useState("");
  const [reps,   setReps]   = useState("");
  const [weight, setWeight] = useState("");
  const [dur,    setDur]    = useState("");
  const [rest,   setRest]   = useState("");
  const [order,  setOrder]  = useState(displayOrder);
  const [notes,  setNotes]  = useState("");

  function submit() {
    if (!exId) return;
    onAdd({
      exercise_id:                parseInt(exId),
      prescribed_sets:            sets   ? parseInt(sets)     : null,
      prescribed_reps:            reps   || null,
      prescribed_weight:          weight ? parseFloat(weight) : null,
      prescribed_duration_seconds: dur   ? parseInt(dur)      : null,
      prescribed_rest_seconds:    rest   ? parseInt(rest)      : null,
      display_order:              order,
      coach_notes:                notes || null,
    });
  }

  return (
    <div className="plan-inline-form" style={{ flexWrap: "wrap" }}>
      <label>Exercise *
        <select value={exId} onChange={e => setExId(e.target.value)} style={{ minWidth: 180 }}>
          <option value="">Select…</option>
          {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.exercise_name}</option>)}
        </select>
      </label>
      <label>Sets<input type="number" min="1" value={sets} onChange={e => setSets(e.target.value)} style={{ width: 60 }} /></label>
      <label>Reps<input value={reps} onChange={e => setReps(e.target.value)} placeholder="10-12" style={{ width: 70 }} /></label>
      <label>kg<input type="number" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} style={{ width: 60 }} /></label>
      <label>Sec<input type="number" value={dur} onChange={e => setDur(e.target.value)} style={{ width: 60 }} /></label>
      <label>Rest(s)<input type="number" value={rest} onChange={e => setRest(e.target.value)} style={{ width: 60 }} /></label>
      <label>Order<input type="number" min="1" value={order} onChange={e => setOrder(Number(e.target.value))} style={{ width: 55 }} /></label>
      <label style={{ gridColumn: "1 / -1", minWidth: 200 }}>Coach notes
        <input value={notes} onChange={e => setNotes(e.target.value)} />
      </label>
      <button type="button" disabled={!exId} onClick={submit}>Add Exercise</button>
      <button className="ghost" type="button" onClick={onCancel}>Cancel</button>
    </div>
  );
}
