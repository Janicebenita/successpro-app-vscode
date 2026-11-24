// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { 
  analyzeResume,
  evaluateSuccessProV2,
  ALL_PARAMETER_IDS,
  CONTENT_PARAMETER_IDS,
  VISUAL_PARAMETER_IDS,
  JOB_MATCH_PARAMETER_IDS,
  employmentDiagnostics,
  chronologyRatingConflict,
  validateSourceEvidence, 
  severityForRating 
} from "@successpro/domain";
import type { ParameterEvaluationInput } from "@successpro/domain";
import { 
  buildWorkbookReview, 
  projectWorkbookReview 
} from "@/lib/successpro-v2-review";
import { renderReviewReport } from "@/lib/review-report-renderer";

const root = resolve("../../"); // from apps/web/src/lib to D:\successpro-app-vscode
const fixturesDir = resolve(root, ".local/phase4b/fixtures");
const outDir = resolve(root, ".local/phase4b/audit_results");

const extractions = JSON.parse(readFileSync(resolve(outDir, "full_extractions.json"), "utf8"));
const jdText = readFileSync(resolve(fixturesDir, "target_job_description.txt"), "utf8");

function makeInputsForProfile(profileRating: number, mode: "with_jd" | "no_jd"): ParameterEvaluationInput[] {
  return ALL_PARAMETER_IDS.map((id) => {
    const isJobMatch = JOB_MATCH_PARAMETER_IDS.includes(id as any);
    if (mode === "no_jd" && isJobMatch) {
      return {
        id,
        status: "N/A",
        rating: null,
        evidence: { excerpt: "", rationale: "Excluded: no job description" },
        issues: []
      };
    }
    const sev = severityForRating(profileRating, false);
    return {
      id,
      status: "Assessed",
      rating: profileRating,
      evidence: { excerpt: "Verified test evidence excerpt", rationale: "Standard evaluation rationale" },
      issues: profileRating < 5 && sev ? [{ severity: sev, message: "Identified developmental area" }] : []
    };
  });
}

