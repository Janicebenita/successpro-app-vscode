import type {
  EvaluateResumeV2Input,
  ParameterEvaluationResult,
  ParameterId,
  PillarId,
  PillarScoreResult,
  ScorePublicationStatus,
  SuccessProV2Result,
} from "./types";
import { ALL_PARAMETER_IDS, PARAMETER_REGISTRY } from "./parameter-registry";
import { getPillarMaximum } from "./scoring-config";
import { checkRowRoundingDiscrepancy, getDescriptiveBand, roundDisplay } from "./rounding";
import { validateParameterEvidence } from "./evidence-validation";
import { generatePaidReport } from "./paid-enhancer";

/**
 * Validates integer rating (0, 1, 2, 3, 4, 5).
 * Rejects decimals, NaN, Infinity, negative, >5.
 */
function validateRating(rating: unknown): number {
  if (typeof rating !== "number" || !Number.isInteger(rating) || Number.isNaN(rating) || !Number.isFinite(rating)) {
    throw new Error(`Rating must be a valid integer between 0 and 5. Received: ${rating}`);
  }
  if (rating < 0 || rating > 5) {
    throw new Error(`Rating must be between 0 and 5. Received: ${rating}`);
  }
  return rating;
}

/**
 * Authoritative SuccessPro v2 Scoring Engine
 * Strictly implements Rules 01–24 from the authoritative Excel workbook.
 */
