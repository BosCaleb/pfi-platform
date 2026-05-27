// ── Intake wizard ─────────────────────────────────────────────────────
import { useState }          from "react";
import { Field, Checkbox }   from "./ui/Field.jsx";
import { WIZARD_STEPS }      from "../constants.js";
import { validateStep }      from "../utils/helpers.js";

// ── Wizard step sub-forms ────────────────────────────────────────────

function Identity({ profile, onField, errors }) {
  const f = (path, label, opts = {}) => (
    <Field key={path} profile={profile} path={path} label={label} onField={onField} errors={errors} {...opts} />
  );
  return (<>
    {f("personal.first_name", "First name", { required: true })}
    {f("personal.last_name",  "Last name",  { required: true })}
    {f("personal.email",  "Email",  { type: "email", required: true })}
    {f("personal.phone",  "Phone",  { required: true })}
    {f("personal.date_of_birth", "Date of birth", { type: "date", required: true })}
    {f("personal.gender", "Gender", { options: ["", "Female", "Male", "Non-binary", "Prefer not to say"] })}
    {f("personal.status", "Status", { options: ["Active", "Inactive", "Paused"] })}
    {f("personal.occupation", "Occupation")}
    {f("personal.location",   "Location")}
    {f("personal.preferred_training_time", "Preferred time", {
      options: ["", "Early morning", "Morning", "Lunch", "Afternoon", "Evening"],
    })}
    {f("personal.emergency_contact_name",  "Emergency contact", { required: true })}
    {f("personal.emergency_contact_phone", "Emergency phone",   { required: true })}
  </>);
}

function Physical({ profile, onField, errors }) {
  const f = (path, label, opts = {}) => (
    <Field key={path} profile={profile} path={path} label={label} onField={onField} errors={errors} {...opts} />
  );
  return (<>
    {f("physical.height",               "Height (cm)",      { type: "number", min: "80",  max: "260", step: "0.1", required: true })}
    {f("physical.weight",               "Weight (kg)",      { type: "number", min: "20",  max: "350", step: "0.1", required: true })}
    {f("physical.body_fat_percentage",  "Body fat %",       { type: "number", min: "0",   max: "80",  step: "0.1" })}
    {f("physical.waist_measurement",    "Waist (cm)",       { type: "number", min: "20",  max: "250", step: "0.1" })}
    {f("physical.resting_heart_rate",   "Resting HR",       { type: "number", min: "30",  max: "220" })}
    {f("physical.blood_pressure",       "Blood pressure",   { placeholder: "120/80" })}
    {f("physical.mobility_score",       "Mobility score (1–10)", { type: "number", min: "1", max: "10" })}
    {f("physical.fitness_level",        "Fitness level",    { options: ["Beginner", "Intermediate", "Advanced", "Athlete"] })}
  </>);
}

function Health({ profile, onField, errors }) {
  const f = (path, label, opts = {}) => (
    <Field key={path} profile={profile} path={path} label={label} onField={onField} errors={errors} {...opts} />
  );
  return (<>
    <p className="form-note wide">
      ⚕ PFI does not replace medical advice. High-risk members should seek medical clearance
      before intense exercise.
    </p>
    {f("health.injuries",               "Injuries",    { textarea: true })}
    {f("health.pain_areas",             "Pain areas",  { textarea: true })}
    {f("health.previous_surgeries",     "Previous surgeries",   { textarea: true })}
    {f("health.chronic_conditions",     "Chronic conditions",   { textarea: true })}
    {f("health.medications",            "Medications", { textarea: true })}
    {f("health.medical_clearance_required", "Clearance required", { options: ["No", "Yes"] })}
    {f("health.medical_clearance_received", "Clearance received", { options: ["No", "Yes"] })}
    {f("health.risk_level",             "Risk level",  { options: ["Low", "Medium", "High"] })}
    <Field profile={profile} path="health.notes" label="Health notes" textarea onField={onField} errors={errors} wide />
  </>);
}

