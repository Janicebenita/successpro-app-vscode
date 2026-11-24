import { describe, expect, it } from "vitest";
import { analyzeJobMatch, analyzeResume, calculateOverallScore, canStartFreeReview, validateResumeUpload } from "@successpro/domain";
import { resumeGoldenDataset } from "../test-fixtures/resume-golden-dataset";

const strongResume = `Avery Patel\navery@example.com | +91 98765 43210 | linkedin.com/in/averypatel\nProfessional Summary\nProduct analyst with experience delivering measurable improvements through stakeholder collaboration and data strategy.\nExperience\nSenior Product Analyst | Northstar Systems | 2023 - Present\n• Led analytics redesign that improved activation by 24% across 3 markets.\n• Built reporting workflow that reduced weekly preparation time by 12 hours.\nProduct Analyst | Orbit Labs | 2020 - 2023\n• Developed experiments that increased completion by 18%.\n• Streamlined issue triage and reduced response time by 35%.\nEducation\nB.Tech Information Technology | 2016 - 2020\nSkills: Product analytics, SQL, experimentation, dashboards, stakeholder management, strategy\nProjects\nCreated a retention model used by 4 product teams.\nCertifications\nAnalytics Foundations`;

describe("deterministic resume scoring", () => {
  it("returns exactly 12 factors, removed 20% penalty, and 4 separate scores", () => {
    const first = analyzeResume({ text: strongResume, targetKeywords: ["sql", "analytics", "strategy"], documentSignals: { hasVisualEvidence: true, pageCount: 2 } });
    const second = analyzeResume({ text: strongResume, targetKeywords: ["sql", "analytics", "strategy"], documentSignals: { hasVisualEvidence: true, pageCount: 2 } });
    expect(first.factors).toHaveLength(12);
    expect(first.score).toBe(second.score);
    expect(first.rubricVersion).toBe("ats-ai-hybrid-v1");
    expect(first.rawScore).toBe(first.score);
    expect(first.score).toBeGreaterThan(0);
    expect(first.factors.reduce((sum, item) => sum + item.maximum, 0)).toBe(100);
    // Verify 4 separate score categories
    expect(first.atsReadinessScore).toBeGreaterThan(0);
    expect(first.contentQualityScore).toBeGreaterThan(0);
    expect(first.visualDesignScore).toBeGreaterThan(0);
    expect(first.visualDesignStatus).toBe("evaluated");
    expect(first.jobMatchScore).toBeGreaterThan(0);
    expect(first.jobMatchStatus).toBe("completed");
  });

  it("returns not_evaluated and null for visualDesignScore when visual evidence is absent", () => {
    const noVisual = analyzeResume({ text: strongResume, targetKeywords: [], documentSignals: {} });
    expect(noVisual.visualDesignScore).toBeNull();
    expect(noVisual.visualDesignStatus).toBe("not_evaluated");
    expect(noVisual.scoreSources?.visualDesign).toContain("Not evaluated");
  });

  it("blends validated Gemini visual evidence and OpenCV at exactly 50:50", () => {
    const measured = analyzeResume({ text: strongResume, targetKeywords: [], documentSignals: { hasVisualEvidence: true, fontCount: 2, minimumFontSize: 10 } });
    const blended = analyzeResume({ text: strongResume, targetKeywords: [], documentSignals: { hasVisualEvidence: true, fontCount: 2, minimumFontSize: 10, geminiVisualScore: 50, geminiVisualConfidence: 0.9 } });
    expect(measured.visualDesignScore).toBe(100);
    expect(blended.visualDesignScore).toBe(75);
    expect(blended.scoreSources?.visualDesign).toContain("Gemini Vision");
  });

  it("accepts the configured maximum of 25 rendered pages", () => {
    const result = analyzeResume({ text: strongResume, targetKeywords: [], documentSignals: { hasVisualEvidence: true, pageCount: 25 } });
    expect(result.visualDesignStatus).toBe("evaluated");
  });

  it("handles job match requiring a job description or target keywords", () => {
    const noJob = analyzeResume({ text: strongResume, targetKeywords: [], documentSignals: {} });
    expect(noJob.jobMatchScore).toBeNull();
    expect(noJob.jobMatchStatus).toBe("job_description_required");
  });

  it("reduces layout factors when explicit document risks exist", () => {
    const clean = analyzeResume({ text: strongResume, targetKeywords: [], documentSignals: { hasVisualEvidence: true } });
    const risky = analyzeResume({ text: strongResume, targetKeywords: [], documentSignals: { hasVisualEvidence: true, multiColumn: true, tableHeavy: true } });
    expect(risky.score).toBeLessThan(clean.score);
  });

  it("includes page design and length signals in the Resume Checker result", () => {
    const clean = analyzeResume({ text: strongResume, targetKeywords: [], documentSignals: { hasVisualEvidence: true, pageCount: 2 } });
    const difficult = analyzeResume({ text: strongResume, targetKeywords: [], documentSignals: { hasVisualEvidence: true, pageCount: 5, crowdedLayout: true, inconsistentMargins: true, smallText: true } });
    expect(difficult.score).toBeLessThan(clean.score);
    expect(difficult.factors.find((item) => item.id === "formatting")?.label).toBe("Layout and visual presentation");
    expect(difficult.factors.find((item) => item.id === "language")?.label).toBe("Length and writing quality");
  });

  it("recognises common professional heading variants and cites resume wording", () => {
    const text = strongResume
      .replace("Professional Summary", "EXECUTIVE PROFILE")
      .replace("Experience", "PROFESSIONAL EXPERIENCE")
      .replace("Education", "ACADEMIC BACKGROUND")
      .replace("Skills:", "CORE SKILLS\n");
    const result = analyzeResume({ text, targetKeywords: [], documentSignals: { pageCount: 2 } });
    const structure = result.factors.find((item) => item.id === "structure")!;
    expect(structure.evidence[0]).toContain("summary, experience, education, skills");
    expect(result.factors.find((item) => item.id === "skills")?.evidence[0]).not.toContain("0 skills");
    expect(result.factors.find((item) => item.id === "impact")?.evidence.some((item) => item.includes("Resume example: “"))).toBe(true);
    expect(result.disclaimer).not.toContain("20%");
  });
});