export function evaluateSuccessProV2(input: EvaluateResumeV2Input): SuccessProV2Result {
  const mode = input.mode;
  const inputMap = new Map<ParameterId, (typeof input.parameters)[number]>();

  for (const p of input.parameters) {
    inputMap.set(p.id, p);
  }

  // Check intake gates
  const textReliable = input.intakeGates?.textReliable === true;
  const visualAvailable = input.intakeGates?.visualDocumentAvailable === true;

  const pillars: PillarId[] = ["content", "visual", "jobMatch"];
  const evaluatedParameters: ParameterEvaluationResult[] = [];
  const pillarResults: Record<PillarId, PillarScoreResult> = {
    content: { pillar: "content", fixedMaxPoints: 0, eligibleBaseWeights: 0, effectiveMaxTotal: 0, confirmedEarned: 0, pendingMaxPoints: 0, state: "Assessed" },
    visual: { pillar: "visual", fixedMaxPoints: 0, eligibleBaseWeights: 0, effectiveMaxTotal: 0, confirmedEarned: 0, pendingMaxPoints: 0, state: "Assessed" },
    jobMatch: { pillar: "jobMatch", fixedMaxPoints: 0, eligibleBaseWeights: 0, effectiveMaxTotal: 0, confirmedEarned: 0, pendingMaxPoints: 0, state: "Assessed" },
  };

  const mandatoryGaps: string[] = [];
  const operationalWarnings: string[] = [];

  if (!textReliable) {
    operationalWarnings.push("Document text extraction was unreliable or unreadable. Dependent scoring paused.");
  }
  if (!visualAvailable) {
    operationalWarnings.push("Rendered visual pages were not available. Visual presentation parameters held in Pending state.");
  }

  // Process each pillar independently
  for (const pillar of pillars) {
    const fixedPillarMax = getPillarMaximum(pillar, mode);
    const paramDefs = ALL_PARAMETER_IDS
      .map((id) => PARAMETER_REGISTRY[id])
      .filter((def) => def.pillar === pillar);

    // If pillar has 0 max points (e.g. Job Match in No-JD mode)
    if (fixedPillarMax === 0) {
      pillarResults[pillar] = {
        pillar,
        fixedMaxPoints: 0,
        eligibleBaseWeights: 0,
        effectiveMaxTotal: 0,
        confirmedEarned: 0,
        pendingMaxPoints: 0,
        state: "Excluded",
      };

      for (const def of paramDefs) {
        evaluatedParameters.push({
          id: def.id,
          pillar,
          name: def.name,
          status: "N/A",
          baseWeight: 0,
          effectiveMaxWeight: 0,
          rating: null,
          earnedPoints: 0,
          evidence: { excerpt: "", rationale: "Excluded: no job description provided." },
          issues: [],
          naOrPendingReason: "Excluded: no job description provided.",
        });
      }
      continue;
    }

    // Determine status of each parameter in this pillar
    const preparedParams = paramDefs.map((def) => {
      const userParam = inputMap.get(def.id);
      let status = userParam ? userParam.status : "Pending";
      let naOrPendingReason = userParam?.naOrPendingReason;

      // Force visual parameters to Pending if visual original document is unavailable (Rule 07, Sheet 11)
      if (pillar === "visual" && !visualAvailable) {
        status = "Pending";
        naOrPendingReason = "Rendered visual document unavailable; visual inspection pending.";
      }

      // If document text was unreadable, content parameters become Pending
      if ((pillar === "content" || pillar === "jobMatch") && !textReliable) {
        status = "Pending";
        naOrPendingReason = "Text extraction unreliable; content review pending.";
      }

      if (pillar === "jobMatch" && input.intakeGates?.meaningfulJdSupplied !== true) {
        status = "Pending";
        naOrPendingReason = "Meaningful job description required for Job Match.";
      }
      if (status === "N/A" && !naOrPendingReason?.trim()) {
        status = "Pending";
        naOrPendingReason = "Applicability reason required.";
      }
      if (status === "Assessed") {
        if (userParam?.rating == null) {
          status = "Pending";
          naOrPendingReason = "Rating not yet assessed.";
        } else {
          validateRating(userParam.rating);
          const evidenceIssues = validateParameterEvidence(def.id, userParam.rating, userParam.evidence);
          if (evidenceIssues.length) {
            status = "Pending";
            naOrPendingReason = evidenceIssues.map((issue) => issue.message).join(" ");
          }
        }
      }
      const baseWeight = mode === "with_job_description" ? def.baseWeightWithJD : def.baseWeightNoJD;
      return { def, userParam, status, naOrPendingReason, baseWeight };
    });

    // Rule 05: Sum of base weights of non-N/A parameters in this pillar.
    // CRITICAL: Pending parameters REMAIN in this denominator!
    const activeBaseSum = preparedParams
      .filter((p) => p.status !== "N/A")
      .reduce((sum, p) => sum + p.baseWeight, 0);

    let pillarEffectiveMaxTotal = 0;
    let pillarConfirmedEarned = 0;
    let pillarPendingMax = 0;
    let assessedCount = 0;
    let pendingCount = 0;

    for (const p of preparedParams) {
      let effectiveMax = 0;
      let earnedPoints = 0;
      let validRating: number | null = null;

      if (p.status === "N/A") {
        effectiveMax = 0;
        earnedPoints = 0;
      } else {
        // Rule 05 exact formula
        effectiveMax = activeBaseSum > 0 ? (fixedPillarMax * p.baseWeight) / activeBaseSum : 0;
        pillarEffectiveMaxTotal += effectiveMax;

        if (p.status === "Assessed") {
          validRating = validateRating(p.userParam?.rating);
          // Rule 03 exact formula
          earnedPoints = effectiveMax * (validRating / 5);
          pillarConfirmedEarned += earnedPoints;
          assessedCount++;
        } else if (p.status === "Pending") {
          earnedPoints = 0;
          pillarPendingMax += effectiveMax;
          pendingCount++;
        }
      }

      // Collect issues and mandatory gaps
      const issues = p.userParam?.issues || [];
      for (const issue of issues) {
        if (issue.isMandatoryGap || issue.severity === "Critical") {
          mandatoryGaps.push(`${p.def.id} (${p.def.name}): ${issue.message}`);
        }
      }

      evaluatedParameters.push({
        id: p.def.id,
        pillar,
        name: p.def.name,
        status: p.status,
        baseWeight: p.baseWeight,
        effectiveMaxWeight: effectiveMax,
        rating: validRating,
        earnedPoints,
        evidence: p.userParam?.evidence || { excerpt: "", rationale: "" },
        ...(p.status === "Assessed" && p.userParam?.anchorComparison ? { anchorComparison: p.userParam.anchorComparison } : {}),
        issues,
        naOrPendingReason: p.naOrPendingReason,
      });
    }

    // Determine pillar state
    const eligibleCount = assessedCount + pendingCount;
    let state: PillarScoreResult["state"] = "Assessed";
    if (eligibleCount === 0) {
      state = "Pending";
      pillarPendingMax = fixedPillarMax;
      operationalWarnings.push(`${pillar}: no eligible parameters; fixed allocation reserved pending applicability review.`);
    } else if (pendingCount === eligibleCount) {
      state = "Pending";
    } else if (pendingCount > 0) {
      state = "Partial";
    }

    pillarResults[pillar] = {
      pillar,
      fixedMaxPoints: fixedPillarMax,
      eligibleBaseWeights: activeBaseSum,
      effectiveMaxTotal: pillarEffectiveMaxTotal,
      confirmedEarned: pillarConfirmedEarned,
      pendingMaxPoints: pillarPendingMax,
      state,
    };
  }

  // Calculate Cumulative Metrics across all pillars (Rule 07, 08, 09)
  const confirmedEarnedPoints = Object.values(pillarResults).reduce((sum, p) => sum + p.confirmedEarned, 0);
  const unresolvedMaximumPoints = Object.values(pillarResults).reduce((sum, p) => sum + p.pendingMaxPoints, 0);
  const possibleScoreRange: [number, number] = [
    roundDisplay(confirmedEarnedPoints, 1),
    roundDisplay(confirmedEarnedPoints + unresolvedMaximumPoints, 1),
  ];

  // Determine Publication Status (Rule 08)
  let scoreStatus: ScorePublicationStatus = "completed";
  let cumulativeScore: number | null = roundDisplay(confirmedEarnedPoints, 1);

  if (!textReliable) {
    scoreStatus = "technical_pause";
    cumulativeScore = null;
  } else if (unresolvedMaximumPoints > 0) {
    scoreStatus = "score_pending";
    cumulativeScore = null; // Do not publish finalized score when items are pending
  }

  // Sort evaluated parameters to match authoritative order
  evaluatedParameters.sort((a, b) => ALL_PARAMETER_IDS.indexOf(a.id) - ALL_PARAMETER_IDS.indexOf(b.id));

  // Rounding discrepancy check (Rule 09)
  const allRowEarned = evaluatedParameters.map((p) => p.earnedPoints);
  const displayFootnote = checkRowRoundingDiscrepancy(confirmedEarnedPoints, allRowEarned, 1);

  // Descriptive Band (Rule 23)
  const descriptiveBand = cumulativeScore === null ? undefined : getDescriptiveBand(cumulativeScore);

  // Generate Paid Tier Report (Rule 19 & 21)
  const paidReport = generatePaidReport(evaluatedParameters);

  return {
    rubricVersion: "successpro-v2",
    mode,
    cumulativeScore,
    scoreStatus,
    confirmedEarnedPoints,
    unresolvedMaximumPoints,
    possibleScoreRange,
    descriptiveBand,
    displayFootnote,
    pillars: pillarResults,
    parameters: evaluatedParameters,
    mandatoryGaps,
    operationalWarnings,
    paidReport,
  };
}
