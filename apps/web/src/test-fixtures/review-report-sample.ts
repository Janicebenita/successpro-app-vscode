// Fictional sample review for PDF rendering tests only. Every quote is taken from the sample resume below.
import { analyzeResume, analyzeResumeGapsAndRisks, getRatingAnchor } from "@successpro/domain";
import { buildWorkbookReview, projectWorkbookReview } from "@/lib/successpro-v2-review";

export const sampleResume = [
  "Arjun Menon",
  "arjun.menon@example.com | +91 98400 12345 | Chennai, India",
  "PROFESSIONAL SUMMARY",
  "Data analyst with four years of experience building reporting pipelines and dashboards for healthcare and retail clients.",
  "EXPERIENCE",
  "Senior Data Analyst | Northwind Analytics | Jan 2023 - Present",
  "Built automated SQL and Python reporting pipelines that reduced weekly report preparation from two days to four hours.",
  "Designed Power BI dashboards used by regional operations managers to track claim turnaround times.",
  "Worked with the product team on data quality checks for incoming partner files.",
  "Data Analyst | Bluebird Retail | Jun 2020 - Dec 2022",
  "Maintained sales dashboards and responsible for monthly inventory reports across twelve stores.",
  "Helped migrate legacy Excel reports into a central reporting database.",
  "EDUCATION",
  "B.Tech Information Technology | Anna University | 2020",
  "SKILLS",
  "SQL, Python, Power BI, Excel, data modelling, stakeholder reporting",
].join("\n");

export const sampleJd = [
  "We are hiring a Data Analyst to own reporting for our operations teams.",
  "Build and maintain automated reporting pipelines using SQL and Python.",
  "Create dashboards in Power BI or Tableau for operations leaders.",
  "At least three years of experience in a data analyst role.",
  "Bachelor's degree in computer science, statistics or a related field.",
  "Experience with healthcare claims data is preferred.",
].join("\n");

const ev = (excerpt: string, rationale: string) => ({ excerpt, rationale });
const anchor = (id: string, rating: number, justification: string, gap: string) => ({ anchor: getRatingAnchor(id as never, rating as never), justification, nextAnchorGap: gap, informationState: "present" as const });

const content = [
  { id: "C01", rating: 3, evidence: ev("Data analyst with four years of experience building reporting pipelines and dashboards for healthcare and retail clients.", "The summary names the function and domains but does not state a distinctive value or outcome."), gap: "State the specific value delivered, such as faster reporting or decision support, with one verified result.", issue: "The opening states the role but not the value the candidate brings." },
  { id: "C02", rating: 4, evidence: ev("Built automated SQL and Python reporting pipelines that reduced weekly report preparation from two days to four hours.", "Actions, tools and scope are specific for the most recent role."), gap: "Describe ownership and scope for the earlier role with the same specificity.", issue: "Earlier role describes duties rather than personal contribution." },
  { id: "C03", rating: 3, evidence: ev("reduced weekly report preparation from two days to four hours", "One clear outcome is shown; other bullets describe activities without results."), gap: "Add verified outcomes to the dashboard and migration bullets.", issue: "Most bullets describe activity without a result." },
  { id: "C04", rating: 4, evidence: ev("SQL, Python, Power BI, Excel, data modelling, stakeholder reporting", "Skills are relevant and supported in the experience section."), gap: "Group skills by category and link the strongest ones to evidence.", issue: "Skills list is relevant but ungrouped." },
  { id: "C05", rating: 5, evidence: ev("B.Tech Information Technology | Anna University | 2020", "Degree, institution and year are clear."), gap: "No material shortfall.", issue: "" },
  { id: "C06", rating: 5, evidence: ev("arjun.menon@example.com | +91 98400 12345 | Chennai, India", "Name, email, phone and location are present and readable."), gap: "No material shortfall.", issue: "" },
  { id: "C07", rating: 3, evidence: ev("Maintained sales dashboards and responsible for monthly inventory reports across twelve stores.", "Meaning is clear but several bullets use passive or duty-based phrasing."), gap: "Start each bullet with an action verb and remove filler wording.", issue: "Several bullets use duty-based phrasing such as responsible for." },
  { id: "C08", rating: 5, evidence: ev("Senior Data Analyst | Northwind Analytics | Jan 2023 - Present", "Dates are consistent and in reverse chronological order."), gap: "No material shortfall.", issue: "" },
  { id: "C09", rating: 4, evidence: ev("Designed Power BI dashboards used by regional operations managers to track claim turnaround times.", "Relevant evidence is prioritised; minor detail in the earlier role dilutes focus."), gap: "Trim the earlier role to its most relevant two bullets.", issue: "Earlier role includes lower-value detail." },
];

function workbookAssessments(withJd: boolean) {
  const rows: Array<Record<string, unknown>> = content.map((row) => ({
    id: row.id, status: "Assessed", rating: row.rating, confidence: 0.9, evidence: row.evidence,
    anchorComparison: anchor(row.id, row.rating, row.evidence.rationale, row.gap),
    issues: row.issue ? [{ severity: row.rating >= 4 ? "Minor" : "Major", message: row.issue }] : [],
  }));
  if (!withJd) for (const id of ["J01", "J02", "J03", "J04", "J05"]) rows.push({ id, status: "N/A", rating: null, naOrPendingReason: "No job description provided" });
  else rows.push({ id: "J04", status: "N/A", rating: null, naOrPendingReason: "No explicit requirement assigned to this parameter." });
  return rows;
}

