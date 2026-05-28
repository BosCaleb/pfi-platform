/**
 * MemberPortalApp — root component for the member-facing portal.
 * Served at /portal — completely separate from the admin UI.
 * Uses its own auth state (member JWT, not admin JWT).
 */
import { useState, useEffect } from "react";
import MemberLogin     from "./MemberLogin.jsx";
import MemberPortal    from "./MemberPortal.jsx";
import "../../portal.css";

const STORAGE_KEY  = "pfi_member_token";
const STORAGE_INFO = "pfi_member_info";

export default function MemberPortalApp() {
  const [token,  setToken]  = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [member, setMember] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_INFO) || "null"); } catch { return null; }
  });

  const handleLogin = (accessToken, memberInfo) => {
    localStorage.setItem(STORAGE_KEY,  accessToken);
    localStorage.setItem(STORAGE_INFO, JSON.stringify(memberInfo));
    setToken(accessToken);
    setMember(memberInfo);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_INFO);
    setToken("");
    setMember(null);
  };

  if (!token || !member) {
    return <MemberLogin onLogin={handleLogin} />;
  }

  return <MemberPortal token={token} member={member} onLogout={handleLogout} />;
}