function Lifestyle({ profile, onField, errors }) {
  const f = (path, label, opts = {}) => (
    <Field key={path} profile={profile} path={path} label={label} onField={onField} errors={errors} {...opts} />
  );
  return (<>
    {f("lifestyle.sleep_hours",      "Sleep hours",     { type: "number", min: "0", max: "16", step: "0.5" })}
    {f("lifestyle.stress_level",     "Stress level",    { options: ["", "Low", "Medium", "High"] })}
    {f("lifestyle.activity_level",   "Activity level",  { options: ["", "Sedentary", "Lightly Active", "Active", "Very Active"] })}
    {f("lifestyle.work_schedule",    "Work schedule")}
    {f("lifestyle.travel_frequency", "Travel frequency")}
    {f("lifestyle.water_intake",     "Water (litres)",  { type: "number", min: "0", max: "12", step: "0.1" })}
    {f("lifestyle.smoking",          "Smoking")}
    {f("lifestyle.alcohol",          "Alcohol")}
    {f("lifestyle.recovery_capacity","Recovery capacity", { options: ["", "Low", "Medium", "High"] })}
    <Field profile={profile} path="lifestyle.nutrition_habits" label="Nutrition habits" textarea onField={onField} errors={errors} wide />
  </>);
}

function Goals({ profile, onField, errors }) {
  const f = (path, label, opts = {}) => (
    <Field key={path} profile={profile} path={path} label={label} onField={onField} errors={errors} {...opts} />
  );
  return (<>
    {f("goals.primary_goal", "Primary goal", {
      required: true,
      options: ["Fat Loss", "Muscle Gain", "Strength", "Sports Performance", "Mobility", "General Fitness", "Rehabilitation"],
    })}
    {f("goals.secondary_goals", "Secondary goals", { placeholder: "Strength, Mobility" })}
    {f("goals.fat_loss_pct",    "Fat loss %",  { type: "number", min: "0", max: "100" })}
    {f("goals.strength_pct",    "Strength %",  { type: "number", min: "0", max: "100" })}
    {f("goals.mobility_pct",    "Mobility %",  { type: "number", min: "0", max: "100" })}
    {f("goals.performance_pct", "Performance %", { type: "number", min: "0", max: "100" })}
    {f("goals.target_weight",   "Target weight", { type: "number", min: "20", max: "350", step: "0.1" })}
    {f("goals.target_date",     "Target date",   { type: "date" })}
    <Field profile={profile} path="goals.coach_notes" label="Coach notes" textarea onField={onField} errors={errors} wide />
  </>);
}

function Behavior({ profile, onField, errors }) {
  const f = (path, label, opts = {}) => (
    <Field key={path} profile={profile} path={path} label={label} onField={onField} errors={errors} {...opts} />
  );
  return (<>
    {f("behavior.motivation_type", "Motivation type", {
      required: true,
      options: ["Competitive", "Coaching-driven", "Self-motivated", "Accountability-driven", "Social"],
    })}
    {f("behavior.coaching_style", "Coaching style", {
      required: true,
      options: ["Strict", "Friendly", "Encouraging", "Technical"],
    })}
    {f("behavior.workout_preference",  "Workout preference", { options: ["", "Solo", "Partner", "Group"] })}
    {f("behavior.training_frequency",  "Training days/week", { type: "number", min: "0", max: "14" })}
    {f("behavior.session_duration",    "Session minutes",    { type: "number", min: "10", max: "240" })}
    {f("behavior.gamification",        "Gamification",       { options: ["No", "Yes"] })}
    {f("behavior.notification_frequency", "Notifications",   { placeholder: "Weekly" })}
  </>);
}

