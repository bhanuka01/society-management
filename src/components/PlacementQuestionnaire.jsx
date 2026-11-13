import { useState } from "react";
import {
  DollarSign,
  Megaphone,
  UserCheck,
  Share2,
  Cpu,
  FileSearch,
  Check,
  ChevronDown,
  ChevronUp,
  Link2,
  FileText,
  Clock,
  Sparkles,
  Award,
  AlertCircle
} from "lucide-react";

export const OFFICIAL_FUNCTIONAL_TEAMS = [
  "Research and Analysis",
  "Public Relations",
  "Personal Development",
  "Operations and Academic Management",
  "Marketing",
  "Finance",
];

export const EXECUTIVE_FUNCTION_MANAGERS = {
  "Research and Analysis": [
    "Research Engage Manager",
    "Process & Progress Monitoring Manager",
    "Research Skill Development Manager",
    "Publication & Opportunity Manager",
  ],
  "Public Relations": [
    "Sustainability Manager",
    "Sponsorship Manager",
    "Communication Manager",
    "Documentation Manager",
  ],
  "Personal Development": [
    "Event & Engagement Manager",
    "Career Development & Training Manager",
    "Content & Training Manager",
    "Communication & Community Manager",
  ],
  "Operations and Academic Management": [
    "Statistics Studies Manager",
    "Economics & Finance Studies",
    "Software Developer Manager",
    "Actuarial Studies Manager",
    "Finance Manager",
  ],
  Marketing: [
    "Brand Manager",
    "Showcasing Manager",
    "Web Development Manager",
  ],
  Finance: [
    "Project Finance Specialist",
    "Partnership Specialist",
    "Audit & Legal Analyst",
    "Financial Report Analyst",
  ],
};

export const EXECUTIVE_FUNCTION_VICE_PRESIDENTS = {
  "Research and Analysis": "Vice President — Research and Analysis",
  "Public Relations": "Vice President — Public Relations",
  "Personal Development": "Vice President — Personal Development",
  "Operations and Academic Management": "Vice President — Operations and Academic Management",
  Marketing: "Vice President — Marketing",
  Finance: "Vice President — Finance",
};

export function getValidExecutivePositions(functionName) {
  if (!functionName) return [];
  return [
    EXECUTIVE_FUNCTION_VICE_PRESIDENTS[functionName],
    ...(EXECUTIVE_FUNCTION_MANAGERS[functionName] || []),
  ].filter(Boolean);
}

export const FUNCTION_INFO_CARDS = [
  {
    id: "finance",
    functionName: "Finance",
    badge: "Budgeting & Partnerships",
    icon: DollarSign,
    color: "#10b981",
    defaultCapacity: 30,
    descriptionLines: [
      "Manages society budgets, financial tracking, and project cost planning across events.",
      "Prepares accurate financial reports, cashflow statements, and post-event reconciliations.",
      "Supports corporate partnership financial proposals and sponsorship fund allocation.",
      "Ensures audit compliance, legal documentation checks, and transparent governance.",
    ],
  },
  {
    id: "marketing",
    functionName: "Marketing",
    badge: "Brand & Web Presence",
    icon: Megaphone,
    color: "#ec4899",
    defaultCapacity: 30,
    descriptionLines: [
      "Shapes the visual identity, brand guidelines, and creative direction of ADSS Ruhuna.",
      "Designs promotional flyers, social media campaigns, and event showcasing materials.",
      "Builds and maintains the society web portal, landing pages, and digital media assets.",
      "Amplifies student achievements, workshops, and announcements across all channels.",
    ],
  },
  {
    id: "personalDevelopment",
    functionName: "Personal Development",
    badge: "Training & Community",
    icon: UserCheck,
    color: "#8b5cf6",
    defaultCapacity: 30,
    descriptionLines: [
      "Plans interactive workshops, icebreakers, and member engagement sessions.",
      "Organizes career development clinics, mentorship circles, and mock interviews.",
      "Curates educational training materials, soft-skill guides, and study resources.",
      "Fosters active community communication and supportive student onboarding.",
    ],
  },
  {
    id: "publicRelations",
    functionName: "Public Relations",
    badge: "Outreach & Sponsorship",
    icon: Share2,
    color: "#3b82f6",
    defaultCapacity: 30,
    descriptionLines: [
      "Builds long-term sustainability initiatives and external industry collaborations.",
      "Leads corporate sponsorship outreach, pitch decks, and partner relationship follow-ups.",
      "Drafts official correspondence, university letters, and formal society documentation.",
      "Coordinates external communications and represents ADSS with institutional stakeholders.",
    ],
  },
  {
    id: "operationsAcademics",
    functionName: "Operations and Academic Management",
    badge: "Actuarial, Stats & Tech",
    icon: Cpu,
    color: "#f59e0b",
    defaultCapacity: 30,
    descriptionLines: [
      "Supports academic study circles in Statistics, Economics & Finance, and Actuarial Science.",
      "Develops society software tools, data workflows, and technical project implementations.",
      "Coordinates operational logistics, academic competitions, and study-track initiatives.",
      "Bridges classroom theory with applied quantitative, financial, and software practice.",
    ],
  },
  {
    id: "researchAnalysis",
    functionName: "Research and Analysis",
    badge: "Research & Publications",
    icon: FileSearch,
    color: "#06b6d4",
    defaultCapacity: 30,
    descriptionLines: [
      "Drives collaborative undergraduate research engagement and quantitative inquiry.",
      "Monitors project milestones, analytical progress, and research team deliverables.",
      "Conducts training in research methodology, LaTeX, data tools, and academic writing.",
      "Identifies journal, conference, and publication opportunities for society members.",
    ],
  },
];