describe("Phase 4B: Full Application Domain & Quality Audit", () => {
  const auditReport: Record<string, unknown> = {};

  it("audits poor quality fixture (single column, no dates, no contact, no JD)", async () => {
    const ext = extractions["poor_singlecol_nodates_nocontact"];
    expect(ext).toBeDefined();

    // 1. Employment Dates
    const dateAudit = employmentDiagnostics(ext.text);
    expect(dateAudit.entries.length).toBe(0);

    // 2. Deterministic Pure Workbook Evaluation (poor ratings: 1/5)
    const poorInputs = makeInputsForProfile(1, "no_jd");
    const workbookResult = evaluateSuccessProV2({
      mode: "no_job_description",
      parameters: poorInputs,
      intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: false }
    });

    expect(workbookResult.cumulativeScore).toBe(20.0); // 100 * (1/5) = 20.0
    expect(workbookResult.descriptiveBand).toBe("Substantial revision");

    // 3. Adapter check: without AI outputs, points remain safely reserved in Pending state (Rule 10)
    const input = { text: ext.text, targetKeywords: [], documentSignals: ext.signals };
    const raw = analyzeResume(input);
    const review = buildWorkbookReview(raw, input, undefined, true);

    expect(review.v2).toBeDefined();
    expect(Math.round(review.v2?.unresolvedMaximumPoints ?? 0)).toBe(100); // 100% reserved

    // 4. Render PDF
    const pdf = await renderReviewReport({
      result: projectWorkbookReview(review, true),
      completedOn: "2026-11-16"
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(5000);

    auditReport["poor_singlecol_nodates_nocontact"] = {
      workbookSimulationScore: workbookResult.cumulativeScore,
      workbookBand: workbookResult.descriptiveBand,
      reservedPendingPoints: review.v2?.unresolvedMaximumPoints,
      pillars: review.v2?.pillars,
      actionCount: review.v2?.paidReport?.actionPlan?.length,
      pdfBytes: pdf.length
    };
  });

  it("audits average quality fixture with two-column layout and multi-page structure (with JD)", async () => {
    const ext = extractions["average_twocol_multipage_overlaps"];
    expect(ext).toBeDefined();
    expect(ext.signals.multiColumn).toBe(true);

    // 1. Pure Workbook Evaluation (average ratings: 3/5 with JD)
    const midInputs = makeInputsForProfile(3, "with_jd");
    const workbookResult = evaluateSuccessProV2({
      mode: "with_job_description",
      parameters: midInputs,
      intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true }
    });

    expect(workbookResult.cumulativeScore).toBe(60.0); // 100 * (3/5) = 60.0
    expect(workbookResult.descriptiveBand).toBe("Developing");

    // 2. Adapter review
    const input = { 
      text: ext.text, 
      targetKeywords: ["Operations Analyst", "SQL", "Systems Analyst"],
      jobDescription: jdText,
      documentSignals: ext.signals 
    };
    const raw = analyzeResume(input);
    const review = buildWorkbookReview(raw, input, undefined, true);

    expect(review.v2).toBeDefined();
    expect(review.v2?.scoreStatus).toBe("score_pending"); // assistant assessment not yet run

    // 3. Render PDF
    const pdf = await renderReviewReport({
      result: projectWorkbookReview(review, true),
      completedOn: "2026-11-16",
      targetRole: "Operations Analyst"
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(5000);

    auditReport["average_twocol_multipage_overlaps"] = {
      workbookSimulationScore: workbookResult.cumulativeScore,
      workbookBand: workbookResult.descriptiveBand,
      pillars: review.v2?.pillars,
      actionCount: review.v2?.paidReport?.actionPlan?.length,
      pdfBytes: pdf.length
    };
  });

  it("audits strong technical fixture (with JD, grounded metrics, clean chronology)", async () => {
    const ext = extractions["strong_singlecol_twopage_metrics"];
    expect(ext).toBeDefined();

    // 1. Employment Dates
    const dateAudit = employmentDiagnostics(ext.text);
    expect(dateAudit.entries.length).toBe(3); // 3 distinct roles
    const reversed = dateAudit.findings.filter(f => f.kind === "reversed");
    const overlaps = dateAudit.findings.filter(f => f.kind === "overlap");
    expect(reversed.length).toBe(0);
    expect(overlaps.length).toBe(0);

    // 2. Pure Workbook Evaluation (strong ratings: 4–5/5 with JD)
    const strongInputs = makeInputsForProfile(4, "with_jd");
    const workbookResult = evaluateSuccessProV2({
      mode: "with_job_description",
      parameters: strongInputs,
      intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true }
    });

    expect(workbookResult.cumulativeScore).toBe(80.0); // 100 * (4/5) = 80.0
    expect(workbookResult.descriptiveBand).toBe("Strong foundation");

    // 3. Adapter review
    const input = { 
      text: ext.text, 
      targetKeywords: ["Senior Full Stack Engineer", "TypeScript", "React", "Node.js", "PostgreSQL"],
      jobDescription: jdText,
      documentSignals: ext.signals 
    };
    const raw = analyzeResume(input);
    const review = buildWorkbookReview(raw, input, undefined, true);

    expect(review.v2).toBeDefined();

    // 4. Render PDF
    const pdf = await renderReviewReport({
      result: projectWorkbookReview(review, true),
      completedOn: "2026-11-16",
      targetRole: "Senior Full Stack Engineer"
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(5000);

    auditReport["strong_singlecol_twopage_metrics"] = {
      workbookSimulationScore: workbookResult.cumulativeScore,
      workbookBand: workbookResult.descriptiveBand,
      pillars: review.v2?.pillars,
      actionCount: review.v2?.paidReport?.actionPlan?.length,
      pdfBytes: pdf.length
    };
  });

  it("audits strong technical fixture without JD (no-JD redistribution)", async () => {
    const ext = extractions["strong_singlecol_twopage_metrics"];
    const input = { 
      text: ext.text, 
      targetKeywords: [],
      documentSignals: ext.signals 
    };
    const raw = analyzeResume(input);
    const review = buildWorkbookReview(raw, input, undefined, true);

    expect(review.v2).toBeDefined();
    // Rule: Without JD, weights are 65 content / 35 visual / 0 job match
    expect(review.v2?.pillars.jobMatch.state).toBe("Excluded");
    expect(review.v2?.pillars.jobMatch.fixedMaxPoints).toBe(0);
    expect(review.v2?.pillars.content.fixedMaxPoints).toBe(65);
    expect(review.v2?.pillars.visual.fixedMaxPoints).toBe(35);

    auditReport["strong_singlecol_twopage_metrics_no_jd"] = {
      pillars: review.v2?.pillars
    };
  });

  it("audits edge case with reversed dates and unsupported hyperbolic metrics", async () => {
    const ext = extractions["edge_unsupported_metrics_reversed_dates"];
    expect(ext).toBeDefined();

    // 1. Employment Dates
    const dateAudit = employmentDiagnostics(ext.text);
    const reversedFindings = dateAudit.findings.filter(f => f.kind === "reversed");
    expect(reversedFindings.length).toBeGreaterThan(0); // Jan 2024 - Dec 2022 is reversed!
    expect(reversedFindings[0].certainty).toBe("verified");

    // Chronology rating conflict check: Rating > 0 must trigger conflict
    const conflictMsg = chronologyRatingConflict(ext.text, 4);
    expect(conflictMsg).toBeDefined();
    expect(conflictMsg).toContain("reversed source dates");

    const input = { text: ext.text, targetKeywords: [], documentSignals: ext.signals };
    const raw = analyzeResume(input);
    const review = buildWorkbookReview(raw, input, undefined, true);

    auditReport["edge_unsupported_metrics_reversed_dates"] = {
      reversedDates: reversedFindings.map(f => ({ roles: f.roles, message: f.message })),
      conflictCheckRating4: conflictMsg,
      pillars: review.v2?.pillars
    };

    // Save full audit report
    writeFileSync(resolve(outDir, "domain_scoring_audit.json"), JSON.stringify(auditReport, null, 2), "utf8");
    console.log("Saved domain scoring audit to", resolve(outDir, "domain_scoring_audit.json"));
  });
});
