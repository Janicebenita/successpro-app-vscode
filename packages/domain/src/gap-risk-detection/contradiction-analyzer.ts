import type { GapRiskFinding } from "./types";
import { employmentDiagnostics } from "../successpro-v2/employment-validation";

export function analyzeContradictions(
  text: string,
  now = new Date()
): { findings: GapRiskFinding[]; claimedYears?: number } {
  const findings: GapRiskFinding[] = [];
  const diagnostics = employmentDiagnostics(text, now);
  const claimedYears = diagnostics.claimedYears;

  // 1. Claimed Experience vs Actual Timeline Duration
  if (claimedYears !== undefined && diagnostics.durationMonths) {
    const [minMonths, maxMonths] = diagnostics.durationMonths;
    const maxYears = maxMonths / 12;
    const minYears = minMonths / 12;

    // Significant over-claim: e.g. claimed 10 years but timeline totals < 6 years
    if (claimedYears > maxYears + 1.5 && maxYears > 0) {
      findings.push({
        id: "contradiction-claimed-experience-inflated",
        title: `Contradiction: Claimed ${claimedYears}+ Years Experience vs ${Math.round(maxYears * 10) / 10} Years in History`,
        category: "contradiction",
        severity: "Critical",
        evidenceExcerpt: `Summary claim: "${diagnostics.claimedSource}" vs Work history total: ~${Math.round(maxYears * 10) / 10} years`,
        explanation: `Your summary claims ${claimedYears}+ years of professional experience, but your listed employment history totals approximately ${Math.round(maxYears * 10) / 10} years.`,
        whyItMatters: "Contradictions between executive summary claims and verifiable employment dates are flagged as potential misrepresentation by corporate background verification teams.",
        recommendedCorrection: `Align your summary claim to match your actual work history (e.g., replace "${claimedYears}+ years" with "${Math.floor(maxYears)}+ years"), or add earlier roles if relevant history was omitted.`,
        confidence: "High",
        isMandatory: true,
      });
    }
  }

  // 2. Future Dates without "Expected"
  const futureFindings = diagnostics.findings.filter((f) => f.kind === "future");
  for (const f of futureFindings) {
    findings.push({
      id: `contradiction-future-date-${findings.length + 1}`,
      title: `Contradiction: Future Employment Date (${f.roles.join(", ")})`,
      category: "contradiction",
      severity: "High",
      evidenceExcerpt: f.sources.join(" | ").slice(0, 200),
      explanation: `The listed employment dates appear in the future without an 'Expected' or 'Anticipated' label.`,
      whyItMatters: "Future dates in past work history sections trigger automated ATS parser exceptions and confuse reviewers.",
      recommendedCorrection: "Check for typos in the year (e.g. typing 2028 instead of 2024), or clarify if this represents planned contractual work.",
      confidence: "High",
      isMandatory: true,
    });
  }

  // 3. Reversed Dates (Start after End)
  const reversedFindings = diagnostics.findings.filter((f) => f.kind === "reversed");
  for (const f of reversedFindings) {
    findings.push({
      id: `contradiction-reversed-dates-${findings.length + 1}`,
      title: `Contradiction: Start Date Later Than End Date (${f.roles.join(", ")})`,
      category: "contradiction",
      severity: "Critical",
      evidenceExcerpt: f.sources.join(" | ").slice(0, 200),
      explanation: `The start date is printed chronologically after the end date.`,
      whyItMatters: "This is a direct chronological impossibility that signals lack of document proofreading.",
      recommendedCorrection: "Swap the order of the dates so the beginning date precedes the conclusion date.",
      confidence: "High",
      isMandatory: true,
    });
  }

  return { findings, claimedYears };
}