export function normalizeFunctionName(fn) {
  if (!fn || typeof fn !== "string") return "";
  const trimmed = fn.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "operations & academics management" || lower === "operations and academic management") {
    return "Operations and Academic Management";
  }
  if (lower === "research & analysis" || lower === "research and analysis") {
    return "Research and Analysis";
  }
  if (lower === "public relations") return "Public Relations";
  if (lower === "personal development") return "Personal Development";
  if (lower === "marketing") return "Marketing";
  if (lower === "finance") return "Finance";
  return trimmed;
}

export const DEFAULT_FUNCTION_AVAILABILITY = FUNCTION_INFO_CARDS.reduce((acc, card) => {
  acc[card.functionName] = {
    filled: 0,
    capacity: card.defaultCapacity || 30,
    isFull: false,
  };
  return acc;
}, {});

export const PREFERRED_FOCUS_AREAS = [
  "Finance & Corporate Sponsorship",
  "Marketing, Media & Web",
  "Personal Development & Training",
  "Public Relations & Event Communications",
  "Operations, Actuarial & Data Analytics",
  "Academic Research & Publications",
];

export const FUNCTION_SKILLS_CONFIG = [
  {
    id: "finance",
    functionName: "Finance",
    badge: "Budgeting & Sponsorship",
    icon: DollarSign,
    color: "#10b981",
    skills: [
      "Financial budgeting, record keeping, accounting",
      "Advanced Excel / Google Sheets financial models",
      "Auditing procedures, governance compliance, contract review",
      "Corporate pitch drafting & partner negotiations",
    ],
    scenarioPrompt:
      "Describe your experience handling financial spreadsheets, preparing budget estimates for university projects, or reviewing formal sponsorship agreements.",
    fieldType: "textarea",
  },
  {
    id: "marketing",
    functionName: "Marketing",
    badge: "Design & Digital Media",
    icon: Megaphone,
    color: "#ec4899",
    skills: [
      "Graphic design (Photoshop, Illustrator, Canva, Figma)",
      "Web development & maintenance (HTML/CSS/JS, React, full-stack, CMS)",
      "Social media management, scheduling, brand consistency",
      "Newsletter / magazine / promotional content creation",
    ],
    scenarioPrompt: "Link to design portfolio, GitHub profile, or writing samples.",
    fieldType: "input",
  },
  {
    id: "personalDevelopment",
    functionName: "Personal Development",
    badge: "Workshops & Mentorship",
    icon: UserCheck,
    color: "#8b5cf6",
    skills: [
      "Designing curriculum, tutorials, or study materials",
      "Hosting webinars, icebreakers, team games, engagement activities",
      "Organizing mentorship programs, guest speakers, mock interviews",
      "Managing community group communication & student support",
    ],
    scenarioPrompt:
      "What workshop or career-prep session would you organize for FMIS undergraduates?",
    fieldType: "textarea",
  },
  {
    id: "publicRelations",
    functionName: "Public Relations",
    badge: "Corporate Outreach & Media",
    icon: Share2,
    color: "#3b82f6",
    skills: [
      "Official formal letter drafting & university correspondence",
      "Corporate outreach, stakeholder networking, cold outreach",
      "Sponsorship deck preparation & fundraising campaigns",
      "Public speaking, external representation, relationship management",
    ],
    scenarioPrompt:
      "How would you pitch ADSS to a financial or tech company to secure sponsorship or an event partnership?",
    fieldType: "textarea",
  },
  {
    id: "operationsAcademics",
    functionName: "Operations and Academic Management",
    badge: "Actuarial & Analytics",
    icon: Cpu,
    color: "#f59e0b",
    skills: [
      "Actuarial modeling (SOA/IFoA, life/non-life contingencies)",
      "Statistical modeling & data analysis (R, Python, SPSS, SAS)",
      "Software engineering / app development (Python, mobile/web, databases)",
      "Applied economics, econometrics, investment/portfolio analysis",
    ],
    scenarioPrompt:
      "Which FMIS domain is your strongest, and what academic competition or project would you organize?",
    fieldType: "textarea",
  },
  {
    id: "researchAnalysis",
    functionName: "Research and Analysis",
    badge: "Publications & Reporting",
    icon: FileSearch,
    color: "#06b6d4",
    skills: [
      "Research methodology, literature review, paper writing",
      "Research tools (LaTeX, Overleaf, Mendeley/Zotero)",
      "Identifying journal/conference publication opportunities",
      "Project milestone tracking, progress audits, analytical reporting",
    ],
    scenarioPrompt:
      "Describe any research projects, paper writing, or quantitative analysis, including tools and frameworks used.",
    fieldType: "textarea",
  },
];

export const INITIAL_QUESTIONNAIRE = {
  academicStanding: "Level I",
  focusAreas: [],
  firstChoiceFunction: "",
  secondChoiceFunction: "",
  weeklyCommitment: "4 - 6 hours / week",
  functionSkills: {
    finance: { skills: [], scenario: "" },
    marketing: { skills: [], portfolio: "" },
    personalDevelopment: { skills: [], scenario: "" },
    publicRelations: { skills: [], scenario: "" },
    operationsAcademics: { skills: [], scenario: "" },
    researchAnalysis: { skills: [], scenario: "" },
  },
  portfolioLink: "",
  contributionNote: "",
};