describe("resume golden dataset", () => {
  it("covers every resume class required by the master brief", () => {
    expect(resumeGoldenDataset.map((fixture) => fixture.id)).toEqual([
      "junior",
      "mid-career",
      "executive",
      "career-gap",
      "career-switch",
      "technical",
      "nontechnical",
      "academic",
      "multilingual",
      "scanned-pdf",
      "two-column",
      "table-heavy",
      "poor-formatting",
      "excellent-formatting",
      "missing-dates",
      "inconsistent-chronology",
    ]);
  });

  it.each(resumeGoldenDataset)("keeps $id within its reviewed score band", (fixture) => {
    const result = analyzeResume(fixture.input);
    const legacyFactorTotal = result.factors.reduce((sum, factor) => sum + factor.earned, 0);
    expect(legacyFactorTotal).toBeGreaterThanOrEqual(fixture.expectedScore.minimum);
    expect(legacyFactorTotal).toBeLessThanOrEqual(fixture.expectedScore.maximum);

    for (const [factorId, maximum] of Object.entries(fixture.expectedFactorCeilings ?? {})) {
      const factor = result.factors.find((candidate) => candidate.id === factorId);
      expect(factor, `Missing factor ${factorId}`).toBeDefined();
      expect(factor!.earned).toBeLessThanOrEqual(maximum);
    }
  });
});

describe("deterministic job matching", () => {
  it("separates job-match scoring from the core resume score", () => {
    const result = analyzeJobMatch({
      resumeText: strongResume,
      jobDescription: "We need a senior product analytics specialist with SQL, experimentation, stakeholder management, dashboards, reporting, strategy, and product analytics experience. The specialist will lead analytics strategy and experimentation across product teams.",
    });
    expect(result.score).toBeGreaterThan(40);
    expect(result.matched).toContain("analytics");
    expect(result.disclaimer).toContain("guide");
  });
});

