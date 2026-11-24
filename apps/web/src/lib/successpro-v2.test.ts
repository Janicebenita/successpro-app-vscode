import { describe, expect, it } from "vitest";
import {
  ALL_PARAMETER_IDS,
  CONTENT_PARAMETER_IDS,
  VISUAL_PARAMETER_IDS,
  JOB_MATCH_PARAMETER_IDS,
  PARAMETER_REGISTRY,
  PILLAR_MAX_WITH_JD,
  PILLAR_MAX_NO_JD,
  evaluateSuccessProV2,
  calculateTenureMonths,
  calculateTenureYears,
  roundDisplay,
  getDescriptiveBand,
  CAREER_ADAPTATIONS,
  analyzeJobMatch,
} from "@successpro/domain";
import type { ParameterEvaluationInput } from "@successpro/domain";

function makeSyntheticInputs(rating: number, status: "Assessed" | "N/A" | "Pending" = "Assessed"): ParameterEvaluationInput[] {
  return ALL_PARAMETER_IDS.map((id) => ({
    id,
    status,
    rating: status === "Assessed" ? rating : null,
    evidence: { excerpt: "Verified test excerpt", rationale: "Evaluation test rationale" },
    issues: [],
  }));
}

describe("SuccessPro v2 Authoritative Scoring Engine", () => {
  describe("A. Workbook Verification Cases (from successpro_v2_workbook_verification.json)", () => {
    it("TC01: All parameters rated 4/5 With JD produces 80.0/100 (Content 40, Visual 20, Job Match 20)", () => {
      const inputs = makeSyntheticInputs(4);
      const result = evaluateSuccessProV2({
        mode: "with_job_description",
        parameters: inputs,
        intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true },
      });

      expect(result.cumulativeScore).toBe(80.0);
      expect(result.scoreStatus).toBe("completed");
      expect(result.pillars.content.confirmedEarned).toBe(40.0);
      expect(result.pillars.content.fixedMaxPoints).toBe(50.0);
      expect(result.pillars.visual.confirmedEarned).toBe(20.0);
      expect(result.pillars.visual.fixedMaxPoints).toBe(25.0);
      expect(result.pillars.jobMatch.confirmedEarned).toBe(20.0);
      expect(result.pillars.jobMatch.fixedMaxPoints).toBe(25.0);
    });

    it("TC02: All parameters rated 4/5 No JD produces 80.0/100 (Content 52, Visual 28, Job Match 0)", () => {
      const inputs = makeSyntheticInputs(4);
      const result = evaluateSuccessProV2({
        mode: "no_job_description",
        parameters: inputs,
        intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true },
      });

      expect(result.cumulativeScore).toBe(80.0);
      expect(result.scoreStatus).toBe("completed");
      expect(result.pillars.content.confirmedEarned).toBeCloseTo(52.0, 6);
      expect(result.pillars.content.fixedMaxPoints).toBe(65.0);
      expect(result.pillars.visual.confirmedEarned).toBeCloseTo(28.0, 6);
      expect(result.pillars.visual.fixedMaxPoints).toBe(35.0);
      expect(result.pillars.jobMatch.confirmedEarned).toBe(0.0);
      expect(result.pillars.jobMatch.fixedMaxPoints).toBe(0.0);
      expect(result.pillars.jobMatch.state).toBe("Excluded");
    });

    it("TC03: Rule 01 worked example: Content 38/50 + Visuals 20/25 + Match 17/25 = 75.0/100", () => {
      // Content: C01-C09 earn 38 total
      // Visual: V01-V06 earn 20 total (4/5 across all 25)
      // Match: J01-J05 earn 17 total
      const inputs: ParameterEvaluationInput[] = [
        // Content (sum base = 50): ratings selected to yield exactly 38 earned points
        { id: "C01", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 6 * 0.8 = 4.8
        { id: "C02", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 10 * 0.8 = 8.0
        { id: "C03", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 8 * 0.8 = 6.4
        { id: "C04", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 7 * 0.8 = 5.6
        { id: "C05", status: "Assessed", rating: 3, evidence: { excerpt: "ex", rationale: "rat" } }, // 4 * 0.6 = 2.4
        { id: "C06", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 5 * 0.8 = 4.0
        { id: "C07", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 4 * 0.8 = 3.2
        { id: "C08", status: "Assessed", rating: 3, evidence: { excerpt: "ex", rationale: "rat" } }, // 3 * 0.6 = 1.8
        { id: "C09", status: "Assessed", rating: 3, evidence: { excerpt: "ex", rationale: "rat" } }, // 3 * 0.6 = 1.8
        // Total Content earned = 4.8 + 8 + 6.4 + 5.6 + 2.4 + 4 + 3.2 + 1.8 + 1.8 = 38.0

        // Visual (sum base = 25): all rating 4 -> 20.0
        { id: "V01", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } },
        { id: "V02", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } },
        { id: "V03", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } },
        { id: "V04", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } },
        { id: "V05", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } },
        { id: "V06", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } },

        // Match (sum base = 25): ratings selected to yield exactly 17 earned points
        { id: "J01", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 7 * 0.8 = 5.6
        { id: "J02", status: "Assessed", rating: 3, evidence: { excerpt: "ex", rationale: "rat" } }, // 6 * 0.6 = 3.6
        { id: "J03", status: "Assessed", rating: 3, evidence: { excerpt: "ex", rationale: "rat" } }, // 5 * 0.6 = 3.0
        { id: "J04", status: "Assessed", rating: 3, evidence: { excerpt: "ex", rationale: "rat" } }, // 4 * 0.6 = 2.4
        { id: "J05", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 3 * 0.8 = 2.4
        // Total Match earned = 5.6 + 3.6 + 3.0 + 2.4 + 2.4 = 17.0
      ];

      const result = evaluateSuccessProV2({
        mode: "with_job_description",
        parameters: inputs,
        intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true },
      });

      expect(roundDisplay(result.pillars.content.confirmedEarned, 1)).toBe(38.0);
      expect(roundDisplay(result.pillars.visual.confirmedEarned, 1)).toBe(20.0);
      expect(roundDisplay(result.pillars.jobMatch.confirmedEarned, 1)).toBe(17.0);
      expect(result.cumulativeScore).toBe(75.0);
      expect(result.scoreStatus).toBe("completed");
    });

    it("TC04: Rule 02 worked example: Content 49.4/65 + Visuals 28/35 = 77.4/100", () => {
      // Content: C01-C09 with No JD (max 65) ratings selected to yield 49.4 (mean rating 3.8 / 5)
      // Visual: all rated 4 -> 28 / 35
      const inputs: ParameterEvaluationInput[] = [
        { id: "C01", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 7.8 * 0.8 = 6.24
        { id: "C02", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 13.0 * 0.8 = 10.4
        { id: "C03", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 10.4 * 0.8 = 8.32
        { id: "C04", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 9.1 * 0.8 = 7.28
        { id: "C05", status: "Assessed", rating: 3, evidence: { excerpt: "ex", rationale: "rat" } }, // 5.2 * 0.6 = 3.12
        { id: "C06", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 6.5 * 0.8 = 5.2
        { id: "C07", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 5.2 * 0.8 = 4.16
        { id: "C08", status: "Assessed", rating: 3, evidence: { excerpt: "ex", rationale: "rat" } }, // 3.9 * 0.6 = 2.34
        { id: "C09", status: "Assessed", rating: 3, evidence: { excerpt: "ex", rationale: "rat" } }, // 3.9 * 0.6 = 2.34
        // Total Content = 6.24 + 10.4 + 8.32 + 7.28 + 3.12 + 5.2 + 4.16 + 2.34 + 2.34 = 49.4

        { id: "V01", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 8.4 * 0.8 = 6.72
        { id: "V02", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 7.0 * 0.8 = 5.6
        { id: "V03", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 5.6 * 0.8 = 4.48
        { id: "V04", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 4.2 * 0.8 = 3.36
        { id: "V05", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 5.6 * 0.8 = 4.48
        { id: "V06", status: "Assessed", rating: 4, evidence: { excerpt: "ex", rationale: "rat" } }, // 4.2 * 0.8 = 3.36
        // Total Visual = 28.0
      ];

      const result = evaluateSuccessProV2({
        mode: "no_job_description",
        parameters: inputs,
        intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true },
      });

      expect(roundDisplay(result.pillars.content.confirmedEarned, 1)).toBe(49.4);
      expect(roundDisplay(result.pillars.visual.confirmedEarned, 1)).toBe(28.0);
      expect(result.cumulativeScore).toBe(77.4);
      expect(result.scoreStatus).toBe("completed");
    });

    it("TC05: Rule 05 N/A redistribution: C05 N/A With JD. Content remaining base = 46. C02 max = 50 * 10 / 46 = 10.869565...", () => {
      const inputs = makeSyntheticInputs(4);
      const c05 = inputs.find((p) => p.id === "C05")!;
      c05.status = "N/A";
      c05.rating = null;
      c05.naOrPendingReason = "No relevant qualification required or supplied.";
      c05.naOrPendingReason = "No qualification required by role and none supplied.";

      const result = evaluateSuccessProV2({
        mode: "with_job_description",
        parameters: inputs,
        intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true },
      });

      const c02Result = result.parameters.find((p) => p.id === "C02")!;
      const expectedC02EffectiveMax = (50 * 10) / 46;
      expect(c02Result.effectiveMaxWeight).toBeCloseTo(expectedC02EffectiveMax, 6);
      expect(c02Result.earnedPoints).toBeCloseTo(expectedC02EffectiveMax * 0.8, 6);

      const c05Result = result.parameters.find((p) => p.id === "C05")!;
      expect(c05Result.effectiveMaxWeight).toBe(0);
      expect(c05Result.earnedPoints).toBe(0);

      // Content pillar total must strictly preserve 50.00 max points
      expect(result.pillars.content.effectiveMaxTotal).toBeCloseTo(50.0, 6);
      expect(result.pillars.content.fixedMaxPoints).toBe(50.0);
      // Zero weight leaked to visual or jobMatch
      expect(result.pillars.visual.fixedMaxPoints).toBe(25.0);
      expect(result.pillars.jobMatch.fixedMaxPoints).toBe(25.0);
    });

    it("TC06: Rule 07 Pending visuals (pasted text): V01–V06 Pending. Score publication status is score_pending", () => {
      const inputs = makeSyntheticInputs(4);
      // Mark all visual parameters as Pending
      for (const p of inputs) {
        if (p.id.startsWith("V")) {
          p.status = "Pending";
          p.rating = null;
        }
      }

      const result = evaluateSuccessProV2({
        mode: "with_job_description",
        parameters: inputs,
        intakeGates: { textReliable: true, visualDocumentAvailable: false, meaningfulJdSupplied: true },
      });

      expect(result.scoreStatus).toBe("score_pending");
      expect(result.cumulativeScore).toBeNull();
      // Content: 40, Visual: 0 earned (25 pending), Match: 20 -> confirmed earned = 60
      expect(result.confirmedEarnedPoints).toBe(60.0);
      expect(result.unresolvedMaximumPoints).toBe(25.0);
      expect(result.possibleScoreRange).toEqual([60.0, 85.0]);
      expect(result.pillars.visual.state).toBe("Pending");
    });

    it("TC07: Boundary all 0s produces 0.0/100", () => {
      const inputs = makeSyntheticInputs(0);
      const result = evaluateSuccessProV2({
        mode: "with_job_description",
        parameters: inputs,
        intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true },
      });

      expect(result.cumulativeScore).toBe(0.0);
      expect(result.confirmedEarnedPoints).toBe(0.0);
      expect(result.scoreStatus).toBe("completed");
    });

    it("TC08: Boundary all 5s produces 100.0/100", () => {
      const inputs = makeSyntheticInputs(5);
      const result = evaluateSuccessProV2({
        mode: "with_job_description",
        parameters: inputs,
        intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true },
      });

      expect(result.cumulativeScore).toBe(100.0);
      expect(result.confirmedEarnedPoints).toBe(100.0);
      expect(result.scoreStatus).toBe("completed");
    });

    it("extracts clean competencies from markdown bulleted JD without hash symbols or broken bigrams", () => {
      const jd = `### Key Competencies
- Creative Thinking
- Audience Engagement
- Brand Awareness
- Storytelling
- Adaptability
- Collaboration
- Attention to Detail`;
      const res = analyzeJobMatch({
        resumeText: "Experienced professional in storytelling, collaboration and adaptability across marketing campaigns and creative writing projects.",
        jobDescription: jd,
      });

      expect(res.missing).toContain("Creative Thinking");
      expect(res.missing).toContain("Audience Engagement");
      expect(res.missing).toContain("Brand Awareness");
      for (const skill of res.missing) {
        expect(skill).not.toMatch(/#/);
        expect(skill).not.toBe("Audiences ###");
        expect(skill).not.toBe("Articles Blog");
      }
    });
  });

  describe("B. Parameter Weights & Multipliers Verification", () => {
    it("Verifies With-JD base weights sum to exactly 100", () => {
      const contentSum = CONTENT_PARAMETER_IDS.reduce((sum, id) => sum + PARAMETER_REGISTRY[id].baseWeightWithJD, 0);
      const visualSum = VISUAL_PARAMETER_IDS.reduce((sum, id) => sum + PARAMETER_REGISTRY[id].baseWeightWithJD, 0);
      const jobMatchSum = JOB_MATCH_PARAMETER_IDS.reduce((sum, id) => sum + PARAMETER_REGISTRY[id].baseWeightWithJD, 0);

      expect(contentSum).toBe(PILLAR_MAX_WITH_JD.content); // 50
      expect(visualSum).toBe(PILLAR_MAX_WITH_JD.visual);   // 25
      expect(jobMatchSum).toBe(PILLAR_MAX_WITH_JD.jobMatch); // 25
      expect(contentSum + visualSum + jobMatchSum).toBe(100);
    });

    it("Verifies No-JD base weights sum to exactly 100 with 1.3x and 1.4x multipliers", () => {
      const contentSum = CONTENT_PARAMETER_IDS.reduce((sum, id) => sum + PARAMETER_REGISTRY[id].baseWeightNoJD, 0);
      const visualSum = VISUAL_PARAMETER_IDS.reduce((sum, id) => sum + PARAMETER_REGISTRY[id].baseWeightNoJD, 0);
      const jobMatchSum = JOB_MATCH_PARAMETER_IDS.reduce((sum, id) => sum + PARAMETER_REGISTRY[id].baseWeightNoJD, 0);

      expect(roundDisplay(contentSum, 1)).toBe(PILLAR_MAX_NO_JD.content); // 65.0
      expect(roundDisplay(visualSum, 1)).toBe(PILLAR_MAX_NO_JD.visual);   // 35.0
      expect(jobMatchSum).toBe(PILLAR_MAX_NO_JD.jobMatch); // 0
      expect(roundDisplay(contentSum + visualSum + jobMatchSum, 1)).toBe(100.0);
    });

    it("Rejects invalid ratings (negative, >5, decimal, NaN)", () => {
      const inputs = makeSyntheticInputs(4);
      inputs[0].rating = -1;
      expect(() => evaluateSuccessProV2({ mode: "with_job_description", parameters: inputs, intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true } })).toThrow(/Rating must be between 0 and 5/);

      inputs[0].rating = 6;
      expect(() => evaluateSuccessProV2({ mode: "with_job_description", parameters: inputs, intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true } })).toThrow(/Rating must be between 0 and 5/);

      inputs[0].rating = 3.5;
      expect(() => evaluateSuccessProV2({ mode: "with_job_description", parameters: inputs, intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true } })).toThrow(/Rating must be a valid integer/);

      inputs[0].rating = NaN;
      expect(() => evaluateSuccessProV2({ mode: "with_job_description", parameters: inputs, intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true } })).toThrow(/Rating must be a valid integer/);
    });
  });

  describe("C. N/A and Pending Interactions (Rule 05 & Rule 07)", () => {
    it("Verifies Pending parameter base weight stays in denominator during N/A redistribution", () => {
      // In Content (fixed max 50):
      // C05 (base 4) is N/A.
      // C08 (base 3) is Pending.
      // Remaining active base weights: 50 - 4 = 46 (C08's base weight 3 stays in the 46!).
      const inputs = makeSyntheticInputs(4);
      const c05 = inputs.find((p) => p.id === "C05")!;
      c05.status = "N/A";
      c05.rating = null;
      c05.naOrPendingReason = "No relevant qualification required or supplied.";

      const c08 = inputs.find((p) => p.id === "C08")!;
      c08.status = "Pending";
      c08.rating = null;

      const result = evaluateSuccessProV2({
        mode: "with_job_description",
        parameters: inputs,
        intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true },
      });

      const c02 = result.parameters.find((p) => p.id === "C02")!;
      const expectedC02EffectiveMax = (50 * 10) / 46;
      expect(c02.effectiveMaxWeight).toBeCloseTo(expectedC02EffectiveMax, 6);

      const c08Result = result.parameters.find((p) => p.id === "C08")!;
      const expectedC08EffectiveMax = (50 * 3) / 46;
      expect(c08Result.effectiveMaxWeight).toBeCloseTo(expectedC08EffectiveMax, 6);
      expect(c08Result.earnedPoints).toBe(0);

      // Pending max points in Content pillar reserves C08's effective max
      expect(result.pillars.content.pendingMaxPoints).toBeCloseTo(expectedC08EffectiveMax, 6);
      // Status must be score_pending
      expect(result.scoreStatus).toBe("score_pending");
      expect(result.cumulativeScore).toBeNull();
    });

    it("Verifies J04 N/A in Job Match redistributes weight within Job Match only", () => {
      // In Job Match (fixed max 25):
      // J04 (base 4) is N/A.
      // Active base weights in Job Match: 25 - 4 = 21.
      const inputs = makeSyntheticInputs(4);
      const j04 = inputs.find((p) => p.id === "J04")!;
      j04.status = "N/A";
      j04.rating = null;
      j04.naOrPendingReason = "No mandatory qualification in JD.";

      const result = evaluateSuccessProV2({
        mode: "with_job_description",
        parameters: inputs,
        intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true },
      });

      const j01 = result.parameters.find((p) => p.id === "J01")!;
      const expectedJ01EffectiveMax = (25 * 7) / 21; // 8.333333...
      expect(j01.effectiveMaxWeight).toBeCloseTo(expectedJ01EffectiveMax, 6);

      // Job Match pillar total remains 25.0
      expect(result.pillars.jobMatch.effectiveMaxTotal).toBeCloseTo(25.0, 6);
      // Content and Visual pillars remain 50 and 25
      expect(result.pillars.content.effectiveMaxTotal).toBeCloseTo(50.0, 6);
      expect(result.pillars.visual.effectiveMaxTotal).toBeCloseTo(25.0, 6);
    });
  });

  describe("D. Rule 17: Date Interval Union Algorithm", () => {
    it("Unions two identical concurrent 12-month roles into 12 calendar months (1 year), not 24", () => {
      const intervals = [
        { startYear: 2020, startMonth: 1, endYear: 2020, endMonth: 12 },
        { startYear: 2020, startMonth: 1, endYear: 2020, endMonth: 12 },
      ];
      expect(calculateTenureMonths(intervals)).toBe(12);
      expect(calculateTenureYears(intervals)).toBe(1.0);
    });

    it("Unions partially overlapping roles (Jan 2020 - Dec 2021 and Jan 2021 - Dec 2022) into 36 months (3 years), not 48", () => {
      const intervals = [
        { startYear: 2020, startMonth: 1, endYear: 2021, endMonth: 12 },
        { startYear: 2021, startMonth: 1, endYear: 2022, endMonth: 12 },
      ];
      expect(calculateTenureMonths(intervals)).toBe(36);
      expect(calculateTenureYears(intervals)).toBe(3.0);
    });

    it("Correctly computes non-overlapping roles", () => {
      const intervals = [
        { startYear: 2018, startMonth: 1, endYear: 2019, endMonth: 12 },
        { startYear: 2021, startMonth: 1, endYear: 2022, endMonth: 12 },
      ];
      expect(calculateTenureMonths(intervals)).toBe(48);
      expect(calculateTenureYears(intervals)).toBe(4.0);
    });
  });

  describe("E. Career Adaptations & Rule 04", () => {
    it("Verifies parameter weights remain identical across career stages", () => {
      // Rule 04: Parameter weights never change based on seniority
      const fresherGuide = CAREER_ADAPTATIONS["fresher"];
      const execGuide = CAREER_ADAPTATIONS["executive"];

      expect(fresherGuide).toBeDefined();
      expect(execGuide).toBeDefined();
      expect(fresherGuide.doNotRequireOrPenalize).toContain("No paid-employment");
      expect(execGuide.doNotRequireOrPenalize).toContain("Do not invent P&L");

      // Verify scoring engine evaluates fresher on standard weights
      const inputs = makeSyntheticInputs(5);
      const result = evaluateSuccessProV2({
        mode: "with_job_description",
        parameters: inputs,
        intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true },
        careerContext: "fresher",
      });

      expect(result.cumulativeScore).toBe(100.0);
      expect(result.pillars.content.fixedMaxPoints).toBe(50.0);
    });
  });

  describe("F. Free / Paid Scoring Parity (Rule 19 & Rule 21)", () => {
    it("Generates identical scores across tiers and produces structured Paid action plan", () => {
      const inputs = makeSyntheticInputs(3);
      // Add an issue to C02
      inputs.find((p) => p.id === "C02")!.issues = [
        { severity: "Major", message: "Tasks described without clear ownership or methods." },
      ];

      const result = evaluateSuccessProV2({
        mode: "with_job_description",
        parameters: inputs,
        intakeGates: { textReliable: true, visualDocumentAvailable: true, meaningfulJdSupplied: true },
      });

      expect(result.cumulativeScore).toBe(60.0);
      expect(result.paidReport).toBeDefined();
      expect(result.paidReport!.actionPlan.length).toBeGreaterThan(0);

      const c02Action = result.paidReport!.actionPlan.find((a) => a.parameterId === "C02");
      expect(c02Action).toBeDefined();
      expect(c02Action!.priority).toBe("P1");
      expect(c02Action!.conditionalPointRecovery).toBe(4.0); // 10 * (5 - 3) / 5 = 4.0
      // Phase4A: missing facts are clarification guidance, never leaked candidate prose.
      expect(c02Action!.rewriteTemplate).toBe("");
    });
  });

  describe("G. Rule 23 Descriptive Bands", () => {
    it("Correctly classifies scores into the 5 authoritative descriptive bands", () => {
      expect(getDescriptiveBand(35)).toBe("Substantial revision");
      expect(getDescriptiveBand(50)).toBe("Major improvement");
      expect(getDescriptiveBand(68)).toBe("Developing");
      expect(getDescriptiveBand(82)).toBe("Strong foundation");
      expect(getDescriptiveBand(95)).toBe("Strong presentation of evidence");
    });
  });
});