export default function PlacementQuestionnaire({
  value = INITIAL_QUESTIONNAIRE,
  onChange,
  isDark = true,
  validationErrors = {},
  step = "all", // "all" | "preferences" | "skills"
}) {
  const [expandedSections, setExpandedSections] = useState(() => {
    const initial = { finance: true };
    if (value?.firstChoiceFunction) {
      const match = FUNCTION_SKILLS_CONFIG.find(
        (c) => c.functionName === value.firstChoiceFunction
      );
      if (match) initial[match.id] = true;
    }
    return initial;
  });

  const toggleSection = (id) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const allExpanded = FUNCTION_SKILLS_CONFIG.every((g) => expandedSections[g.id]);

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedSections({});
    } else {
      const all = {};
      FUNCTION_SKILLS_CONFIG.forEach((g) => {
        all[g.id] = true;
      });
      setExpandedSections(all);
    }
  };

  const update = (patch) => {
    onChange({ ...value, ...patch });
  };

  const handleToggleFocusArea = (area) => {
    const current = value.focusAreas || [];
    if (current.includes(area)) {
      update({ focusAreas: current.filter((a) => a !== area) });
    } else {
      if (current.length < 2) {
        update({ focusAreas: [...current, area] });
      }
    }
  };

  const handleToggleSkill = (funcId, skill) => {
    const currentSkills = value.functionSkills?.[funcId]?.skills || [];
    const nextSkills = currentSkills.includes(skill)
      ? currentSkills.filter((s) => s !== skill)
      : [...currentSkills, skill];

    update({
      functionSkills: {
        ...value.functionSkills,
        [funcId]: {
          ...(value.functionSkills?.[funcId] || {}),
          skills: nextSkills,
        },
      },
    });
  };

  const handleFunctionScenarioChange = (funcId, fieldKey, val) => {
    update({
      functionSkills: {
        ...value.functionSkills,
        [funcId]: {
          ...(value.functionSkills?.[funcId] || {}),
          [fieldKey]: val,
        },
      },
    });
  };

  const levels = ["Level I", "Level II", "Level III", "Level IV"];
  const commitmentOptions = [
    "2 - 4 hours / week",
    "4 - 6 hours / week",
    "6 - 8 hours / week",
    "8 - 12 hours / week",
    "12+ hours / week",
  ];

  const showPreferences = step === "all" || step === "preferences";
  const showSkills = step === "all" || step === "skills";

  return (
    <div className="space-y-6 pt-1 animate-in fade-in-50 duration-300">
      {/* ── PART 1: Placement Preferences (Academic Standing, Focus Areas, Choices, Commitment) ── */}
      {showPreferences && (
        <>
          {/* Questionnaire Header Pill */}
          <div
            className={`p-3.5 rounded-[8px] border flex items-start gap-3 ${
              isDark
                ? "bg-[#131416] border-[#27292e] text-[#d0d6e0]"
                : "bg-indigo-50/60 border-indigo-100 text-indigo-950"
            }`}
          >
            <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5 text-indigo-400" />
            <div className="text-[12.5px] leading-relaxed">
              <strong className="block text-[13px] font-[510] mb-0.5">
                Placement & Skills Assessment Questionnaire
              </strong>
              <span className={isDark ? "text-[#8a8f98]" : "text-gray-600"}>
                New applicant functional teams are assigned by the executive
                committee based on this placement profile. Please complete each
                section accurately.
              </span>
            </div>
          </div>

          {/* ── Sub-section 2.a: Academic Standing ── */}
          <div id="field-academicStanding" className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                className={`block text-[13px] font-[510] ${
                  validationErrors.academicStanding
                    ? "text-[#eb5757]"
                    : isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                }`}
              >
                Academic Standing (BSc FMIS Level) <span className="text-[#eb5757]">*</span>
              </label>
              <span className={`text-[11px] font-berkeley-mono ${
                validationErrors.academicStanding
                  ? "text-[#eb5757] font-semibold"
                  : isDark ? "text-[#8a8f98]" : "text-gray-500"
              }`}>
                Required
              </span>
            </div>

            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 rounded-[8px] transition-colors ${
              validationErrors.academicStanding
                ? isDark
                  ? "border border-[#eb5757]/60 bg-[#eb5757]/5 ring-1 ring-[#eb5757]/30"
                  : "border border-rose-400 bg-rose-50/50 ring-1 ring-rose-400/20"
                : ""
            }`}>
              {levels.map((lvl) => {
                const isSelected = value.academicStanding === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => update({ academicStanding: lvl })}
                    className={`py-2 px-3 rounded-[6px] border text-[13px] font-[510] transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isSelected
                        ? isDark
                          ? "bg-[#e4f222]/15 border-[#e4f222] text-[#e4f222] shadow-sm font-semibold"
                          : "bg-indigo-600 border-indigo-600 text-white shadow-sm font-semibold"
                        : isDark
                        ? "bg-[#0f1011] border-[#2e3138] text-[#8a8f98] hover:text-white hover:border-[#424652]"
                        : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <div className={`w-4 h-4 min-w-[16px] min-h-[16px] rounded-full border flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? isDark
                          ? "border-[#e4f222] bg-[#e4f222]"
                          : "border-white bg-white"
                        : isDark
                        ? "border-[#4e5360] bg-[#0c0d0f]"
                        : "border-gray-300 bg-white"
                    }`}>
                      {isSelected && (
                        <div className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-[#08090a]" : "bg-indigo-600"}`} />
                      )}
                    </div>
                    <span>{lvl}</span>
                  </button>
                );
              })}
            </div>
            {validationErrors.academicStanding && (
              <p className="text-[12px] font-medium text-[#eb5757] flex items-center gap-1.5 mt-1 animate-in fade-in-50 duration-150">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{validationErrors.academicStanding}</span>
              </p>
            )}
          </div>

          {/* ── Sub-section 2.b: Preferred Focus Areas (multi-select, max 2) ── */}
          <div id="field-focusAreas" className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                className={`block text-[13px] font-[510] ${
                  validationErrors.focusAreas
                    ? "text-[#eb5757]"
                    : isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                }`}
              >
                Preferred Focus Areas <span className="text-[#eb5757]">*</span>
              </label>
              <span
                className={`text-[11px] font-berkeley-mono px-2 py-0.5 rounded-[4px] border ${
                  (value.focusAreas || []).length === 2
                    ? "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30"
                    : validationErrors.focusAreas
                    ? "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/30"
                    : isDark
                    ? "bg-[#161718] border-[#23252a] text-[#8a8f98]"
                    : "bg-gray-100 border-gray-200 text-gray-600"
                }`}
              >
                {(value.focusAreas || []).length}/2 Selected (Max 2)
              </span>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 rounded-[8px] transition-colors ${
              validationErrors.focusAreas
                ? isDark
                  ? "border border-[#eb5757]/60 bg-[#eb5757]/5 ring-1 ring-[#eb5757]/30"
                  : "border border-rose-400 bg-rose-50/50 ring-1 ring-rose-400/20"
                : ""
            }`}>
              {PREFERRED_FOCUS_AREAS.map((area) => {
                const isSelected = (value.focusAreas || []).includes(area);
                const isMaxReached = (value.focusAreas || []).length >= 2 && !isSelected;

                return (
                  <button
                    key={area}
                    type="button"
                    disabled={isMaxReached}
                    onClick={() => handleToggleFocusArea(area)}
                    className={`p-3 rounded-[8px] border text-left text-[12.5px] transition-all flex items-start gap-3 cursor-pointer group/focus ${
                      isSelected
                        ? isDark
                          ? "bg-[#181a1e] border-[#e4f222]/50 text-white shadow-sm shadow-[#e4f222]/5"
                          : "bg-indigo-50 border-indigo-400 text-indigo-900 font-medium shadow-sm"
                        : isMaxReached
                        ? isDark
                          ? "bg-[#0b0c0d] border-[#1c1d20] text-[#4d5158] opacity-50 cursor-not-allowed"
                          : "bg-gray-50 border-gray-200 text-gray-400 opacity-60 cursor-not-allowed"
                        : isDark
                        ? "bg-[#0c0d0f] border-[#2d3038] text-[#8a8f98] hover:text-[#d0d6e0] hover:border-[#424652] hover:bg-[#111215]"
                        : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 min-w-[20px] min-h-[20px] rounded-[5px] border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected
                          ? isDark
                            ? "bg-[#e4f222] border-[#e4f222] text-[#08090a] scale-105 shadow-sm shadow-[#e4f222]/20"
                            : "bg-indigo-600 border-indigo-600 text-white scale-105 shadow-sm"
                          : isDark
                          ? "border-[#4e5360] bg-[#141518] group-hover/focus:border-[#e4f222]"
                          : "border-gray-400 bg-white group-hover/focus:border-gray-900"
                      }`}
                    >
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 stroke-[3.5] animate-in zoom-in-75 duration-150" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full opacity-0 group-hover/focus:opacity-30 bg-[#e4f222] transition-opacity" />
                      )}
                    </div>
                    <span className="leading-snug pt-0.5">{area}</span>
                  </button>
                );
              })}
            </div>
            {validationErrors.focusAreas && (
              <p className="text-[12px] font-medium text-[#eb5757] flex items-center gap-1.5 mt-1 animate-in fade-in-50 duration-150">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{validationErrors.focusAreas}</span>
              </p>
            )}
          </div>

          {/* ── Sub-section 2.c: Top Preferences (1st & 2nd Choice) ── */}
          <div id="field-choices" className="space-y-3">
            <label
              className={`block text-[13px] font-[510] ${
                validationErrors.choices
                  ? "text-[#eb5757]"
                  : isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
              }`}
            >
              Top Functional Team Preferences <span className="text-[#eb5757]">*</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1st Choice */}
              <div>
                <label
                  className={`block text-[12px] font-berkeley-mono uppercase tracking-wider mb-1 ${
                    validationErrors.choices
                      ? "text-[#eb5757]"
                      : isDark ? "text-[#8a8f98]" : "text-gray-600"
                  }`}
                >
                  1st Choice Function <span className="text-[#eb5757]">*</span>
                </label>
                <select
                  value={value.firstChoiceFunction}
                  onChange={(e) => update({ firstChoiceFunction: e.target.value })}
                  className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                    validationErrors.choices
                      ? isDark
                        ? "bg-[#eb5757]/5 border-[#eb5757] focus:border-[#eb5757] text-white ring-1 ring-[#eb5757]/30"
                        : "bg-rose-50/60 border-rose-500 focus:border-rose-600 text-gray-900 ring-1 ring-rose-500/20"
                      : isDark
                      ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] text-[#d0d6e0]"
                      : "bg-white border-gray-200 hover:border-gray-300 focus:border-gray-900 text-gray-900 shadow-sm"
                  }`}
                >
                  <option value="">Select 1st Choice...</option>
                  {OFFICIAL_FUNCTIONAL_TEAMS.map((fn) => (
                    <option
                      key={fn}
                      value={fn}
                      disabled={fn === value.secondChoiceFunction}
                    >
                      {fn} {fn === value.secondChoiceFunction ? "(Selected as 2nd)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2nd Choice */}
              <div>
                <label
                  className={`block text-[12px] font-berkeley-mono uppercase tracking-wider mb-1 ${
                    validationErrors.choices
                      ? "text-[#eb5757]"
                      : isDark ? "text-[#8a8f98]" : "text-gray-600"
                  }`}
                >
                  2nd Choice Function <span className="text-[#eb5757]">*</span>
                </label>
                <select
                  value={value.secondChoiceFunction}
                  onChange={(e) => update({ secondChoiceFunction: e.target.value })}
                  className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                    validationErrors.choices
                      ? isDark
                        ? "bg-[#eb5757]/5 border-[#eb5757] focus:border-[#eb5757] text-white ring-1 ring-[#eb5757]/30"
                        : "bg-rose-50/60 border-rose-500 focus:border-rose-600 text-gray-900 ring-1 ring-rose-500/20"
                      : isDark
                      ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] text-[#d0d6e0]"
                      : "bg-white border-gray-200 hover:border-gray-300 focus:border-gray-900 text-gray-900 shadow-sm"
                  }`}
                >
                  <option value="">Select 2nd Choice...</option>
                  {OFFICIAL_FUNCTIONAL_TEAMS.map((fn) => (
                    <option
                      key={fn}
                      value={fn}
                      disabled={fn === value.firstChoiceFunction}
                    >
                      {fn} {fn === value.firstChoiceFunction ? "(Selected as 1st)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {validationErrors.choices && (
              <p className="text-[12px] font-medium text-[#eb5757] flex items-center gap-1.5 mt-1 animate-in fade-in-50 duration-150">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{validationErrors.choices}</span>
              </p>
            )}
          </div>

          {/* ── Sub-section 2.d: Weekly Commitment ── */}
          <div id="field-weeklyCommitment" className="space-y-2">
            <div className="flex items-center justify-between mb-1.5">
              <label
                className={`block text-[13px] font-[510] ${
                  validationErrors.weeklyCommitment
                    ? "text-[#eb5757]"
                    : isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                }`}
              >
                Weekly Commitment <span className="text-[#eb5757]">*</span>
              </label>
              <span className={`text-[11px] font-berkeley-mono ${
                validationErrors.weeklyCommitment
                  ? "text-[#eb5757] font-semibold"
                  : isDark ? "text-[#8a8f98]" : "text-gray-500"
              }`}>
                Hours per week available for ADSS operations & projects
              </span>
            </div>
            <div className="relative">
              <Clock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                validationErrors.weeklyCommitment ? "text-[#eb5757]" : isDark ? "text-[#62666d]" : "text-gray-400"
              }`} />
              <select
                value={value.weeklyCommitment}
                onChange={(e) => update({ weeklyCommitment: e.target.value })}
                className={`w-full pl-9 pr-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                  validationErrors.weeklyCommitment
                    ? isDark
                      ? "bg-[#eb5757]/5 border-[#eb5757] focus:border-[#eb5757] text-white ring-1 ring-[#eb5757]/30"
                      : "bg-rose-50/60 border-rose-500 focus:border-rose-600 text-gray-900 ring-1 ring-rose-500/20"
                    : isDark
                    ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] text-[#d0d6e0]"
                    : "bg-white border-gray-200 hover:border-gray-300 focus:border-gray-900 text-gray-900 shadow-sm"
                }`}
              >
                {commitmentOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            {validationErrors.weeklyCommitment && (
              <p className="text-[12px] font-medium text-[#eb5757] flex items-center gap-1.5 mt-1 animate-in fade-in-50 duration-150">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{validationErrors.weeklyCommitment}</span>
              </p>
            )}
          </div>
        </>
      )}

      {/* ── PART 2: Function-Specific Skills & Evaluation + Contribution Note ── */}
      {showSkills && (
        <>
          {/* Section 3: Function-Specific Skills & Evaluation */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between pb-1 border-b border-[#23252a]/60">
              <div>
                <span
                  className={`text-[11px] font-berkeley-mono uppercase tracking-wider block ${
                    isDark ? "text-[#8a8f98]" : "text-gray-500 font-semibold"
                  }`}
                >
                  Function-Specific Skills & Evaluation
                </span>
                <span className={`text-[11.5px] ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
                  Select your skills and provide details for relevant functional domains
                </span>
              </div>
              <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                6 Domains
              </span>
            </div>

            {/* Quick Guidance & Expand All / Collapse All */}
            <div
              className={`p-2.5 rounded-[6px] border text-[12px] flex items-center justify-between gap-3 ${
                isDark
                  ? "bg-[#161718]/80 border-[#23252a] text-[#8a8f98]"
                  : "bg-indigo-50/50 border-indigo-100 text-indigo-900"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-[#e4f222] flex-shrink-0" />
                <span className="truncate">
                  Click any domain below to expand and select your competencies or scenarios.
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleAll}
                className={`text-[11px] font-berkeley-mono px-2 py-0.5 rounded-[4px] border cursor-pointer flex-shrink-0 transition-colors ${
                  isDark
                    ? "bg-[#0f1011] border-[#27292e] text-[#d0d6e0] hover:text-white hover:border-[#383b3f]"
                    : "bg-white border-gray-200 text-gray-700 hover:text-gray-900 shadow-sm"
                }`}
              >
                {allExpanded ? "Collapse All" : "Expand All"}
              </button>
            </div>

            <div className="space-y-2.5">
              {FUNCTION_SKILLS_CONFIG.map((group) => {
                const isExpanded = Boolean(expandedSections[group.id]);
                const Icon = group.icon;
                const groupData = value.functionSkills?.[group.id] || {
                  skills: [],
                  scenario: "",
                  portfolio: "",
                };
                const checkedSkillsCount = groupData.skills?.length || 0;
                const isFirstChoice = value.firstChoiceFunction === group.functionName;
                const isSecondChoice = value.secondChoiceFunction === group.functionName;

                return (
                  <div
                    key={group.id}
                    style={{
                      borderLeftColor: isExpanded ? group.color : undefined,
                      borderLeftWidth: isExpanded ? "3px" : undefined,
                    }}
                    className={`rounded-[8px] border transition-all overflow-hidden ${
                      isExpanded
                        ? isDark
                          ? "bg-[#121315] border-[#383b3f] shadow-md"
                          : "bg-white border-gray-300 shadow-sm"
                        : isDark
                        ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]"
                        : "bg-gray-50/70 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {/* Header / Accordion trigger */}
                    <button
                      type="button"
                      onClick={() => toggleSection(group.id)}
                      className="w-full p-3 flex items-center justify-between text-left cursor-pointer transition-colors group"
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-7 h-7 rounded-[6px] flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                          style={{
                            backgroundColor: `${group.color}15`,
                            color: group.color,
                            border: `1px solid ${group.color}30`,
                          }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[13px] font-[510] group-hover:underline ${isDark ? "text-white" : "text-gray-900"}`}>
                              {group.functionName}
                            </span>
                            {isFirstChoice && (
                              <span className="text-[10px] font-berkeley-mono font-[510] px-1.5 py-0.5 rounded-[3px] bg-[#e4f222]/15 text-[#e4f222] border border-[#e4f222]/30">
                                1st Choice
                              </span>
                            )}
                            {isSecondChoice && (
                              <span className="text-[10px] font-berkeley-mono font-[510] px-1.5 py-0.5 rounded-[3px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                                2nd Choice
                              </span>
                            )}
                          </div>
                          <span className={`text-[11px] block truncate ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                            {group.badge}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {checkedSkillsCount > 0 && (
                          <span className="text-[11px] font-berkeley-mono px-2 py-0.5 rounded-[4px] bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>{checkedSkillsCount} {checkedSkillsCount === 1 ? "skill" : "skills"}</span>
                          </span>
                        )}

                        {/* Prominent "Click to open" / "Click to close" Micro-button */}
                        <div
                          className={`px-2.5 py-1 rounded-[5px] text-[11.5px] font-[510] border flex items-center gap-1.5 transition-all shadow-sm ${
                            isExpanded
                              ? isDark
                                ? "bg-[#1f2024] border-[#e4f222]/40 text-[#e4f222]"
                                : "bg-indigo-50 border-indigo-200 text-indigo-700"
                              : isDark
                              ? "bg-[#161718] border-[#27292e] text-[#d0d6e0] group-hover:border-[#383b3f] group-hover:text-white group-hover:bg-[#1d1f23]"
                              : "bg-white border-gray-200 text-gray-700 group-hover:border-gray-300 group-hover:bg-gray-50"
                          }`}
                        >
                          <span className="font-medium tracking-tight">
                            {isExpanded ? "Click to close" : "Click to open"}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 transition-transform" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Collapsible Content */}
                    {isExpanded && (
                      <div className={`p-3.5 pt-1 border-t space-y-3.5 ${isDark ? "border-[#23252a]" : "border-gray-100"}`}>
                        {/* Checkboxes */}
                        <div>
                          <span
                            className={`text-[11px] font-berkeley-mono uppercase tracking-wider block mb-2 ${
                              isDark ? "text-[#8a8f98]" : "text-gray-600"
                            }`}
                          >
                            Select your relevant competencies:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {group.skills.map((skill) => {
                              const isSkillChecked = groupData.skills?.includes(skill);
                              return (
                                <label
                                  key={skill}
                                  className={`p-3 rounded-[8px] border text-[12.5px] flex items-start gap-3 cursor-pointer transition-all select-none group/skill ${
                                    isSkillChecked
                                      ? isDark
                                        ? "bg-[#181a1e] border-[#e4f222]/50 text-white shadow-sm shadow-[#e4f222]/5"
                                        : "bg-indigo-50/80 border-indigo-300 text-indigo-950 font-medium shadow-sm"
                                      : isDark
                                      ? "bg-[#0c0d0f] border-[#2d3038] text-[#8a8f98] hover:border-[#424652] hover:text-[#d0d6e0] hover:bg-[#111215]"
                                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSkillChecked}
                                    onChange={() => handleToggleSkill(group.id, skill)}
                                    className="sr-only"
                                  />
                                  {/* Standout 20x20px Checkbox with visible 2px border */}
                                  <div
                                    className={`w-5 h-5 min-w-[20px] min-h-[20px] rounded-[5px] border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-all ${
                                      isSkillChecked
                                        ? isDark
                                          ? "bg-[#e4f222] border-[#e4f222] text-[#08090a] scale-105 shadow-sm shadow-[#e4f222]/20"
                                          : "bg-indigo-600 border-indigo-600 text-white scale-105 shadow-sm"
                                        : isDark
                                        ? "border-[#4e5360] bg-[#121316] group-hover/skill:border-[#e4f222] group-hover/skill:bg-[#16171b]"
                                        : "border-gray-400 bg-white group-hover/skill:border-gray-900 group-hover/skill:bg-gray-50"
                                    }`}
                                  >
                                    {isSkillChecked ? (
                                      <Check className="w-3.5 h-3.5 stroke-[3.5] animate-in zoom-in-75 duration-150" />
                                    ) : (
                                      <div className="w-1.5 h-1.5 rounded-full opacity-0 group-hover/skill:opacity-30 bg-[#e4f222] transition-opacity" />
                                    )}
                                  </div>
                                  <span className="leading-snug pt-0.5">{skill}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Scenario / Portfolio field */}
                        <div>
                          <label
                            className={`block text-[12px] font-[510] mb-1.5 ${
                              isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                            }`}
                          >
                            {group.fieldType === "input" ? "Portfolio / Link:" : "Domain Scenario:"}
                          </label>
                          <p className={`text-[11.5px] mb-2 leading-relaxed ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                            {group.scenarioPrompt}
                          </p>

                          {group.fieldType === "input" ? (
                            <input
                              type="text"
                              placeholder="https://behance.net/..., https://github.com/..."
                              value={groupData.portfolio || ""}
                              onChange={(e) =>
                                handleFunctionScenarioChange(group.id, "portfolio", e.target.value)
                              }
                              className={`w-full px-3 py-2 rounded-[6px] border text-[13px] font-berkeley-mono transition-colors focus:outline-none ${
                                isDark
                                  ? "bg-[#0b0c0d] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] text-[#d0d6e0] placeholder:text-[#62666d]"
                                  : "bg-white border-gray-200 hover:border-gray-300 focus:border-gray-900 text-gray-900 placeholder:text-gray-400 shadow-sm"
                              }`}
                            />
                          ) : (
                            <textarea
                              rows={3}
                              placeholder="Provide details about past projects, techniques, tools, or ideas..."
                              value={groupData.scenario || ""}
                              onChange={(e) =>
                                handleFunctionScenarioChange(group.id, "scenario", e.target.value)
                              }
                              className={`w-full px-3 py-2 rounded-[6px] border text-[13px] transition-colors focus:outline-none resize-y ${
                                isDark
                                  ? "bg-[#0b0c0d] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] text-[#d0d6e0] placeholder:text-[#62666d]"
                                  : "bg-white border-gray-200 hover:border-gray-300 focus:border-gray-900 text-gray-900 placeholder:text-gray-400 shadow-sm"
                              }`}
                            />
                          )}
                        </div>

                        {/* Close domain action button at bottom */}
                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => toggleSection(group.id)}
                            className={`text-[11.5px] px-2.5 py-1 rounded-[5px] border cursor-pointer inline-flex items-center gap-1 transition-colors ${
                              isDark
                                ? "bg-[#161718] border-[#27292e] text-[#8a8f98] hover:text-white hover:border-[#383b3f]"
                                : "bg-white border-gray-200 text-gray-600 hover:text-gray-900 shadow-sm"
                            }`}
                          >
                            <span>Done with {group.functionName}</span>
                            <ChevronUp className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Additional Fields: Portfolio Link & Contribution Note ── */}
          <div className="space-y-4 pt-1">
            <div className="pb-1 border-b border-[#23252a]/60">
              <span
                className={`text-[11px] font-berkeley-mono uppercase tracking-wider block ${
                  isDark ? "text-[#8a8f98]" : "text-gray-500 font-semibold"
                }`}
              >
                Portfolio & Practical Contribution
              </span>
            </div>

            {/* Portfolio / Work Link */}
            <div>
              <label
                className={`block text-[13px] font-[510] mb-1.5 ${
                  isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                }`}
              >
                Portfolio / Work Link <span className={`text-[11.5px] font-[400] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>(GitHub, Google Drive, Behance, LinkedIn)</span>
              </label>
              <div className="relative">
                <Link2 className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
                <input
                  type="text"
                  placeholder="https://github.com/username or drive.google.com/..."
                  value={value.portfolioLink || ""}
                  onChange={(e) => update({ portfolioLink: e.target.value })}
                  className={`w-full pl-9 pr-3 py-2 rounded-[6px] border text-[13px] font-berkeley-mono transition-colors focus:outline-none ${
                    isDark
                      ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] text-[#d0d6e0] placeholder:text-[#62666d]"
                      : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                  }`}
                />
              </div>
            </div>

            {/* Practical Contribution Note */}
            <div id="field-contributionNote" className="scroll-mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="field-contributionNote-input"
                  className={`block text-[13px] font-[510] ${
                    validationErrors.contributionNote
                      ? "text-[#eb5757]"
                      : isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                  }`}
                >
                  Practical Contribution Note <span className="text-[#eb5757]">*</span>
                </label>
                <span className={`text-[11px] font-berkeley-mono ${
                  validationErrors.contributionNote
                    ? "text-[#eb5757] font-semibold"
                    : isDark ? "text-[#8a8f98]" : "text-gray-500"
                }`}>
                  Required
                </span>
              </div>
              <textarea
                id="field-contributionNote-input"
                rows={3}
                required
                placeholder="Briefly describe past experience, projects, or specific skills you can contribute to ADSS projects..."
                value={value.contributionNote || ""}
                onChange={(e) => update({ contributionNote: e.target.value })}
                className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-all focus:outline-none resize-y ${
                  validationErrors.contributionNote
                    ? isDark
                      ? "bg-[#eb5757]/5 border-[#eb5757] focus:border-[#eb5757] text-[#ffffff] ring-1 ring-[#eb5757]/40 placeholder:text-[#eb5757]/40"
                      : "bg-rose-50/60 border-rose-500 focus:border-rose-600 text-gray-900 ring-1 ring-rose-500/20"
                    : isDark
                    ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] text-[#d0d6e0] placeholder:text-[#62666d]"
                    : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                }`}
              />
              {validationErrors.contributionNote && (
                <p className="text-[12px] font-medium text-[#eb5757] flex items-center gap-1.5 mt-1.5 animate-in fade-in-50 duration-150">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{validationErrors.contributionNote}</span>
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Clean read-only viewer for executive/editor review of placement questionnaire responses
 */
export function SkillsAssessmentReview({ assessment, isDark = true }) {
  if (!assessment) {
    return (
      <div className={`p-4 rounded-[8px] border text-center text-[13px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
        No appeal or skills assessment details were submitted with this registration.
      </div>
    );
  }

  if (assessment.type === "function_appeal") {
    return (
      <div className="space-y-4 text-left">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className={`p-3 rounded-[6px] border ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"}`}>
            <span className={`block text-[10px] font-berkeley-mono uppercase tracking-wider mb-1 ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
              Registered / Assigned Function
            </span>
            <span className={`text-[13.5px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>
              {assessment.assignedFunction || assessment.secondChoiceFunction || "Unassigned"}
            </span>
          </div>

          <div className={`p-3 rounded-[6px] border ${isDark ? "bg-[#161718] border-[#e4f222]/40" : "bg-amber-50 border-amber-200"}`}>
            <span className={`block text-[10px] font-berkeley-mono uppercase tracking-wider mb-1 ${isDark ? "text-[#e4f222]" : "text-amber-700"}`}>
              Appealed Target Function
            </span>
            <span className={`text-[13.5px] font-[590] ${isDark ? "text-[#e4f222]" : "text-amber-900"}`}>
              {assessment.appealFunction || assessment.firstChoiceFunction || "Not specified"}
            </span>
          </div>
        </div>

        <div className={`p-3.5 rounded-[6px] border ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-amber-50/50 border-amber-200/60"}`}>
          <span className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1.5 ${isDark ? "text-[#8a8f98]" : "text-amber-800"}`}>
            Skills & Appeal Explanation
          </span>
          <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${isDark ? "text-[#d0d6e0]" : "text-gray-800"}`}>
            {assessment.appealReason || assessment.contributionNote || "No explanation provided."}
          </p>
        </div>
      </div>
    );
  }

  if (assessment.type === "executive_board") {
    return (
      <div className="space-y-4 text-left">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className={`p-3 rounded-[6px] border ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"}`}>
            <span className={`block text-[10px] font-berkeley-mono uppercase tracking-wider mb-1 ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
              Executive Board Function
            </span>
            <span className={`text-[13.5px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>
              {assessment.executiveFunction || "Not specified"}
            </span>
          </div>

          <div className={`p-3 rounded-[6px] border ${isDark ? "bg-[#161718] border-[#e4f222]/40" : "bg-indigo-50 border-indigo-200"}`}>
            <span className={`block text-[10px] font-berkeley-mono uppercase tracking-wider mb-1 ${isDark ? "text-[#e4f222]" : "text-indigo-700"}`}>
              {assessment.executiveTier === "vice_president" ||
              assessment.executiveManager?.startsWith("Vice President")
                ? "Executive Board Role (Vice President)"
                : "Executive Board Manager Role"}
            </span>
            <span className={`text-[13.5px] font-[590] ${isDark ? "text-[#e4f222]" : "text-indigo-900"}`}>
              {assessment.executiveManager || "Not specified"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const {
    academicStanding,
    focusAreas = [],
    firstChoiceFunction,
    secondChoiceFunction,
    weeklyCommitment,
    functionSkills = {},
    portfolioLink,
    contributionNote,
  } = assessment;

  return (
    <div className="space-y-4 text-left">
      {/* Top summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className={`p-2.5 rounded-[6px] border ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"}`}>
          <span className={`block text-[10px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
            BSc FMIS Level
          </span>
          <span className={`text-[13px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>
            {academicStanding || "Level I"}
          </span>
        </div>

        <div className={`p-2.5 rounded-[6px] border ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"}`}>
          <span className={`block text-[10px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
            1st Choice Function
          </span>
          <span className="text-[13px] font-[510] text-[#e4f222]">
            {firstChoiceFunction || "None"}
          </span>
        </div>

        <div className={`p-2.5 rounded-[6px] border ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"}`}>
          <span className={`block text-[10px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
            2nd Choice Function
          </span>
          <span className={`text-[13px] font-[510] ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>
            {secondChoiceFunction || "None"}
          </span>
        </div>

        <div className={`p-2.5 rounded-[6px] border ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"}`}>
          <span className={`block text-[10px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
            Weekly Hours
          </span>
          <span className={`text-[13px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>
            {weeklyCommitment || "N/A"}
          </span>
        </div>
      </div>

      {/* Focus Areas */}
      {focusAreas.length > 0 && (
        <div className={`p-3 rounded-[6px] border ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"}`}>
          <span className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-2 ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
            Preferred Focus Areas
          </span>
          <div className="flex flex-wrap gap-1.5">
            {focusAreas.map((area) => (
              <span
                key={area}
                className="text-[11.5px] px-2.5 py-1 rounded-[4px] bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Practical Contribution Note */}
      {contributionNote && (
        <div className={`p-3.5 rounded-[6px] border ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-amber-50/50 border-amber-200/60"}`}>
          <span className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1.5 ${isDark ? "text-[#8a8f98]" : "text-amber-800"}`}>
            Practical Contribution Note
          </span>
          <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${isDark ? "text-[#d0d6e0]" : "text-gray-800"}`}>
            {contributionNote}
          </p>
        </div>
      )}

      {/* Portfolio Link */}
      {portfolioLink && (
        <div className={`p-2.5 rounded-[6px] border flex items-center justify-between gap-2 ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"}`}>
          <span className={`text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
            Work / Portfolio Link:
          </span>
          <a
            href={portfolioLink.startsWith("http") ? portfolioLink : `https://${portfolioLink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-blue-400 hover:underline flex items-center gap-1 font-berkeley-mono truncate max-w-[280px]"
          >
            <span>{portfolioLink}</span>
          </a>
        </div>
      )}

      {/* Function-Specific Responses */}
      <div className="space-y-2">
        <span className={`block text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
          Domain Skills & Scenario Responses
        </span>

        <div className="grid grid-cols-1 gap-2.5">
          {FUNCTION_SKILLS_CONFIG.map((group) => {
            const data = functionSkills[group.id] || {};
            const skills = data.skills || [];
            const scenario = data.scenario || data.portfolio || "";

            if (skills.length === 0 && !scenario) return null;

            return (
              <div
                key={group.id}
                className={`p-3 rounded-[6px] border ${isDark ? "bg-[#121315] border-[#23252a]" : "bg-white border-gray-200"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-[510] text-white">
                      {group.functionName}
                    </span>
                    <span className={`text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                      ({group.badge})
                    </span>
                  </div>
                  {skills.length > 0 && (
                    <span className="text-[10px] font-berkeley-mono px-1.5 py-0.5 rounded-[3px] bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                      {skills.length} skills
                    </span>
                  )}
                </div>

                {skills.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {skills.map((s) => (
                      <li key={s} className="text-[12px] flex items-center gap-1.5 text-[#d0d6e0]">
                        <Check className="w-3 h-3 text-[#10b981] flex-shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {scenario && (
                  <div className={`mt-2 p-2 rounded-[4px] border text-[12px] leading-relaxed ${isDark ? "bg-[#0b0c0d] border-[#1e2024] text-[#8a8f98]" : "bg-gray-50 border-gray-200 text-gray-700"}`}>
                    <strong className="block text-[10px] font-berkeley-mono uppercase tracking-wider text-[#62666d] mb-0.5">
                      Response:
                    </strong>
                    <span className="whitespace-pre-wrap">{scenario}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
