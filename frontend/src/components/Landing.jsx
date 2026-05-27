// ── Landing ──────────────────────────────────────────────────────────
const FEATURES = [
  ["🔬", "Personalised Profiles",  "Deep member data — metrics, health history, lifestyle, and goals."],
  ["💪", "Smart Plan Generation",   "Coaching-ready workout, nutrition, and supplement blueprints."],
  ["📈", "Progress Intelligence",   "Track body metrics with real-time trend analytics."],
  ["🎯", "AI Scoring Engine",       "Recovery, injury risk, strength index, and compliance — automated."],
];

const HOW_STEPS = ["Register", "Assess", "Profile", "Plan", "Track", "Adapt"];

const METRICS = [
  ["cyan",   "Strength Index", "84"],
  ["purple", "Recovery Score", "72"],
  ["lime",   "Mobility Rating", "91"],
  ["blue",   "Goal Progress",  "63%"],
];

const SIGNAL_HEIGHTS = [38, 62, 48, 82, 56, 90, 68];

const HERO_STATS = [
  ["1,200+", "Data Points"],
  ["7",       "Intelligence Scores"],
  ["∞",       "Member Capacity"],
];

export function Landing({ onLogin, onDisclaimers }) {
  return (
    <section className="landing-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Sports Intelligence OS</p>
          <h2>
            Train Smarter.<br />
            <em>Perform Better.</em><br />
            Become Unstoppable.
          </h2>
          <p className="hero-subtext">
            A professional coaching intelligence platform for personalised training,
            nutrition, supplementation, and progress analytics.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={onLogin}>Get Started</button>
            <button className="secondary" type="button" onClick={onLogin}>Admin Login</button>
          </div>
          <div className="hero-tag">
            {HERO_STATS.map(([n, l]) => (
              <div className="hero-tag-item" key={l}>
                <strong>{n}</strong>{l}
              </div>
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
            {METRICS.map(([color, label, value]) => (
              <div className={`metric-card ${color}`} key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="signal-bars" aria-hidden="true">
            {SIGNAL_HEIGHTS.map((h, i) => (
              <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.07}s` }} />
            ))}
          </div>
        </div>
      </section>

      <section className="feature-grid">
        {FEATURES.map(([icon, title, desc]) => (
          <article className="panel glow-card" key={title}>
            <span className="glow-card-icon">{icon}</span>
            <h3>{title}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </section>

      <section className="how-grid">
        <div className="section-title">
          <h2>How PFI Works</h2>
          <span className="section-label">Register → Assess → Profile → Plan → Track → Adapt</span>
        </div>
        <div className="steps">
          {HOW_STEPS.map((label, i) => (
            <div className="step-item" key={label}>
              <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
              <strong>{label}</strong>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <span>PFI Platform</span>
        <span>Fitness Intelligence for Serious Coaches</span>
        <span>Private — Admin Access Only</span>
        <button
          type="button"
          className="landing-footer-link"
          onClick={onDisclaimers}
        >
          Disclaimers &amp; Legal Notices
        </button>
      </footer>
    </section>
  );
}
