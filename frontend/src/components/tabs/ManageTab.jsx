// ── Manage tab ────────────────────────────────────────────────────────
import { Badge } from "../ui/Badge.jsx";

export function ManageTab({ member, onEdit, onDeleteMember }) {
  const fullName = `${member.first_name} ${member.last_name}`;

  return (
    <>
      <div className="intel-section">
        <h4>Member Information</h4>
        <div className="detail-grid">
          <div className="detail-metric">
            <span>Status</span>
            <strong style={{ fontSize: "14px" }}><Badge value={member.status || "Active"} /></strong>
          </div>
          <div className="detail-metric">
            <span>Gender</span>
            <strong style={{ fontSize: "14px" }}>{member.gender || "—"}</strong>
          </div>
          <div className="detail-metric">
            <span>Age</span>
            <strong>{member.age || "—"}</strong>
          </div>
          <div className="detail-metric">
            <span>Location</span>
            <strong style={{ fontSize: "13px" }}>{member.location || "—"}</strong>
          </div>
          <div className="detail-metric">
            <span>Occupation</span>
            <strong style={{ fontSize: "13px" }}>{member.occupation || "—"}</strong>
          </div>
          <div className="detail-metric">
            <span>Reg. Date</span>
            <strong style={{ fontSize: "12px" }}>{member.registration_date?.slice(0, 10) || "—"}</strong>
          </div>
        </div>
        <div className="detail-grid" style={{ marginTop: "8px" }}>
          <div className="detail-metric">
            <span>Emergency Contact</span>
            <strong style={{ fontSize: "13px" }}>{member.emergency_contact_name || "—"}</strong>
          </div>
          <div className="detail-metric">
            <span>Emergency Phone</span>
            <strong style={{ fontSize: "13px" }}>{member.emergency_contact_phone || "—"}</strong>
          </div>
        </div>
      </div>

      <div className="intel-section">
        <h4>Consents</h4>
        <div className="detail-grid">
          <div className="detail-metric">
            <span>Privacy Consent</span>
            <strong style={{ color: member.privacy_consent ? "var(--success)" : "var(--danger)" }}>
              {member.privacy_consent ? "✓ Yes" : "✗ No"}
            </strong>
          </div>
          <div className="detail-metric">
            <span>Medical Disclaimer</span>
            <strong style={{ color: member.medical_disclaimer_accepted ? "var(--success)" : "var(--danger)" }}>
              {member.medical_disclaimer_accepted ? "✓ Yes" : "✗ No"}
            </strong>
          </div>
          <div className="detail-metric">
            <span>Marketing Consent</span>
            <strong style={{ color: member.marketing_consent ? "var(--success)" : "var(--muted)" }}>
              {member.marketing_consent ? "✓ Yes" : "— No"}
            </strong>
          </div>
          <div className="detail-metric">
            <span>Consent Date</span>
            <strong style={{ fontSize: "12px" }}>{member.consent_signed_at?.slice(0, 10) || "—"}</strong>
          </div>
        </div>
      </div>

      <button
        className="secondary"
        type="button"
        onClick={() => onEdit(member.id)}
        style={{ width: "100%", marginBottom: "12px" }}
      >
        ✏ Edit Full Profile
      </button>

      <div className="danger-zone">
        <h4>⚠ Danger Zone</h4>
        <p>
          Permanently delete <strong>{fullName}</strong> and all their associated data —
          assessments, progress entries, workout plans, nutrition plans, and supplement plans.
          This action cannot be undone.
        </p>
        <button
          className="danger"
          type="button"
          onClick={() => onDeleteMember(member.id, fullName)}
        >
          🗑 Delete Member
        </button>
      </div>
    </>
  );
}
