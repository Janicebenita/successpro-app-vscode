import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { 
  analyzeResume,
  validateEmploymentDates, 
  validateSourceEvidence, 
  severityForRating 
} from "@successpro/domain";
import { 
  buildWorkbookReview, 
  projectWorkbookReview 
} from "../apps/web/src/lib/successpro-v2-review";
import { renderReviewReport } from "../apps/web/src/lib/review-report-renderer";

const root = resolve(".");
const fixturesDir = resolve(root, ".local/phase4b/fixtures");
const outDir = resolve(root, ".local/phase4b/audit_results");

const extractions = JSON.parse(readFileSync(resolve(outDir, "full_extractions.json"), "utf8"));
const jdText = readFileSync(resolve(fixturesDir, "target_job_description.txt"), "utf8");

const cases = [
  { name: "poor_singlecol_nodates_nocontact", withJd: false },
  { name: "average_twocol_multipage_overlaps", withJd: true },
  { name: "strong_singlecol_twopage_metrics", withJd: true },
  { name: "strong_singlecol_twopage_metrics_no_jd", fixture: "strong_singlecol_twopage_metrics", withJd: false },
  { name: "edge_unsupported_metrics_reversed_dates", withJd: false }
];

async function run() {
  const auditReport: Record<string, unknown> = {};

  for (const c of cases) {
    const fixtureKey = c.fixture || c.name;
    const ext = extractions[fixtureKey];
    if (!ext) throw new Error(`Missing extraction for ${fixtureKey}`);

    console.log(`\n========================================`);
    console.log(`Auditing: ${c.name} (withJd: ${c.withJd})`);
    console.log(`========================================`);

    // 1. Employment Dates Validation
    const dateValidation = validateEmploymentDates(ext.text);
    console.log(`Dates status: valid=${dateValidation.valid}, overlaps=${dateValidation.overlaps.length}, reversed=${dateValidation.reversed.length}, warnings=${dateValidation.warnings.length}`);

    // 2. Deterministic Resume Analysis
    const input = {
      text: ext.text,
      targetKeywords: c.withJd ? ["Senior Full Stack Engineer", "TypeScript", "React", "Node.js"] : [],
      jobDescription: c.withJd ? jdText : undefined,
      documentSignals: ext.signals
    };

    const initialResult = analyzeResume(input);

    // 3. Workbook V2 Review
    const v2Review = buildWorkbookReview(initialResult, input, undefined, true);
    const score = v2Review.score;
    const band = v2Review.v2?.descriptiveBand;
    const pillars = v2Review.v2?.pillars;

    console.log(`V2 Score: ${score} / 100 (${band})`);
    console.log(`Pillars:`, JSON.stringify(pillars, null, 2));

    // 4. Action Plan
    const actionPlan = v2Review.v2?.paidReport?.actionPlan || [];
    console.log(`Generated Actions: ${actionPlan.length} recommendations`);

    // 5. Test PDF Report Generation
    const pdfReport = await renderReviewReport({
      result: projectWorkbookReview(v2Review, true),
      completedOn: new Date().toISOString().slice(0, 10),
      targetRole: c.withJd ? "Senior Full Stack Engineer" : ""
    });

    const isPdfHeader = Buffer.from(pdfReport).slice(0, 5).toString() === "%PDF-";
    console.log(`PDF Generated: ${pdfReport.byteLength} bytes, header=%PDF-: ${isPdfHeader}`);

    auditReport[c.name] = {
      fixture: fixtureKey,
      withJd: c.withJd,
      charCount: ext.text.length,
      pageCount: ext.pageCount,
      dateValidation: {
        valid: dateValidation.valid,
        overlaps: dateValidation.overlaps,
        reversed: dateValidation.reversed,
        warnings: dateValidation.warnings,
        entriesCount: dateValidation.entries.length
      },
      score,
      band,
      rubricVersion: v2Review.rubricVersion,
      workbookSha256: v2Review.v2?.workbookSha256,
      pillars: v2Review.v2?.pillars,
      actionCount: actionPlan.length,
      sampleActions: actionPlan.slice(0, 3),
      pdfBytes: pdfReport.byteLength,
      validPdf: isPdfHeader
    };
  }

  writeFileSync(resolve(outDir, "domain_scoring_audit.json"), JSON.stringify(auditReport, null, 2), "utf8");
  console.log(`\n[SUCCESS] Domain & Scoring Audit completed for all cases! Saved to ${resolve(outDir, "domain_scoring_audit.json")}`);
}

run().catch((err) => {
  console.error("AUDIT_FAILED:", err);
  process.exit(1);
});
