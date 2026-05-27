// ── Tracking & Plans ──────────────────────────────────────────────────

// ── Quick-form field configs ─────────────────────────────────────────

const assessmentFields = [
  { name: "assessment_date",  label: "Date",            type: "date",   required: true },
  { name: "pushups",          label: "Pushups",          type: "number" },
  { name: "squats",           label: "Squats",           type: "number" },
  { name: "plank_seconds",    label: "Plank (sec)",      type: "number" },
  { name: "cardio_result",    label: "Cardio result" },
  { name: "mobility_score",   label: "Mobility score" },
  { name: "balance_score",    label: "Balance score" },
  { name: "overall_notes",    label: "Notes",            textarea: true, wide: true },
];

const progressFields = [
  { name: "date",                  label: "Date",            type: "date",   required: true },
  { name: "weight",                label: "Weight (kg)",     type: "number" },
  { name: "waist_measurement",     label: "Waist (cm)",      type: "number" },
  { name: "body_fat_percentage",   label: "Body fat %",      type: "number" },
  { name: "adherence_score",       label: "Adherence",       type: "number" },
  { name: "progress_note",         label: "Progress note",   textarea: true, wide: true },
  { name: "coach_note",            label: "Coach note",      textarea: true, wide: true },
];

const workoutFields = [
  { name: "plan_name",              label: "Plan name",        required: true },
  { name: "goal_type",              label: "Goal type" },
  { name: "weekly_frequency",       label: "Frequency/week",   type: "number" },
  { name: "session_duration",       label: "Session (min)",    type: "number" },
  { name: "intensity_level",        label: "Intensity" },
  { name: "equipment",              label: "Equipment" },
  { name: "status",                 label: "Status",           options: ["Draft", "Active", "Completed"] },
  { name: "injury_considerations",  label: "Injury considerations", textarea: true, wide: true },
  { name: "notes",                  label: "Notes",            textarea: true, wide: true },
];

const nutritionFields = [
  { name: "nutrition_goal",         label: "Goal" },
  { name: "calories_target",        label: "Calories",         type: "number" },
  { name: "protein_target",         label: "Protein (g)",      type: "number" },
  { name: "hydration_target",       label: "Hydration (L)",    type: "number" },
  { name: "dietary_restrictions",   label: "Restrictions" },
  { name: "status",                 label: "Status",           options: ["Draft", "Active", "Completed"] },
  { name: "meal_preference",        label: "Meal preference",  textarea: true, wide: true },
  { name: "coach_notes",            label: "Coach notes",      textarea: true, wide: true },
];

const supplementFields = [
  { name: "supplement_name",  label: "Supplement",  required: true },
  { name: "purpose",          label: "Purpose" },
  { name: "suggested_timing", label: "Timing" },
  { name: "status",           label: "Status",  options: ["Draft", "Active", "Stopped"] },
  { name: "notes",            label: "Notes",   textarea: true, wide: true },
  { name: "safety_notes",     label: "Safety notes", textarea: true, wide: true },
];

// ── QuickForm ────────────────────────────────────────────────────────

function QuickForm({ icon, title, members, fields, onSubmit }) {
  return (
    <form className="panel quick-form" onSubmit={onSubmit}>
      <div className="quick-form-header">
        <span className="quick-form-icon">{icon}</span>
        <h3>{title}</h3>
      </div>

      <label className="wide">
        Member
        <select name="member_id" required>
          <option value="">— Select member —</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
          ))}
        </select>
      </label>

      {fields.map(field => (
        <label key={field.name} className={field.wide ? "wide" : ""}>
          {field.label}
          {field.textarea ? (
            <textarea name={field.name} />
          ) : field.options ? (
            <select name={field.name}>
              {field.options.map(o => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <input
              name={field.name}
              type={field.type || "text"}
              required={field.required}
            />
          )}
        </label>
      ))}

      <button type="submit" className="wide">
        Save {title.toLowerCase()}
      </button>
    </form>
  );
}

// ── Tracking shell ───────────────────────────────────────────────────

export function Tracking({ members, message, onSubmit, onRefresh }) {
  const isError = message && !message.startsWith("✓");

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>Tracking &amp; Plans</h2>
          <p className="muted text-sm" style={{ marginTop: "4px" }}>
            Log assessments, progress, and coaching plans
          </p>
        </div>
        <button className="ghost" type="button" onClick={onRefresh}>↻ Refresh</button>
      </div>

      {message && (
        <p className={`message ${isError ? "error" : "ok"}`} style={{ marginBottom: "16px" }}>
          {message}
        </p>
      )}

      <div className="tracking-grid">
        <QuickForm icon="📊" title="Assessment"     members={members} fields={assessmentFields}
          onSubmit={e => onSubmit(e, "/api/assessments/", "assessment")} />
        <QuickForm icon="📈" title="Progress"       members={members} fields={progressFields}
          onSubmit={e => onSubmit(e, "/api/progress/", "progress")} />
        <QuickForm icon="💪" title="Workout Plan"   members={members} fields={workoutFields}
          onSubmit={e => onSubmit(e, "/api/workout-plans/", "workout plan")} />
        <QuickForm icon="🥗" title="Nutrition Plan" members={members} fields={nutritionFields}
          onSubmit={e => onSubmit(e, "/api/nutrition-plans/", "nutrition plan")} />
        <QuickForm icon="💊" title="Supplement"     members={members} fields={supplementFields}
          onSubmit={e => onSubmit(e, "/api/supplement-plans/", "supplement")} />
      </div>
    </section>
  );
}
