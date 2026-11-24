import type {
  GapRiskResult,
  GapRiskFinding,
  GapRiskSummary,
  TimelineGapDetail,
} from "./types";
import type { DocumentSignals } from "@successpro/contracts";
import { analyzeTimelineGaps } from "./timeline-analyzer";
import { analyzeMissingInformation } from "./missing-info-analyzer";
import { analyzeContentQuality } from "./content-quality-analyzer";
import { analyzeContradictions } from "./contradiction-analyzer";
import { analyzeAtsTechnical } from "./ats-technical-analyzer";

export * from "./types";
export * from "./timeline-analyzer";
export * from "./missing-info-analyzer";
export * from "./content-quality-analyzer";
export * from "./contradiction-analyzer";
export * from "./ats-technical-analyzer";

/**
 * Assigns precise page numbers to findings based on the position of the evidence excerpt
 * within document page boundaries.
 */
function assignPageLocations(
  findings: GapRiskFinding[],
  text: string,
  signals: Partial<DocumentSignals> = {}
): (GapRiskFinding & { pageLocation: string })[] {
  const pageCount = signals.pageCount ?? 1;

  // Split text by page markers if available, or calculate character-based bounds
  const pages = text.split(/\f|\n--- Page \d+ ---\n/);
  const usePageSlices = pages.length > 1;

  return findings.map((f) => {
    if (f.pageNumber) return { ...f, pageLocation: f.pageLocation || `Page ${f.pageNumber}` };

    // Search for the excerpt position in text
    const searchTarget = f.evidenceExcerpt ? f.evidenceExcerpt.slice(0, 50).trim() : "";
    if (searchTarget) {
      if (usePageSlices) {
        for (let i = 0; i < pages.length; i++) {
          if (pages[i].includes(searchTarget)) {
            const pageNum = i + 1;
            return {
              ...f,
              pageNumber: pageNum,
              pageLocation: `Page ${pageNum}`,
            };
          }
        }
      } else if (pageCount > 1) {
        const charIndex = text.indexOf(searchTarget);
        if (charIndex !== -1) {
          const estimatedPage = Math.min(pageCount, Math.floor((charIndex / text.length) * pageCount) + 1);
          return {
            ...f,
            pageNumber: estimatedPage,
            pageLocation: `Page ${estimatedPage}`,
          };
        }
      }
    }

    return {
      ...f,
      pageNumber: f.isMandatory && f.category === "missing_information" ? 1 : null,
      pageLocation: f.isMandatory && f.category === "missing_information" ? "Page 1 (Header)" : "Document-wide",
    };
  });
}

/**
 * Master Resume Gap & Risk Detection Evaluator.
 * Operates completely independently of the existing ATS scoring engine.
 */
export function analyzeResumeGapsAndRisks(
  text: string,
  signals: Partial<DocumentSignals> = {},
  targetJobDescription = "",
  now = new Date()
): GapRiskResult {
  const allFindings: GapRiskFinding[] = [];

  // 1. Timeline Analysis
  const timelineResult = analyzeTimelineGaps(text, now);
  allFindings.push(...timelineResult.findings);

  // 2. Missing Information Analysis
  const missingInfoFindings = analyzeMissingInformation(text, targetJobDescription);
  allFindings.push(...missingInfoFindings);

  // 3. Content Quality Analysis
  const contentQualityFindings = analyzeContentQuality(text);
  allFindings.push(...contentQualityFindings);

  // 4. Consistency & Contradiction Analysis
  const contradictionResult = analyzeContradictions(text, now);
  allFindings.push(...contradictionResult.findings);

  // 5. ATS Technical Analysis
  const atsTechnicalFindings = analyzeAtsTechnical(text, signals);
  allFindings.push(...atsTechnicalFindings);

  // Map precise page numbers
  const mappedFindings = assignPageLocations(allFindings, text, signals);

  // Sort findings by severity order: Critical -> High -> Medium -> Low
  const severityRank: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  mappedFindings.sort((a, b) => (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4));

  // Compute summary
  const summary: GapRiskSummary = {
    totalIssues: mappedFindings.length,
    criticalCount: mappedFindings.filter((f) => f.severity === "Critical").length,
    highCount: mappedFindings.filter((f) => f.severity === "High").length,
    mediumCount: mappedFindings.filter((f) => f.severity === "Medium").length,
    lowCount: mappedFindings.filter((f) => f.severity === "Low").length,
    categoryCounts: {
      timeline_gap: mappedFindings.filter((f) => f.category === "timeline_gap").length,
      missing_information: mappedFindings.filter((f) => f.category === "missing_information").length,
      content_quality: mappedFindings.filter((f) => f.category === "content_quality").length,
      contradiction: mappedFindings.filter((f) => f.category === "contradiction").length,
      ats_technical: mappedFindings.filter((f) => f.category === "ats_technical").length,
    },
  };

  return {
    summary,
    findings: mappedFindings,
    timelineGaps: timelineResult.timelineGaps,
    totalExperienceMonths: timelineResult.totalMonths,
    claimedExperienceYears: contradictionResult.claimedYears,
    evaluatedAt: now.toISOString(),
  };
}
