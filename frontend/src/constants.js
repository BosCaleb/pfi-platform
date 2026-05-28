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

/**
 * NAV_GROUPS — the source of truth for sidebar navigation.
 * Each group has an id, label, accent colour, and items array.
 * The active item uses CSS variable --g (set inline) so the
 * stylesheet can tint its background/border with the group colour.
 */
export const NAV_GROUPS = [
  {
    id:    "core",
    label: "Core",
    color: "var(--cyan)",
    items: [
      { id: "dashboard", icon: "⚡",  label: "Dashboard" },
      { id: "ops",       icon: "🎛️", label: "Operations" },
    ],
  },
  {
    id:    "members",
    label: "Members",
    color: "var(--lime)",
    items: [
      { id: "intake",    icon: "➕",  label: "Member Intake" },
      { id: "members",   icon: "👥",  label: "Members" },
      { id: "tracking",  icon: "📈",  label: "Tracking" },
      { id: "check-ins", icon: "🔰",  label: "Check-Ins" },
    ],
  },
  {
    id:    "workout",
    label: "Workout",
    color: "var(--purple)",
    items: [
      { id: "groups",    icon: "🏋️", label: "Groups" },
      { id: "exercises", icon: "📚",  label: "Exercises" },
      { id: "plans",     icon: "🗂️", label: "Plans" },
      { id: "sessions",  icon: "🎯",  label: "Sessions" },
      { id: "alerts",    icon: "🔔",  label: "Alerts" },
    ],
  },
  {
    id:    "coaching",
    label: "Coaching",
    color: "var(--gold)",
    items: [
      { id: "tasks",          icon: "📋",  label: "Coach Tasks" },
      { id: "pain-flags",     icon: "🚩",  label: "Pain & Risk" },
      { id: "coaching-intel", icon: "🧠",  label: "Coaching AI" },
    ],
  },
  {
    id:    "operations",
    label: "Operations",
    color: "var(--warn)",
    items: [
      { id: "packages",   icon: "📦",  label: "Packages" },
      { id: "billing",    icon: "💳",  label: "Billing" },
      { id: "schedule",   icon: "📅",  label: "Schedule" },
      { id: "attendance", icon: "✅",  label: "Attendance" },
      { id: "messages",   icon: "📨",  label: "Messages" },
    ],
  },
  {
    id:    "intelligence",
    label: "Intelligence",
    color: "#06b6d4",
    items: [
      { id: "ai-coach",    icon: "🤖",  label: "AI Coach" },
      { id: "ai-plans",    icon: "📝",  label: "AI Plans" },
      { id: "retention",   icon: "💡",  label: "Retention" },
      { id: "bi-dashboard",icon: "📊",  label: "BI Dashboard" },
      { id: "reports",     icon: "📄",  label: "Reports" },
    ],
  },
  {
    id:    "resources",
    label: "Resources",
    color: "#8b5cf6",
    items: [
      { id: "content",    icon: "📚",  label: "Content Library" },
      { id: "equipment",  icon: "🏋️", label: "Equipment" },
      { id: "milestones", icon: "🏆",  label: "Milestones" },
    ],
  },
  {
    id:    "admin",
    label: "Admin",
    color: "#94a3b8",
    items: [
      { id: "staff",        icon: "👔",  label: "Staff" },
      { id: "gym-config",   icon: "🏗️", label: "Gym Setup" },
      { id: "integrations", icon: "🔌",  label: "Integrations" },
      { id: "gym-mgmt",     icon: "🏢",  label: "Gym Management" },
      { id: "privacy",      icon: "🔒",  label: "Privacy & Data" },
      { id: "settings",     icon: "⚙️",  label: "Settings" },
    ],
  },
];

/** Flat list — kept for any legacy code that iterates TAB_ITEMS. */
export const TAB_ITEMS = NAV_GROUPS.flatMap(g => g.items);
