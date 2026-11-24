export interface CareerContextGuide {
  context: string;
  contentMatchInterpretation: string;
  visualAdaptation: string;
  doNotRequireOrPenalize: string;
}

export const CAREER_ADAPTATIONS: Record<string, CareerContextGuide> = {
  fresher: {
    context: "Fresher / student / apprentice",
    contentMatchInterpretation: "C02: coursework, projects, apprenticeship, volunteer/community or family-business work with own contribution. C03: real output, useful learning application or service contribution. C04: foundational applied capability.",
    visualAdaptation: "Education/projects may lead. Same human readability criteria.",
    doNotRequireOrPenalize: "No paid-employment, internship, GPA, summary or corporate KPI requirement.",
  },
  established: {
    context: "Early / established professional",
    contentMatchInterpretation: "C02/C03: relevant responsibilities, ownership, methods and supported outputs; C08: interpretable sequence and consistent facts.",
    visualAdaptation: "Prioritize relevant evidence; no arbitrary number of bullets/pages.",
    doNotRequireOrPenalize: "No compulsory promotion or percentage of quantified bullets.",
  },
  specialist: {
    context: "Senior individual contributor / specialist",
    contentMatchInterpretation: "C02: depth, judgment, complex decisions, technical/trade/clinical expertise; C03: supportable contribution. Leadership only where target requires it.",
    visualAdaptation: "Make high-value specialist evidence easy to find.",
    doNotRequireOrPenalize: "No direct-report, budget or executive-title requirement.",
  },
  executive: {
    context: "Manager / director / executive",
    contentMatchInterpretation: "C02: strategy-to-execution, stakeholder leadership, appropriate people/resource/risk stewardship. C03: attributable outcomes appropriate to sector.",
    visualAdaptation: "Concise overview plus adequate relevant evidence; scope visible.",
    doNotRequireOrPenalize: "Do not invent P&L, team size, fundraising, board exposure or money metrics.",
  },
  portfolio_30_years: {
    context: "30+ years / fractional / portfolio career",
    contentMatchInterpretation: "C02/C03: selected current and earlier relevant contributions; C08/C09: sustained expertise and coherent, prioritized history.",
    visualAdaptation: "More pages can be justified. Group less relevant earlier roles; retain required complete history and relevant early achievements.",
    doNotRequireOrPenalize: "No age inference, forced graduation year, technology-fashion penalty or hard page cap.",
  },
  academic: {
    context: "Academic / research CV",
    contentMatchInterpretation: "C02/C03/C05: methods, research/teaching contribution, publications, grants and status using discipline conventions.",
    visualAdaptation: "Potentially long CV with clear sections, citations and page flow.",
    doNotRequireOrPenalize: "No corporate page cap, citation-count prestige or automatic short-summary requirement.",
  },
  career_change: {
    context: "Career change",
    contentMatchInterpretation: "C01/C02/C04: truthful bridge from transferable actions/skills to target; actual recent practice where available.",
    visualAdaptation: "Lead with relevant transferable evidence.",
    doNotRequireOrPenalize: "Do not rename past roles or invent new-domain experience.",
  },
  career_break: {
    context: "Returner / career break",
    contentMatchInterpretation: "C08: understandable dates; C02/C04: relevant readiness, whether recent or transferable.",
    visualAdaptation: "Optional neutral break label, user-controlled.",
    doNotRequireOrPenalize: "No break penalty or disclosure of health/family/caring reasons.",
  },
  freelance: {
    context: "Freelance / gig / founder",
    contentMatchInterpretation: "C02/C03: services, client context, own deliverables and contributions; anonymize restricted clients.",
    visualAdaptation: "Group related engagements without obscuring evidence.",
    doNotRequireOrPenalize: "No funding, revenue, famous-client or full-time-employment default.",
  },
  trade: {
    context: "Trade / hourly / frontline / informal work",
    contentMatchInterpretation: "C02/C04: practical tasks, craft, service/safety/quality evidence and legitimate training.",
    visualAdaptation: "Plain, readable role-appropriate presentation.",
    doNotRequireOrPenalize: "No university-degree or office-jargon preference.",
  },
  regulated: {
    context: "Regulated profession",
    contentMatchInterpretation: "C05: accurate supplied credential/status. J04: explicit required credential/equivalent and mandatory gap flag.",
    visualAdaptation: "Give genuinely required qualification information adequate visibility.",
    doNotRequireOrPenalize: "Actual missing eligibility cannot be repaired through wording; no unsupported verification.",
  },
  creative: {
    context: "Creative / design portfolio",
    contentMatchInterpretation: "C02/C03: sample contribution and context. V criteria assess actual usability; portfolio alone is not proof of personal contribution.",
    visualAdaptation: "Creative layouts accepted when readable.",
    doNotRequireOrPenalize: "Do not fail columns/colour by mere presence; parsing concerns are separate technical findings.",
  },
  international: {
    context: "International / military / public-sector transition",
    contentMatchInterpretation: "C01/C02/C05: understandable function/rank/qualification explanation and transferable work; protect restricted details.",
    visualAdaptation: "Target-market conventions, verified employer instructions and supported language govern.",
    doNotRequireOrPenalize: "No nationality inference, prestige ranking or assumed foreign-credential equivalence.",
  },
  multilingual: {
    context: "Multilingual / non-English",
    contentMatchInterpretation: "C07: declared supported language and locale; retain original terms with accurate explanations where useful.",
    visualAdaptation: "Check supported script/rendering and intended audience readability.",
    doNotRequireOrPenalize: "Unsupported analysis is Pending; English is not a universal requirement.",
  },
  federal: {
    context: "Federal / prescribed application",
    contentMatchInterpretation: "All relevant content fields and history required by actual supplied application instructions.",
    visualAdaptation: "Required detail/format overrides generic brevity advice.",
    doNotRequireOrPenalize: "Do not remove required history or personal/application fields merely to shorten the resume.",
  },
};

export function getCareerContextGuide(contextKey?: string): CareerContextGuide | undefined {
  if (!contextKey) return undefined;
  return CAREER_ADAPTATIONS[contextKey.toLowerCase()];
}
