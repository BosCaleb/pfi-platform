// ── Application-wide constants ──────────────────────────────────────
// Centralised here so components never repeat large literals.

export const emptyProfile = {
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
  consent: {
    // Core
    privacy_consent: false,
    medical_disclaimer_accepted: false,
    marketing_consent: false,
    // Extended registration pack
    consent_info_accuracy: false,
    consent_no_medical_advice: false,
    consent_nutrition_disclaimer: false,
    consent_medical_clearance: false,
    consent_ai_recommendations: false,
    consent_terms_accepted: false,
  },
};

export const WIZARD_STEPS = [
  { label: "Identity",  icon: "👤", subtitle: "Personal details and contact information" },
  { label: "Physical",  icon: "📏", subtitle: "Body metrics and current fitness level" },
  { label: "Health",    icon: "🩺", subtitle: "Medical history and risk assessment" },
  { label: "Lifestyle", icon: "🌙", subtitle: "Sleep, stress, activity and habits" },
  { label: "Goals",     icon: "🎯", subtitle: "Targets and goal weighting" },
  { label: "Coaching",  icon: "🧠", subtitle: "Motivation style and training preferences" },
  { label: "Baseline",  icon: "📊", subtitle: "Initial fitness assessment and consent" },
];

/** Required field paths per wizard step index. */
export const STEP_REQUIRED = [
  [
    "personal.first_name", "personal.last_name", "personal.email", "personal.phone",
    "personal.date_of_birth", "personal.emergency_contact_name", "personal.emergency_contact_phone",
  ],
  ["physical.height", "physical.weight"],
  [], // health — no required fields
  [], // lifestyle — no required fields
  ["goals.primary_goal"],
  ["behavior.motivation_type", "behavior.coaching_style"],
  [
    "assessment.assessment_date",
    "consent.consent_info_accuracy",
    "consent.medical_disclaimer_accepted",
    "consent.consent_no_medical_advice",
    "consent.consent_nutrition_disclaimer",
    "consent.privacy_consent",
    "consent.consent_medical_clearance",
    "consent.consent_ai_recommendations",
    "consent.consent_terms_accepted",
  ],
];

export const TAB_ITEMS = [
  { id: "dashboard", icon: "⚡",  label: "Dashboard" },
  { id: "intake",    icon: "➕",  label: "Member Intake" },
  { id: "members",   icon: "👥",  label: "Members" },
  { id: "tracking",  icon: "📈",  label: "Tracking" },
  // Phase 2 — Workout Intelligence
  { id: "groups",    icon: "🏋️", label: "Groups" },
  { id: "exercises", icon: "📚",  label: "Exercises" },
  { id: "plans",     icon: "🗂",  label: "Plans" },
  { id: "sessions",  icon: "🎯",  label: "Sessions" },
  { id: "alerts",    icon: "🔔",  label: "Alerts" },
  { id: "settings",  icon: "⚙️",  label: "Settings" },
];
