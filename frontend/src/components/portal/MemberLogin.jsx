import { useState } from "react";

const API = (path) => path;

export default function MemberLogin({ onLogin }) {
  const [mode,    setMode]    = useState("login");   // "login" | "register"
  const [email,   setEmail]   = useState("");
  const [pw,      setPw]      = useState("");
  const [pw2,     setPw2]     = useState("");
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg("");

    try {
      if (mode === "login") {
        const r = await fetch("/api/member/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pw }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || "Login failed");
        onLogin(data.access_token, data.member);

      } else {
        const r = await fetch("/api/member/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pw, confirm_password: pw2 }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || "Registration failed");
        setSuccess(true);
        setMsg(data.message || "Account created! You can now log in.");
      }
    } catch (err) {
      setMsg(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="mp-login-page">
      <div className="mp-login-card">
        {/* Logo / Brand */}
        <div className="mp-brand">
          <div className="mp-brand-icon">⚡</div>
          <div>
            <div className="mp-brand-eye">Member Portal</div>
            <h1 className="mp-brand-name">PFI Platform</h1>
          </div>
        </div>

        <div className="mp-tab-row">
          <button className={`mp-tab ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); setMsg(""); setSuccess(false); }}>
            Sign In
          </button>
          <button className={`mp-tab ${mode === "register" ? "active" : ""}`} onClick={() => { setMode("register"); setMsg(""); setSuccess(false); }}>
            Create Account
          </button>
        </div>

        {success && mode === "register" ? (
          <div className="mp-success-box">
            <div className="mp-success-icon">✅</div>
            <p>{msg}</p>
            <button className="mp-btn-primary" onClick={() => { setMode("login"); setMsg(""); setSuccess(false); }}>
              Go to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mp-form">
            {mode === "register" && (
              <div className="mp-field-note">
                Use the email address your coach has on file for your account.
              </div>
            )}

            <div className="mp-field">
              <label>Email</label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            <div className="mp-field">
              <label>Password</label>
              <input
                type="password" required autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={pw} onChange={e => setPw(e.target.value)}
                placeholder={mode === "login" ? "Your password" : "Min. 8 characters"}
              />
            </div>

            {mode === "register" && (
              <div className="mp-field">
                <label>Confirm Password</label>
                <input
                  type="password" required autoComplete="new-password"
                  value={pw2} onChange={e => setPw2(e.target.value)}
                  placeholder="Repeat your password"
                />
              </div>
            )}

            {msg && <div className="mp-error">{msg}</div>}

            <button type="submit" className="mp-btn-primary" disabled={loading}>
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        )}

        {mode === "register" && !success && (
          <p className="mp-help-text">
            Portal access must be enabled by your coach before you can create an account.
            Contact us if you have any issues.
          </p>
        )}

        <div className="mp-login-footer">
          <a href="/ui" className="mp-staff-link">Staff login →</a>
        </div>
      </div>
    </div>
  );
}
