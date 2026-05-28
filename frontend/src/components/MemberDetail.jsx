// ── MemberDetail ──────────────────────────────────────────────────────
import { useState } from "react";
import { Badge }         from "./ui/Badge.jsx";
import { OverviewTab }   from "./tabs/OverviewTab.jsx";
import { ProgressTab }   from "./tabs/ProgressTab.jsx";
import { PlansTab }      from "./tabs/PlansTab.jsx";
import { WorkoutTab }    from "./tabs/WorkoutTab.jsx";
import { ReadinessTab }  from "./tabs/ReadinessTab.jsx";
import { CoachingIntelligenceTab } from "./tabs/CoachingIntelligenceTab.jsx";
import { ManageTab }     from "./tabs/ManageTab.jsx";
import { initials, avatarVariant } from "../utils/helpers.js";

export function MemberDetail({ member, token, onEdit, onDeleteMember, onDeleteAssessment, onDeleteProgress, onDeletePlan }) {
  const [innerTab, setInnerTab] = useState("overview");

  const computed = member.computed || {};
  const variant  = avatarVariant(member.id);

  const INNER_TABS = [
    { id: "overview",  label: "Overview" },
    { id: "progress",  label: `Progress (${(member.progress_entries || []).length})` },
    {
      id: "plans",
      label: `Plans (${
        (member.workout_plans    || []).length +
        (member.nutrition_plans  || []).length +
        (member.supplement_plans || []).length
      })`,
    },
    { id: "workout",   label: "Workout" },
    { id: "readiness",  label: "Readiness" },
    { id: "coaching",   label: "🧠 Coaching" },
    { id: "manage",     label: "Manage" },
  ];

  return (
    <>
      {/* Profile header */}
      <div className="member-profile-header">
        <div className={`member-avatar avatar-${variant}`}>
          {initials(member.first_name, member.last_name)}
        </div>
        <div>
          <div className="member-profile-name">{member.first_name} {member.last_name}</div>
          <div className="member-profile-email">{member.email}</div>
          {member.phone && <div className="member-profile-email">{member.phone}</div>}
          <div className="member-profile-badges">
            <Badge value={member.risk_level  || "Low"} />
            <Badge value={member.status      || "Active"} />
            {member.fitness_level && <Badge value={member.fitness_level} />}
          </div>
        </div>
      </div>

      {/* Inner tab bar */}
      <div className="detail-inner-tabs">
        {INNER_TABS.map(({ id, label }) => (
          <button
            key={id}
            className={`detail-inner-tab ${innerTab === id ? "active" : ""}`}
            type="button"
            onClick={() => setInnerTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {innerTab === "overview"  && <OverviewTab  member={member} computed={computed} onEdit={onEdit} />}
      {innerTab === "progress"  && <ProgressTab  member={member} onDeleteAssessment={onDeleteAssessment} onDeleteProgress={onDeleteProgress} />}
      {innerTab === "plans"     && <PlansTab     member={member} onDeletePlan={onDeletePlan} />}
      {innerTab === "workout"   && <WorkoutTab    member={member} token={token} />}
      {innerTab === "readiness" && <ReadinessTab             member={member} token={token} />}
      {innerTab === "coaching"  && <CoachingIntelligenceTab member={member} token={token} />}
      {innerTab === "manage"    && <ManageTab               member={member} token={token} onEdit={onEdit} onDeleteMember={onDeleteMember} />}
    </>
  );
}
