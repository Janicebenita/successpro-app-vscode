import type { ParameterDefinition, ParameterId, PillarId } from "./types";

export const PARAMETER_REGISTRY: Record<ParameterId, ParameterDefinition> = {
  C01: {
    id: "C01",
    pillar: "content",
    name: "Role positioning and value proposition",
    baseWeightWithJD: 6,
    baseWeightNoJD: 7.8,
    whyThisWeight: "Early role clarity helps readers understand why the evidence matters, but cannot outweigh actual capability.",
    applicability: "Always; no summary does not mean failure. Assess positioning from other opening content.",
    scopeOfAssessment: "Opening evidence makes the intended function, relevant strengths and value clear. A standalone summary is optional.",
  },
  C02: {
    id: "C02",
    pillar: "content",
    name: "Experience and practical capability evidence",
    baseWeightWithJD: 10,
    baseWeightNoJD: 13.0,
    whyThisWeight: "This is the strongest direct evidence that the applicant can perform useful work; it carries the largest content weight.",
    applicability: "Always for a capability-based resume; paid employment is never required. Formal application requirements may define the expected evidence.",
    scopeOfAssessment: "Relevant work/projects/service explain role, tasks, own contribution, methods and appropriate scope. Leadership, strategy, risk and resource decisions are expected only for targets needing them.",
  },
  C03: {
    id: "C03",
    pillar: "content",
    name: "Achievements and contribution",
    baseWeightWithJD: 8,
    baseWeightNoJD: 10.4,
    whyThisWeight: "Outcomes distinguish contribution from activity and make the value of experience understandable.",
    applicability: "Always; metrics are optional. An entry-level deliverable or demonstrated learning outcome can qualify.",
    scopeOfAssessment: "Important examples show credible outcomes, deliverables or contribution; qualitative evidence is valid. Numbers need context and truthful attribution.",
  },
  C04: {
    id: "C04",
    pillar: "content",
    name: "Skills and competency evidence",
    baseWeightWithJD: 7,
    baseWeightNoJD: 9.1,
    whyThisWeight: "Role-relevant skills help reviewers locate capability; contextual evidence is more informative than a long list.",
    applicability: "Always; evaluate capabilities appropriate to the selected target, not an arbitrary tool list or skill count.",
    scopeOfAssessment: "Relevant technical, trade, functional, domain and interpersonal capabilities are specific and supported in work, projects, training or other evidence.",
  },
  C05: {
    id: "C05",
    pillar: "content",
    name: "Education, credentials and relevant learning",
    baseWeightWithJD: 4,
    baseWeightNoJD: 5.2,
    whyThisWeight: "Credentials matter strongly in some fields and less in others, so their general content weight is moderate.",
    applicability: "Apply when education/training is supplied or genuinely required for the chosen target. If neither, N/A; no universal degree, GPA or graduation-year requirement. With a JD, J04 owns an absent mandatory credential; C05 assesses any supplied preparation independently. If none is supplied and there is nothing independent to assess, C05 is N/A with that owner recorded.",
    scopeOfAssessment: "Applicable qualifications/training are clearly and accurately labelled. For regulated targets, licence type/jurisdiction/status must be interpretable. Academic evidence uses discipline conventions.",
  },
  C06: {
    id: "C06",
    pillar: "content",
    name: "Essential information and completeness",
    baseWeightWithJD: 5,
    baseWeightNoJD: 6.5,
    whyThisWeight: "An excellent narrative has limited practical value if the reader cannot contact the person or identify the evidence.",
    applicability: "Always; optional links, photographs, home address, LinkedIn and private personal details are not universal essentials.",
    scopeOfAssessment: "Readable name, at least one usable-looking contact channel and enough entry identifiers to interpret relevant evidence. Include actual required application fields without unnecessary personal data.",
  },
  C07: {
    id: "C07",
    pillar: "content",
    name: "Clarity, language and concise expression",
    baseWeightWithJD: 4,
    baseWeightNoJD: 5.2,
    whyThisWeight: "Clarity makes evidence easier to assess; cosmetic wording must not outweigh substance.",
    applicability: "Always in the selected supported language; no English-default or accent/dialect/personality score.",
    scopeOfAssessment: "Clear meaning, accurate grammar/spelling in the selected supported language, specific actions, appropriate terminology and useful information density.",
  },
  C08: {
    id: "C08",
    pillar: "content",
    name: "Chronology, consistency and credibility of presentation",
    baseWeightWithJD: 3,
    baseWeightNoJD: 3.9,
    whyThisWeight: "Contradictions can create avoidable doubt, but non-linear careers and breaks do not imply weak performance.",
    applicability: "Apply where dated/multiple entries or repeated factual claims require interpretation; if genuinely no chronology/repetition to assess, N/A. No gap, age or promotion penalty.",
    scopeOfAssessment: "Relevant sequence and dates are interpretable; roles, figures and claims internally consistent. Distinct contributions understandable without requiring promotions.",
  },
  C09: {
    id: "C09",
    pillar: "content",
    name: "Content relevance and prioritization",
    baseWeightWithJD: 3,
    baseWeightNoJD: 3.9,
    whyThisWeight: "Selection helps reviewers find the strongest case without rewarding a fixed length or fashionable format.",
    applicability: "Always; academic/prescribed CVs may need extensive detail. Length alone is assessed in V05, not penalized again here.",
    scopeOfAssessment: "Relevant evidence is selected and emphasized; less useful detail/redundancy does not displace it. Judge what is included, distinct from visual page flow.",
  },
  V01: {
    id: "V01",
    pillar: "visual",
    name: "Layout, hierarchy and ease of scanning",
    baseWeightWithJD: 6,
    baseWeightNoJD: 8.4,
    whyThisWeight: "Navigation determines how quickly actual evidence becomes visible during human review.",
    applicability: "Rendered original required. Recognizable alternative section labels and creative layouts are acceptable when usable.",
    scopeOfAssessment: "Human reviewer can find sections, identify entries and distinguish headings from evidence. Order serves the target and career context.",
  },
  V02: {
    id: "V02",
    pillar: "visual",
    name: "Typography and text legibility",
    baseWeightWithJD: 5,
    baseWeightNoJD: 7.0,
    whyThisWeight: "Evidence cannot help if it is hard to read; legibility receives the second-largest visual weight.",
    applicability: "Rendered original required. Assess actual legibility rather than font name or point-size alone.",
    scopeOfAssessment: "Body text, headings and dates are readable at normal viewing size and in the exported document; no font-prestige preference.",
  },
  V03: {
    id: "V03",
    pillar: "visual",
    name: "Spacing, alignment and information density",
    baseWeightWithJD: 4,
    baseWeightNoJD: 5.6,
    whyThisWeight: "Good spacing reduces reading effort while retaining useful evidence.",
    applicability: "Rendered original required; avoid arbitrary margin/whitespace quotas.",
    scopeOfAssessment: "Whitespace, alignment, line spacing and grouping avoid collisions and support comfortable reading.",
  },
  V04: {
    id: "V04",
    pillar: "visual",
    name: "Visual consistency and professional coherence",
    baseWeightWithJD: 3,
    baseWeightNoJD: 4.2,
    whyThisWeight: "Polish supports trust and navigation but is less important than readability and evidence.",
    applicability: "Rendered original required. No penalty for a tasteful creative style, photograph or colour by mere presence.",
    scopeOfAssessment: "Heading, bullet, date and emphasis styles are coherent; purposeful variation accepted; decorations do not distract.",
  },
  V05: {
    id: "V05",
    pillar: "visual",
    name: "Page length, flow and space utilization",
    baseWeightWithJD: 4,
    baseWeightNoJD: 5.6,
    whyThisWeight: "Poor page flow can hide content or make it cumbersome; a fixed page count would unfairly penalize some careers.",
    applicability: "Rendered original required. No universal one/two-page limit, including for 30+ years. C09 owns relevance defects; this row owns their distinct page-flow effects.",
    scopeOfAssessment: "Length is proportionate to relevant evidence/instructions; page breaks, headings and text are not stranded, truncated or accidentally blank.",
  },
  V06: {
    id: "V06",
    pillar: "visual",
    name: "Contrast, visual accessibility and meaningful graphics",
    baseWeightWithJD: 3,
    baseWeightNoJD: 4.2,
    whyThisWeight: "Accessibility extends readability across readers, devices and printouts without imposing aesthetic taste.",
    applicability: "Rendered original required. Score communicative accessibility, never appearance, identity or disability.",
    scopeOfAssessment: "Important information is readable in colour/grayscale and not conveyed only by colour, icons, charts or skill bars.",
  },
  J01: {
    id: "J01",
    pillar: "jobMatch",
    name: "Role, responsibility and functional match",
    baseWeightWithJD: 7,
    baseWeightNoJD: 0,
    whyThisWeight: "Doing the actual work is the largest component of role-specific fit.",
    applicability: "Only with supplied meaningful JD/confirmed requirements. De-duplicate repeated duties; no title-only matching.",
    scopeOfAssessment: "Map distinct core JD functions/tasks to demonstrated relevant or transferable contributions; equivalent titles accepted.",
  },
  J02: {
    id: "J02",
    pillar: "jobMatch",
    name: "Required skills and methods match",
    baseWeightWithJD: 6,
    baseWeightNoJD: 0,
    whyThisWeight: "Essential capabilities strongly influence the demonstrated match to the specific role.",
    applicability: "Only if JD states required skills/methods. Preferred facts belong to J05; no duplicate keywords or double weighting.",
    scopeOfAssessment: "Required technical, trade, functional skills and methods mapped to supported explicit or valid equivalent evidence; natural terminology, not density.",
  },
  J03: {
    id: "J03",
    pillar: "jobMatch",
    name: "Experience, scope and seniority match",
    baseWeightWithJD: 5,
    baseWeightNoJD: 0,
    whyThisWeight: "Context and responsibility indicate target-level readiness beyond a literal title match.",
    applicability: "Only if JD specifies experience/scope. Ambiguous dates/FTE → Pending, not a fabricated failure. Management only where actually required.",
    scopeOfAssessment: "Compare explicit scope, autonomy, complexity and relevant duration where specified. Union concurrent intervals; do not infer age, FTE or management from titles.",
  },
  J04: {
    id: "J04",
    pillar: "jobMatch",
    name: "Mandatory qualifications and explicit eligibility",
    baseWeightWithJD: 4,
    baseWeightNoJD: 0,
    whyThisWeight: "A true mandatory condition can matter despite a strong average, but is not required for every job.",
    applicability: "Only explicit relevant JD qualifications/credentials. If none, N/A within JD pillar. Uncertain equivalence/status → Pending and ask; no institution prestige or protected-trait inference.",
    scopeOfAssessment: "Explicit education/licence/certification/jurisdiction requirements matched to stated status and allowed equivalents. Optional user-confirmed logistics kept in a separate checklist.",
  },
  J05: {
    id: "J05",
    pillar: "jobMatch",
    name: "Preferred skills, domain and differentiating fit",
    baseWeightWithJD: 3,
    baseWeightNoJD: 0,
    whyThisWeight: "Additional fit can differentiate applicants but should not outweigh the core role requirements.",
    applicability: "Only stated preferred requirements or distinct domain/context needs. Each atomic requirement has one primary J owner; absent set = N/A.",
    scopeOfAssessment: "Explicit preferred requirements and distinct stated domain/context needs mapped to evidence, separate from required skills/qualifications/scope.",
  },
};

export const ALL_PARAMETER_IDS: ParameterId[] = [
  "C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09",
  "V01", "V02", "V03", "V04", "V05", "V06",
  "J01", "J02", "J03", "J04", "J05",
];

export const CONTENT_PARAMETER_IDS: ParameterId[] = [
  "C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09",
];

export const VISUAL_PARAMETER_IDS: ParameterId[] = [
  "V01", "V02", "V03", "V04", "V05", "V06",
];

export const JOB_MATCH_PARAMETER_IDS: ParameterId[] = [
  "J01", "J02", "J03", "J04", "J05",
];

export function getParameterDefinition(id: ParameterId): ParameterDefinition {
  const def = PARAMETER_REGISTRY[id];
  if (!def) throw new Error(`Unknown parameter ID: ${id}`);
  return def;
}

export function getParametersByPillar(pillar: PillarId): ParameterDefinition[] {
  return ALL_PARAMETER_IDS
    .map((id) => PARAMETER_REGISTRY[id])
    .filter((def) => def.pillar === pillar);
}
