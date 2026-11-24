// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildWorkbookReview } from "./successpro-v2-review";
import { analyzeResume } from "@successpro/domain";
import { renderReviewReport } from "@/lib/review-report-renderer";
import { writeFile } from "node:fs/promises";

const resume = `Samira Test\nsamira@example.com | +91 98765 43210\nProfessional summary\nProduct manager with experience improving customer services.\nExperience\nSenior Product Manager | Northstar | 2022 - Present\nLed a customer programme that improved retention by 18 percent.\nEducation\nMBA | Example School | 2020\nSkills: strategy, analytics, customer research, leadership, experimentation.`;

describe("detailed review report", () => {
  it("renders the nullable workbook score and all parameter traces", async () => {
    const input={text:resume,targetKeywords:[],documentSignals:{}};
    const result=buildWorkbookReview(analyzeResume(input),input,undefined,false);
    const pdf=await renderReviewReport({result,completedOn:"2026-11-14"});
    expect(pdf.subarray(0,4).toString()).toBe("%PDF");expect(pdf.length).toBeGreaterThan(5000);
  });
  it("renders an A4 PDF from the authoritative deterministic review", async () => {
    const result = analyzeResume({ text: resume, targetKeywords: ["strategy"], documentSignals: {} });
    const topActions = ["Add verified outcomes where available.", "Make the summary more specific to the intended role.", "Group the strongest skills by relevance.", "Keep the document reading order simple."].map((suggestion, index) => ({ observed: index === 0 ? "One quantified outcome was found, while several other statements describe responsibilities without a verified result." : "The supplied resume contains relevant evidence that can be organized more clearly for a fast recruiter review.", inference: "A reader may need more context to understand the candidate's scope, relevance, and contribution.", suggestion, originalExcerpt: index === 0 ? "Led customer programme delivery across three markets." : "", improvedExample: index === 0 ? "Led customer programme delivery across three markets, coordinating the work from planning through launch." : "" }));
    const pdf = await renderReviewReport({ result, completedOn: "2026-09-23", targetRole: "Product Director", summary: { summary: "The resume has a useful professional foundation and relevant experience. Its strongest next step is to make verified evidence easier to scan, connect every outcome to the correct role, and simplify the reading order.", topActions, limitations: ["This review uses only the supplied resume and document signals. Confirm every fact before applying a suggestion."] }, explanations: { [result.factors[0].id]: { observed: "Evidence found in the document.", inference: "A reader may need more context.", suggestion: "Add verified context.", whyItMatters: "Clear context supports fast review.", example: "Action, context, and verified result." } } });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(5_000);
    if (process.env.RENDER_REVIEW_PDF === "1") await writeFile("../../output/pdf/successpro-detailed-review-redesign.pdf", pdf);
  });
});

describe("paid professional evaluation report", () => {
  const read = async (pdf: Buffer) => {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(pdf) });
    try {
      const text = await parser.getText();
      return { text: text.text, pages: text.total };
    } finally { await parser.destroy(); }
  };
  const adjustmentWording = /\b20[- ]?marks?\b|score adjustment|adjusted score|score reduction|raw score|original score/i;

  it("uses the professional layout with SuccessPro data, a page footer and embedded report fonts", async () => {
    const { buildSample } = await import("@/test-fixtures/review-report-sample");
    const sample = buildSample();
    const pdf = await renderReviewReport({ result: sample.paid, summary: sample.output as never, targetRole: "Data Analyst", completedOn: "2026-11-24" });
    const { text, pages } = await read(pdf);
    expect(text).toContain("PROFESSIONAL RESUME EVALUATION REPORT");
    expect(text).toContain("TABLE OF CONTENTS");
    expect(text).toContain(`Final Score: ${sample.paid.score} / 100`);
    for (const row of sample.paid.v2!.parameters) expect(text.replace(/\s+/g, " ")).toContain(row.name);
    expect(text).toContain(`Page 1 of ${pages}`);
    expect(text).toContain("Confidential – SuccessPro Resume Evaluation");
    expect(text).not.toContain("LINE CAUSING ISSUE");
    expect(text).not.toMatch(adjustmentWording);
    expect(pdf.includes("Carlito-Regular")).toBe(true);
  });

  it("quotes only real resume text and never presents sample lines as the candidate's own", async () => {
    const { buildSample, sampleResume } = await import("@/test-fixtures/review-report-sample");
    const sample = buildSample();
    const { text } = await read(await renderReviewReport({ result: sample.paid, summary: sample.output as never, completedOn: "2026-11-24" }));
    const flat = text.replace(/\s+/g, " ");
    const quoted = [...flat.matchAll(/From your resume: “([^”]+)”/g)].map((match) => match[1]);
    expect(quoted.length).toBeGreaterThan(0);
    for (const quote of quoted) expect(sampleResume.replace(/\s+/g, " ")).toContain(quote);
    expect(flat).not.toMatch(/P&L accountability|telecom regulatory/i);
  });

  it("shows an incomplete report as pending without adjustment wording", async () => {
    const { buildSample } = await import("@/test-fixtures/review-report-sample");
    const sample = buildSample({ completed: false });
    expect(sample.paid.v2?.scoreStatus).toBe("score_pending");
    const { text } = await read(await renderReviewReport({ result: sample.paid, completedOn: "2026-11-24" }));
    expect(text).toContain("Final Score: Pending (assessment incomplete)");
    expect(text).toContain("This evaluation is incomplete.");
    expect(text).not.toMatch(adjustmentWording);
  });

  it("renders a long multi-page report and a report without a job description", async () => {
    const { buildSample } = await import("@/test-fixtures/review-report-sample");
    const long = buildSample();
    const summary = structuredClone(long.output) as typeof long.output;
    summary.summary = Array.from({ length: 6 }, () => long.output.summary).join(" ");
    summary.topActions = Array.from({ length: 8 }, (_, index) => ({ ...long.output.topActions[index % 3] }));
    const result = structuredClone(long.paid);
    result.gapRiskAnalysis!.findings = Array.from({ length: 14 }, (_, index) => ({ ...long.paid.gapRiskAnalysis!.findings[index % 2], id: `finding-${index}` }));
    const longPdf = await read(await renderReviewReport({ result, summary: summary as never, targetRole: "Senior Data Analyst, Business Intelligence Analyst", completedOn: "2026-11-24" }));
    expect(longPdf.pages).toBeGreaterThan(8);
    expect(longPdf.text).toContain(`Page ${longPdf.pages} of ${longPdf.pages}`);
    const noJd = buildSample({ withJd: false, pageCount: 1 });
    const noJdPdf = await read(await renderReviewReport({ result: noJd.paid, summary: noJd.output as never, completedOn: "2026-11-24" }));
    expect(noJdPdf.text).toContain("No job description was supplied");
  });

  it("keeps the Free report on its existing layout", async () => {
    const { buildSample } = await import("@/test-fixtures/review-report-sample");
    const sample = buildSample();
    expect(sample.free.v2?.paidReport).toBeUndefined();
    const { text } = await read(await renderReviewReport({ result: sample.free, targetRole: "Data Analyst", completedOn: "2026-11-24" }));
    expect(text).toContain("Your resume, reviewed.");
    expect(text).not.toContain("PROFESSIONAL RESUME EVALUATION REPORT");
  });
});