function Baseline({ profile, onField, errors }) {
  const f = (path, label, opts = {}) => (
    <Field key={path} profile={profile} path={path} label={label} onField={onField} errors={errors} {...opts} />
  );
  return (<>
    {f("assessment.assessment_date", "Assessment date",    { type: "date", required: true })}
    {f("assessment.pushups",          "Pushups",            { type: "number", min: "0" })}
    {f("assessment.squats",           "Squats",             { type: "number", min: "0" })}
    {f("assessment.plank_seconds",    "Plank (seconds)",    { type: "number", min: "0" })}
    {f("assessment.cardio_result",    "Cardio result",      { placeholder: "05:30" })}
    {f("assessment.hamstring_flexibility", "Hamstring flex")}
    {f("assessment.shoulder_mobility",     "Shoulder mobility")}
    {f("assessment.balance_test",          "Balance test")}
    <Field profile={profile} path="assessment.overall_notes" label="Overall notes" textarea onField={onField} errors={errors} wide />
    <div className="consent-block wide">
      <p className="consent-heading">📋 Member Acknowledgement &amp; Consent</p>
      <p className="consent-subtext">
        All items marked <span style={{ color: "var(--danger)" }}>*</span> are required before
        registration can be completed. Please read each statement carefully before ticking.
      </p>

      <Checkbox profile={profile} path="consent.consent_info_accuracy" required onField={onField} errors={errors}
        label="I confirm that the information I provided is accurate and complete." />

      <Checkbox profile={profile} path="consent.medical_disclaimer_accepted" required onField={onField} errors={errors}
        label="I understand that exercise involves risk and I participate voluntarily." />

      <Checkbox profile={profile} path="consent.consent_no_medical_advice" required onField={onField} errors={errors}
        label="I understand that this platform does not provide medical advice." />

      <Checkbox profile={profile} path="consent.consent_nutrition_disclaimer" required onField={onField} errors={errors}
        label="I understand that nutrition and supplement guidance is informational and not a substitute for professional advice." />

      <Checkbox profile={profile} path="consent.privacy_consent" required onField={onField} errors={errors}
        label="I consent to the processing of my personal, fitness and health-related information for coaching and progress tracking purposes." />

      <Checkbox profile={profile} path="consent.consent_medical_clearance" required onField={onField} errors={errors}
        label="I understand that I should seek medical clearance if I have any health condition, injury or medical concern." />

      <Checkbox profile={profile} path="consent.consent_ai_recommendations" required onField={onField} errors={errors}
        label="I understand that AI or automated recommendations may be used to assist the admin or coach, but all recommendations must be reviewed before being applied." />

      <Checkbox profile={profile} path="consent.consent_terms_accepted" required onField={onField} errors={errors}
        label="I accept the Terms and Conditions, Privacy Policy and Member Waiver." />

      <p className="consent-divider">Optional</p>

      <Checkbox profile={profile} path="consent.marketing_consent" onField={onField} errors={errors}
        label="I consent to receiving programme updates and communication from the gym." />
    </div>
  </>);
}

const STEP_FORMS = [Identity, Physical, Health, Lifestyle, Goals, Behavior, Baseline];

// ── Wizard shell ────────────────────────────────────────────────────

export function Intake({ profile, step, editingId, message, onField, onStep, onSubmit, onReset }) {
  const [errors, setErrors] = useState({});
  const msgIsError = message && !message.startsWith("✓");

  function handleNext() {
    const e = validateStep(step, profile);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    onStep(step + 1);
  }

  function handleStepClick(i) {
    if (i < step) { onStep(i); return; }
    const e = validateStep(step, profile);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    onStep(i);
  }

  const StepForm = STEP_FORMS[step];
  const fp       = { profile, onField, errors };

  return (
    <section className="animate-in">
      <div className="section-title">
        <div>
          <h2>{editingId ? "Edit Member Profile" : "New Member Intake"}</h2>
          <p className="muted text-sm" style={{ marginTop: "4px" }}>
            Step {step + 1} of {WIZARD_STEPS.length} — {WIZARD_STEPS[step].subtitle}
          </p>
        </div>
        <button className="ghost" type="button" onClick={onReset}>
          {editingId ? "Cancel edit" : "Clear form"}
        </button>
      </div>

      {/* Step indicator */}
      <div className="wizard-progress-bar" role="tablist">
        {WIZARD_STEPS.map(({ label, icon }, i) => (
          <button
            key={label}
            className={`wizard-step-btn ${step === i ? "active" : ""} ${i < step ? "completed" : ""}`}
            type="button"
            role="tab"
            aria-selected={step === i}
            onClick={() => handleStepClick(i)}
          >
            <span className="step-num-circle">{i < step ? "✓" : i + 1}</span>
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
            <StepForm {...fp} />
          </div>

          <div className="wide-actions">
            <button
              className="secondary"
              type="button"
              disabled={step === 0}
              onClick={() => onStep(step - 1)}
            >
              ← Previous
            </button>
            {step < WIZARD_STEPS.length - 1 && (
              <button type="button" onClick={handleNext}>Next →</button>
            )}
            {step === WIZARD_STEPS.length - 1 && (
              <button type="submit">
                {editingId ? "Update profile →" : "Save profile →"}
              </button>
            )}
            {message && (
              <span className={`message ${msgIsError ? "error" : "ok"}`}>{message}</span>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
