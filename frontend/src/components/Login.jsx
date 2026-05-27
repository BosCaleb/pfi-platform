// ── Login ─────────────────────────────────────────────────────────────
const ERROR_KEYWORDS = ["invalid", "failed", "disabled", "too many"];

export function Login({ onSubmit, onSeed, message, seedEnabled }) {
  const isError = message && ERROR_KEYWORDS.some(kw => message.toLowerCase().includes(kw));

  return (
    <section className="auth-shell">
      <form className="panel auth-panel" onSubmit={onSubmit}>
        <p className="auth-eyebrow">⚡ Admin Access</p>
        <h2>Staff Login</h2>
        <p className="muted text-sm" style={{ marginTop: "6px" }}>
          Enter your credentials to access the platform.
        </p>

        <div className="auth-form-fields">
          <label>
            Email Address
            <input
              name="email"
              type="email"
              defaultValue="admin@pfi-platform.local"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              defaultValue="admin123"
              autoComplete="current-password"
              required
            />
          </label>
        </div>

        <div className="form-actions">
          <button type="submit">Sign in →</button>
          {seedEnabled && (
            <button className="secondary" type="button" onClick={onSeed}>
              Create default admin
            </button>
          )}
        </div>

        {message && (
          <p
            className={`message ${isError ? "error" : "ok"}`}
            style={{ marginTop: "14px" }}
          >
            {isError ? "⚠ " : "✓ "}{message}
          </p>
        )}
      </form>
    </section>
  );
}