const requirements = [
  { id: "r1", owner: "J01", sourceText: "Build and maintain automated reporting pipelines using SQL and Python.", status: "Assessed", rating: 5, confidence: 0.9, mandatory: false, evidence: ev("Built automated SQL and Python reporting pipelines that reduced weekly report preparation from two days to four hours.", "Directly demonstrated in the current role.") },
  { id: "r2", owner: "J02", sourceText: "Create dashboards in Power BI or Tableau for operations leaders.", status: "Assessed", rating: 4, confidence: 0.9, mandatory: false, evidence: ev("Designed Power BI dashboards used by regional operations managers to track claim turnaround times.", "Power BI dashboards for operations managers are shown.") },
  { id: "r3", owner: "J03", sourceText: "At least three years of experience in a data analyst role.", status: "Assessed", rating: 5, confidence: 0.9, mandatory: true, evidence: ev("Data Analyst | Bluebird Retail | Jun 2020 - Dec 2022", "The dated analyst roles in the resume cover the required experience period.") },
  { id: "r4", owner: "J05", sourceText: "Experience with healthcare claims data is preferred.", status: "Assessed", rating: 3, confidence: 0.9, mandatory: false, evidence: ev("track claim turnaround times", "Claims turnaround reporting is shown, but healthcare claims data depth is unclear.") },
];

function signals(pageCount: number) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  const visual: Array<[string, number, string, string]> = [
    ["V01", 4, "Clear section headings and reverse chronological grouping on both pages.", "Make the role titles slightly more prominent than company names."],
    ["V02", 5, "Body text and headings are comfortably readable at normal size.", "No material shortfall."],
    ["V03", 3, "Spacing between experience entries varies and the skills block is crowded.", "Use consistent spacing between entries and give the skills block more room."],
    ["V04", 4, "Bullet and date styles are consistent; heading weights vary slightly.", "Use one heading style throughout."],
    ["V05", 3, "The second page holds only three lines, leaving most of it blank.", "Fit the content on one page or balance it across two."],
    ["V06", 5, "High-contrast dark text on a white background with no colour-only meaning.", "No material shortfall."],
  ];
  return {
    extractionReliable: true, hasVisualEvidence: true, pageCount,
    geminiPageFindings: pages.map((page) => ({ page, confidence: 0.9, observations: [], warnings: [] })),
    geminiVisualCriteria: visual.map(([code, rating, evidence, gap]) => ({ code, rating, confidence: 0.9, pages, evidence, recommendation: gap, anchorText: getRatingAnchor(code as never, rating as never), anchorJustification: evidence, nextAnchorGap: gap })),
  };
}

export function buildSample({ withJd = true, pageCount = 2, completed = true }: { withJd?: boolean; pageCount?: number; completed?: boolean } = {}) {
  const input = { text: sampleResume, targetKeywords: ["Data Analyst"], jobDescription: withJd ? sampleJd : "", documentSignals: signals(pageCount) };
  const output = {
    analysisVersion: "successpro-v2",
    summary: "The resume presents a credible data analyst with relevant reporting and dashboard experience for healthcare and retail clients. Its strongest evidence is the automated reporting pipeline in the current role, which shows clear tools, scope and a measured result. The main opportunities are to state a distinctive value in the opening, add verified outcomes to the remaining bullets, and replace duty-based phrasing with action-led statements.",
    limitations: ["This review uses only the supplied resume, job description and rendered pages. Confirm every fact before applying a suggestion."],
    topActions: [
      { observed: "The dashboard bullet describes the deliverable without its effect.", inference: "Reviewers cannot tell what the dashboards changed for operations managers.", suggestion: "Add the verified effect of the Power BI dashboards.", originalExcerpt: "Designed Power BI dashboards used by regional operations managers to track claim turnaround times.", improvedExample: "Designed Power BI dashboards used by regional operations managers to track claim turnaround times, [add the verified change, such as faster escalation or reduced backlog]." },
      { observed: "The earlier role uses duty-based phrasing.", inference: "Duty-based phrasing hides personal contribution.", suggestion: "Rewrite the inventory reporting bullet with an action verb.", originalExcerpt: "Maintained sales dashboards and responsible for monthly inventory reports across twelve stores.", improvedExample: "Produced monthly inventory reports across twelve stores and maintained the supporting sales dashboards." },
      { observed: "The summary names the role but not the value.", inference: "The opening does not differentiate the candidate.", suggestion: "State the value delivered in the summary.", originalExcerpt: "Data analyst with four years of experience building reporting pipelines and dashboards for healthcare and retail clients.", improvedExample: "" },
    ],
    meaningfulJd: withJd,
    workbookAssessments: workbookAssessments(withJd),
    jdRequirements: withJd ? requirements : [],
  };
  const base = analyzeResume(input as never);
  const advisory = analyzeResumeGapsAndRisks(sampleResume, input.documentSignals as never, input.jobDescription, new Date("2026-11-24T12:00:00+05:30"));
  const stored = buildWorkbookReview({ ...base, gapRiskAnalysis: advisory } as never, input as never, completed ? output as never : undefined, true);
  return { input, output, stored, paid: projectWorkbookReview(stored, true), free: projectWorkbookReview(stored, false) };
}

