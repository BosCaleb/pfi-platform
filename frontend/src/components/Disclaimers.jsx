// ── Disclaimers page ─────────────────────────────────────────────────
// Full platform disclaimer pack. Not legal advice — have reviewed by a
// qualified South African legal professional before public launch.

const SECTIONS = [
  {
    id: 1,
    title: "Medical and Health Disclaimer",
    icon: "🏥",
    content: [
      `The information, workouts, assessments, nutrition guidance, supplement suggestions and progress insights provided on this platform are for general fitness, wellness and educational purposes only.`,
      `They are not intended to diagnose, treat, cure or prevent any medical condition.`,
      `Members should consult a qualified medical professional before starting any exercise, nutrition or supplement programme, especially if they:`,
      {
        list: [
          "Have any injuries",
          "Have chronic medical conditions",
          "Are taking medication",
          "Are pregnant or breastfeeding",
          "Have high blood pressure",
          "Have heart-related concerns",
          "Have diabetes, asthma or any other condition that may affect exercise safety",
          "Have been advised to obtain medical clearance before exercise",
        ],
      },
      `By using this platform, the member confirms that they participate voluntarily and understand that physical exercise involves risk.`,
    ],
  },
  {
    id: 2,
    title: "Exercise Risk and Injury Disclaimer",
    icon: "⚠️",
    content: [
      `Physical exercise carries inherent risks, including but not limited to muscle soreness, strain, injury, dizziness, fatigue or aggravation of an existing condition.`,
      `Members must stop exercising immediately if they experience:`,
      {
        list: [
          "Chest pain",
          "Severe shortness of breath",
          "Dizziness",
          "Fainting",
          "Sharp pain",
          "Numbness",
          "Unusual discomfort",
          "Any concerning symptoms",
        ],
      },
      `The platform and gym are not responsible for injuries resulting from:`,
      {
        list: [
          "Incorrect exercise execution",
          "Failure to disclose medical information",
          "Ignoring safety warnings",
          "Overexertion",
          "Misuse of equipment",
          "Failure to follow coach instructions",
          "Training while injured or unwell",
        ],
      },
    ],
  },
  {
    id: 3,
    title: "Medical Clearance Disclaimer",
    icon: "📋",
    content: [
      `Some members may require medical clearance before participating in high-intensity, strenuous or specialised exercise.`,
      `Medical clearance may be required where a member has:`,
      {
        list: [
          "Chronic health conditions",
          "Recent or recurring injuries",
          "High blood pressure",
          "Heart-related concerns",
          "Pregnancy",
          "Medication use that may affect exercise",
          "Previous surgery",
          "Significant pain or mobility limitations",
          "A medium or high risk profile",
        ],
      },
      `Where medical clearance is required, the admin or coach should not prescribe or approve intense training until appropriate clearance has been confirmed.`,
    ],
  },
  {
    id: 4,
    title: "Nutrition Disclaimer",
    icon: "🥗",
    content: [
      `Nutrition information provided through this platform is for general wellness and fitness guidance only.`,
      `It does not replace personalised advice from a registered dietitian, nutritionist, doctor or other qualified healthcare professional.`,
      `Members with the following should consult a qualified professional before following any nutrition guidance:`,
      {
        list: [
          "Medical conditions",
          "Allergies",
          "Eating disorders",
          "Pregnancy or breastfeeding",
          "Chronic illness",
          "Medication use",
          "Specialised dietary needs",
          "Diabetes",
          "High blood pressure",
          "Kidney, liver or heart concerns",
        ],
      },
      `The platform does not guarantee that any nutrition recommendation is suitable for every member.`,
    ],
  },
  {
    id: 5,
    title: "Supplement Disclaimer",
    icon: "💊",
    content: [
      `Supplement suggestions on this platform are for general informational purposes only.`,
      `They do not constitute medical advice, a prescription or a guarantee of safety or effectiveness.`,
      `Supplements may interact with medication, medical conditions or existing treatment plans.`,
      `Members should consult a qualified healthcare professional before using any supplement, especially if they:`,
      {
        list: [
          "Are pregnant or breastfeeding",
          "Are under 18",
          "Take medication",
          "Have chronic conditions",
          "Have high blood pressure",
          "Have kidney or liver concerns",
          "Have heart conditions",
          "Have any known medical risk",
          "Have been advised to avoid certain substances",
        ],
      },
      `The platform does not guarantee the safety, effectiveness or suitability of any supplement for a specific member.`,
    ],
  },
  {
    id: 6,
    title: "AI and Automated Recommendation Disclaimer",
    icon: "🤖",
    content: [
      `Any automated, AI-generated or system-generated recommendation is intended to assist the admin or coach.`,
      `It should not be treated as final medical, fitness, nutrition or supplement advice.`,
      `All recommendations must be reviewed and approved by a qualified coach, admin or relevant professional before being applied to a member's plan.`,
      `The platform may use member data to suggest adjustments, but final responsibility for approving and applying changes remains with the admin or coach.`,
      { callout: "AI can recommend. Admin must approve." },
    ],
  },
  {
    id: 7,
    title: "Results Disclaimer",
    icon: "📊",
    content: [
      `Fitness, weight loss, strength, performance, body composition and wellness results vary from person to person.`,
      `Results depend on many factors, including:`,
      {
        list: [
          "Consistency",
          "Effort",
          "Genetics",
          "Nutrition",
          "Sleep",
          "Stress",
          "Medical history",
          "Lifestyle",
          "Programme adherence",
          "Recovery",
          "Training experience",
        ],
      },
      `The platform does not guarantee specific results, weight loss, muscle gain, performance improvement, body composition change or health outcomes.`,
      `Testimonials, progress photos and transformation examples are individual experiences and do not guarantee that another member will achieve the same or similar results.`,
    ],
  },
  {
    id: 8,
    title: "Data Privacy and POPIA Disclaimer",
    icon: "🔒",
    content: [
      `By registering, the member consents to the collection and processing of personal information, including fitness, health, lifestyle, assessment and progress information, for the purpose of:`,
      {
        list: [
          "Gym administration",
          "Coaching",
          "Programme planning",
          "Workout planning",
          "Nutrition guidance",
          "Supplement guidance",
          "Progress tracking",
          "Member support",
          "Risk management",
          "Platform improvement",
        ],
      },
      `Personal information will be processed in accordance with applicable South African data protection laws, including the Protection of Personal Information Act, 4 of 2013.`,
    ],
  },
  {
    id: 9,
    title: "Consent to Use Health and Fitness Data",
    icon: "✅",
    content: [
      `I consent to the gym collecting and processing my personal, health, fitness, assessment, lifestyle and progress information for the purpose of creating and managing my member profile, workout plans, nutrition guidance, supplement guidance, progress tracking and coaching support.`,
      `I confirm that the information I provide is accurate and complete to the best of my knowledge.`,
      `I understand that failure to disclose relevant health, injury or medical information may increase the risk of injury or inappropriate programme recommendations.`,
    ],
  },
  {
    id: 10,
    title: "Emergency Disclaimer",
    icon: "🚨",
    content: [
      `This platform is not an emergency medical service.`,
      `If a member experiences a medical emergency, severe injury, chest pain, difficulty breathing, fainting, signs of stroke or any serious symptoms, they must stop exercising immediately and seek emergency medical assistance.`,
      `The gym, admin, coach and platform cannot provide emergency medical treatment through the platform.`,
    ],
  },
  {
    id: 11,
    title: "Equipment and Facility Use Disclaimer",
    icon: "🏋️",
    content: [
      `Members must use gym equipment safely and only for its intended purpose.`,
      `Members should ask for assistance if they are unsure how to use any equipment.`,
      `The gym is not responsible for injury caused by:`,
      {
        list: [
          "Misuse of equipment",
          "Ignoring instructions",
          "Unsafe behaviour",
          "Failure to report damaged equipment",
          "Training without supervision where supervision is required",
          "Using equipment beyond the member's ability or clearance level",
        ],
      },
      `Members must report damaged, faulty or unsafe equipment immediately.`,
    ],
  },
  {
    id: 12,
    title: "Member Responsibility Disclaimer",
    icon: "👤",
    content: [
      `Members are responsible for:`,
      {
        list: [
          "Listening to their bodies",
          "Reporting pain or discomfort",
          "Updating their health information",
          "Following instructions carefully",
          "Informing the admin or coach of any changes to their medical, injury or fitness status",
          "Using equipment safely",
          "Stopping exercise when symptoms or pain occur",
          "Seeking medical advice where necessary",
        ],
      },
      `The platform depends on accurate and honest member information. Incorrect, incomplete or outdated information may affect the quality and safety of recommendations.`,
    ],
  },
  {
    id: 13,
    title: "Under-18 / Minor Disclaimer",
    icon: "🧒",
    content: [
      `Members under the age of 18 require consent from a parent or legal guardian before registering or participating in any exercise, nutrition or supplement-related programme.`,
      `The parent or legal guardian must confirm that they understand the risks of exercise and consent to the collection and processing of the minor's personal and fitness-related information.`,
      `Supplement guidance for minors should not be provided without appropriate professional review and guardian consent.`,
    ],
  },
  {
    id: 14,
    title: "Payment, Cancellation and Refund Disclaimer",
    icon: "💳",
    content: [
      `Membership fees, cancellations, refunds, pauses and notice periods are governed by the platform's membership terms.`,
      `Members should review the cancellation and refund policy before registering.`,
      `Membership payments, billing dates, refunds, cancellations, pauses and notice periods are subject to the gym's official membership agreement. No verbal agreement will override the written membership terms unless confirmed in writing by the gym.`,
    ],
  },
  {
    id: 15,
    title: "Testimonials, Progress Photos and Marketing Disclaimer",
    icon: "📸",
    content: [
      `Testimonials, progress photos and transformation stories reflect individual experiences.`,
      `They do not guarantee that other members will achieve the same or similar results.`,
      `Progress photos, testimonials or transformation results may only be used for marketing if the member has given specific written consent.`,
    ],
  },
  {
    id: 16,
    title: "Website Content Disclaimer",
    icon: "🌐",
    content: [
      `The information displayed on this website is provided for general information and educational purposes only.`,
      `Although the platform aims to provide accurate and useful information, no guarantee is made that all content is complete, current, error-free or suitable for every member.`,
      `The gym reserves the right to update, change or remove website content, platform features, workouts, plans or recommendations at any time.`,
    ],
  },
  {
    id: 17,
    title: "Platform Availability Disclaimer",
    icon: "⚡",
    content: [
      `The platform may occasionally be unavailable due to maintenance, updates, technical issues or factors outside the gym's control.`,
      `The gym does not guarantee uninterrupted access to the platform.`,
      `Members should contact the gym directly if they cannot access important workout, nutrition or coaching information.`,
    ],
  },
  {
    id: 18,
    title: "Third-Party Links and Tools Disclaimer",
    icon: "🔗",
    content: [
      `The platform may contain links to third-party websites, videos, tools, payment providers, wearable devices, analytics tools or external resources.`,
      `The gym is not responsible for the content, accuracy, privacy practices, security or availability of third-party services.`,
      `Members should review the terms and privacy policies of any third-party services they use.`,
    ],
  },
  {
    id: 19,
    title: "Coaching Scope Disclaimer",
    icon: "🎯",
    content: [
      `The platform supports fitness coaching, progress tracking and general wellness guidance.`,
      `Unless explicitly stated, the platform and gym do not provide:`,
      {
        list: [
          "Medical diagnosis",
          "Medical treatment",
          "Physiotherapy",
          "Psychological counselling",
          "Registered dietetic treatment",
          "Prescription medication advice",
          "Clinical rehabilitation",
          "Emergency medical care",
        ],
      },
      `Members requiring specialised professional care should consult an appropriately qualified professional.`,
    ],
  },
  {
    id: 20,
    title: "High-Risk Member Disclaimer",
    icon: "🔴",
    content: [
      `If a member is marked as medium or high risk, has pain flags, reports recurring symptoms, has medical clearance outstanding or has a known injury, the admin or coach should review the member's profile before approving training.`,
      `The system may display alerts, but these alerts do not replace professional judgement.`,
      { callout: "Training caution: This member has health, injury or risk factors that may require modification, supervision or medical clearance." },
    ],
  },
  {
    id: 21,
    title: "Admin Override Disclaimer",
    icon: "🛡️",
    content: [
      `Admins may override system warnings or recommendations where appropriate.`,
      `However, overriding a warning should require a written reason and should be done responsibly.`,
      { callout: "By overriding this warning, the admin confirms that they have reviewed the member's profile, considered the potential risk and recorded a reason for proceeding." },
    ],
  },
  {
    id: 22,
    title: "Member Check-In Disclaimer",
    icon: "📅",
    content: [
      `Member check-ins are used to support coaching decisions and progress tracking.`,
      `Check-ins are not medical assessments.`,
      `Members must report serious symptoms, injuries or health concerns directly to a qualified healthcare professional and should not rely only on platform check-ins for safety decisions.`,
    ],
  },
  {
    id: 23,
    title: "Reassessment Alert Disclaimer",
    icon: "🔔",
    content: [
      `Reassessment alerts are system-generated prompts to help admins and coaches identify members who may need review.`,
      `These alerts are not medical advice and do not replace coach judgement or professional healthcare assessment.`,
      `Admins should review the member's full profile, progress history and any reported symptoms before making changes.`,
    ],
  },
  {
    id: 24,
    title: "Recommended Legal Pages",
    icon: "📄",
    content: [
      `The website should include links to:`,
      {
        list: [
          "Terms and Conditions",
          "Privacy Policy",
          "Medical and Fitness Disclaimer",
          "Nutrition and Supplement Disclaimer",
          "Member Waiver and Indemnity",
          "POPIA Consent Notice",
          "Cookie Policy",
          "Cancellation and Refund Policy",
        ],
      },
    ],
  },
];