describe("upload policy", () => {
  it("requires extension, MIME, and signature agreement", () => {
    expect(validateResumeUpload({ name: "resume.pdf", mimeType: "application/pdf", size: 100, signature: new TextEncoder().encode("%PDF") })).toEqual({ valid: true, kind: "pdf" });
    expect(validateResumeUpload({ name: "resume.doc", mimeType: "application/msword", size: 100, signature: new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]) })).toEqual({ valid: true, kind: "doc" });
    expect(validateResumeUpload({ name: "resume.doc", mimeType: "application/msword", size: 100, signature: new TextEncoder().encode("%PDF") }).valid).toBe(false);
    expect(validateResumeUpload({ name: "resume.pdf", mimeType: "application/pdf", size: 100, signature: new TextEncoder().encode("MZ00") }).valid).toBe(false);
  });
});

describe("free usage policy", () => {
  it("counts completed reviews only within the UTC calendar month", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    const entries = [
      { occurredAt: new Date("2026-09-01T00:00:00Z"), outcome: "completed" as const },
      { occurredAt: new Date("2026-09-04T00:00:00Z"), outcome: "parse_failed" as const },
      { occurredAt: new Date("2026-08-30T00:00:00Z"), outcome: "completed" as const },
    ];
    expect(canStartFreeReview(entries, now)).toEqual({ allowed: true, used: 1, remaining: 2, limit: 3 });
  });
});


describe("top-level scoring contract", () => {
  it("keeps missing job-description weight unallocated", () => {
    expect(calculateOverallScore({ contentQualityScore: 80, visualQualityScore: 90, jobMatchScore: null, hasJobDescription: false, visualStatus: "evaluated", jobMatchStatus: "job_description_required" })).toMatchObject({ score: 62.5, evaluationCoverage: 75, provisional: true, jobMatchContribution: null });
  });
  it("uses exact 50/25/25 weights when complete", () => {
    expect(calculateOverallScore({ contentQualityScore: 80, visualQualityScore: 85, jobMatchScore: 90, hasJobDescription: true, visualStatus: "evaluated" })).toMatchObject({ score: 83.75, evaluationCoverage: 100, provisional: false });
  });
  it("keeps missing visual and job weights unallocated", () => {
    expect(calculateOverallScore({ contentQualityScore: 80, visualQualityScore: null, jobMatchScore: null, hasJobDescription: false, visualStatus: "not_evaluated" })).toMatchObject({ score: 40, evaluationCoverage: 50, provisional: true });
  });
  it("keeps ATS diagnostic independent from overall score", () => {
    const clean = analyzeResume({ text: strongResume, documentSignals: { hasVisualEvidence: true } });
    const risky = analyzeResume({ text: strongResume, documentSignals: { hasVisualEvidence: true, inconsistentChronology: true } });
    expect(risky.atsReadinessScore).toBeLessThan(clean.atsReadinessScore);
    expect(risky.score).toBe(clean.score);
  });
  it("labels keyword fallback and leaves unusable fallback unevaluated", () => {
    const jd = "Senior product analytics specialist responsible for SQL experimentation stakeholder dashboards reporting strategy and product analytics across teams. ".repeat(3);
    const evaluated = analyzeResume({ text: strongResume, jobDescription: jd, documentSignals: { hasVisualEvidence: true } });
    expect(evaluated).toMatchObject({ jobMatchStatus: "completed", jobMatchMethod: "deterministic_fallback", scoreSources: { jobMatch: "Keyword-Based Fallback" } });
    const unusable = analyzeResume({ text: strongResume, jobDescription: "and the with for from that this will you your our are have has into who but not all any job role work team years experience ".repeat(3), documentSignals: {} });
    expect(unusable).toMatchObject({ jobMatchScore: null, jobMatchMethod: "not_evaluated", evaluationCoverage: 50 });
  });
});