function ContentBlock({ item }) {
  if (typeof item === "string") {
    return <p className="disc-paragraph">{item}</p>;
  }
  if (item.list) {
    return (
      <ul className="disc-list">
        {item.list.map((li) => <li key={li}>{li}</li>)}
      </ul>
    );
  }
  if (item.callout) {
    return <div className="disc-callout">{item.callout}</div>;
  }
  return null;
}

export function Disclaimers({ onBack }) {
  return (
    <section className="disc-shell animate-in">

      {/* Header */}
      <div className="disc-header">
        <button className="ghost" type="button" onClick={onBack} style={{ marginBottom: 4 }}>
          ← Back
        </button>
        <h2 style={{ margin: "8px 0 4px" }}>Platform Disclaimers &amp; Legal Notices</h2>
        <p className="muted text-sm" style={{ maxWidth: 640, lineHeight: 1.6 }}>
          This document is a working disclaimer pack for website, registration and platform wording.
          It is <strong>not legal advice</strong>. Before publishing the platform publicly, the final
          Terms and Conditions, Privacy Policy, Waiver and POPIA wording should be reviewed by a
          qualified South African legal professional.
        </p>
      </div>

      {/* Table of contents */}
      <nav className="disc-toc panel">
        <p className="eyebrow" style={{ marginBottom: 10 }}>Contents</p>
        <ol className="disc-toc-list">
          {SECTIONS.map(({ id, title }) => (
            <li key={id}>
              <a href={`#disc-${id}`} className="disc-toc-link">
                {id}. {title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Sections */}
      {SECTIONS.map(({ id, title, icon, content }) => (
        <article className="disc-section panel" key={id} id={`disc-${id}`}>
          <h3 className="disc-section-title">
            <span className="disc-num">{String(id).padStart(2, "0")}</span>
            <span className="disc-icon">{icon}</span>
            {title}
          </h3>
          <div className="disc-body">
            {content.map((item, i) => (
              <ContentBlock key={i} item={item} />
            ))}
          </div>
        </article>
      ))}

      {/* Footer note */}
      <div className="disc-footer-note panel">
        <p className="muted text-sm" style={{ lineHeight: 1.6 }}>
          <strong>Important note:</strong> This disclaimer pack has not been reviewed by a legal
          professional. Consult a qualified South African attorney before publishing any of this
          wording on a live or public-facing platform.
        </p>
      </div>

      <div style={{ textAlign: "center", paddingBottom: 8 }}>
        <button className="ghost" type="button" onClick={onBack}>← Back to Home</button>
      </div>

    </section>
  );
}
