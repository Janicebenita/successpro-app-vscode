import {visualCodeMapping} from "./visual-code-mapping";
import type { ResumeAnalysisResult, ResumeAnalysisInput } from "@successpro/contracts";
import { resumeAnalysisResultSchema, v2AssessmentSchema, v2RequirementSchema } from "@successpro/contracts";
import type { AiTaskOutput } from "@successpro/contracts/ai";
import { evaluateSuccessProV2, generatePaidReport, analyzeResumeGapsAndRisks, validateGroundedRewrite, CONTENT_PARAMETER_IDS, VISUAL_PARAMETER_IDS, JOB_MATCH_PARAMETER_IDS, getDescriptiveBand, getRatingAnchor } from "@successpro/domain";
import type { ParameterEvaluationInput } from "@successpro/domain";
import { chronologyRatingConflict, employmentDiagnostics } from "@successpro/domain";
import { cleanJobRequirementText, isResumeEvidenceHeading, repeatsVisualAnchor, validateSourceEvidence, numericalClaims } from "@successpro/domain";
import { consistentSeverity, severityConflict, severityForRating } from "@successpro/domain";

const workbookSha256 = "8a6794c75e8e323e0fa06678b1c3096cfeec17c32f084a046fa84143a52bea97";
// Provenance: Scoring Rules C16,C19:C20; Technical & Exceptions A7:D7.
export function buildWorkbookReview(base: ResumeAnalysisResult, input: ResumeAnalysisInput, assessment: AiTaskOutput<"analyzeResume"> | undefined, trustedDocument: boolean): ResumeAnalysisResult {
  const parameters: ParameterEvaluationInput[] = [];
  const text = input.text;
  const jd = cleanJobRequirementText(input.jobDescription ?? "");
  const signals = input.documentSignals;
  const dateAudit = employmentDiagnostics(text);
  const assessments = assessment?.workbookAssessments ?? [];
  for (const id of CONTENT_PARAMETER_IDS) {
    const candidates = assessments.filter((row) => row.id === id);
    if (candidates.length > 1) {
      parameters.push({ id, status: "Pending", rating: null, naOrPendingReason: "Duplicate parameter assessment rejected." });
      continue;
    }
    const parsed = v2AssessmentSchema.safeParse(candidates.length === 1 ? candidates[0] : null);
    if (!parsed.success) {
      if (!assessment) continue;
      // Accuracy: never invent a rating or quote the resume's first line as "evidence".
      // An unusable model row keeps its points reserved as Pending.
      parameters.push({ id, status: "Pending", rating: null, naOrPendingReason: "The content assessment for this criterion was missing or invalid; it needs a fresh assessment." });
      continue;
    }
    const row = parsed.data;
    if (row.status === "N/A" && id !== "C05" && id !== "C08") continue;
    if (row.status !== "Assessed") {
      parameters.push({ ...row, rating: null });
      continue;
    }

    if (row.evidence) {
      if (row.evidence.excerpt === "Fabricated") {
        parameters.push({ ...row, status: "Pending", rating: null, naOrPendingReason: "Fabricated excerpt rejected." });
        continue;
      }
      if (isResumeEvidenceHeading(row.evidence.excerpt)) {
        parameters.push({ ...row, status: "Pending", rating: null, naOrPendingReason: "Excerpt is heading-only." });
        continue;
      }
      if (row.rating !== 0) {
        if (!text.includes(row.evidence.excerpt)) {
          const normText = text.replace(/\s+/g, " ").toLowerCase();
          const normExcerpt = row.evidence.excerpt.replace(/\s+/g, " ").toLowerCase();
          const idx = normText.indexOf(normExcerpt);
          if (idx !== -1) {
            row.evidence.excerpt = text.slice(idx, idx + row.evidence.excerpt.length);
          } else {
            // The quoted evidence does not exist in the resume. Matching any shared word
            // previously attached unrelated lines to the rating.
            parameters.push({ id, status: "Pending", rating: null, naOrPendingReason: "Quoted evidence was not found in the resume text." });
            continue;
          }
        }
        const claims = numericalClaims(row.evidence.rationale);
        const quotes = [row.evidence.excerpt, ...(row.evidence.additionalExcerpts ?? []).map(q => q.excerpt)];
        const linked = new Set(quotes.flatMap(q => text.includes(q) ? numericalClaims(q) : []));
        for (const claim of claims) {
          if (!linked.has(claim)) {
            const esc = claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            row.evidence.rationale = row.evidence.rationale.replace(new RegExp(`\\b${esc}\\b`, "gi"), "verified");
          }
        }
      }
    }

    if (row.rating == null || (row.confidence ?? 1) < 0.75) {
      parameters.push({ id, status: "Pending", rating: null, naOrPendingReason: "The assessment confidence was too low to publish a rating." });
      continue;
    }
    if (validateSourceEvidence(row.evidence, text, { rating: row.rating }).length) {
      parameters.push({ id, status: "Pending", rating: null, naOrPendingReason: "The supporting evidence could not be verified against the resume." });
      continue;
    }
    const issues = row.issues ?? [];
    const conflict = (id === "C08" && chronologyRatingConflict(text, row.rating)) || severityConflict(row.rating, issues);
    if (conflict) {
      parameters.push({ id, status: "Pending", rating: null, naOrPendingReason: conflict });
      continue;
    }
    parameters.push({ ...row, issues: consistentSeverity(row.rating, issues) });
  }

  const rawRequirements = assessment?.jdRequirements ? [...assessment.jdRequirements] : [];
  // No synthetic job requirements: invented rows rated 4 made job match look assessed when it was not.

  for (const req of rawRequirements) {
    if (req.sourceText && !jd.includes(req.sourceText)) {
      const cleanReq = req.sourceText.replace(/^[-*•#\s\d.]+/, "").trim();
      const matchLine = jd.split(/\r?\n/).find(l => l.includes(cleanReq) || (cleanReq.length >= 10 && l.trim().includes(cleanReq)));
      if (matchLine) {
        req.sourceText = matchLine.trim();
      }
    }
    // Requirement evidence that is not in the resume stays unverified; the J-criterion check marks it Pending.
  }

  const requirementsValid = Boolean(jd && (assessment?.meaningfulJd === true || rawRequirements.length > 0))
    && rawRequirements.every((row) => v2RequirementSchema.safeParse(row).success && jd.includes(row.sourceText))
    && new Set(rawRequirements.map((row) => row.id)).size === rawRequirements.length
    && new Set(rawRequirements.map((row) => row.sourceText.trim().replace(/\s+/g, " ").toLowerCase())).size === rawRequirements.length;
  const requirements = requirementsValid ? rawRequirements : [];
  for (const id of JOB_MATCH_PARAMETER_IDS) {
    if (!requirementsValid) continue;
    const owned = requirements.filter((row) => row.owner === id);
    if (!owned.length) {
      const rows = assessments.filter((row) => row.id === id && row.status === "N/A" && row.naOrPendingReason?.trim());
      if (rows.length === 1) parameters.push({ ...rows[0], rating: null });
      else parameters.push({ id, status: "N/A", rating: null, naOrPendingReason: "No owned explicit requirements in JD" });
      continue;
    }
    const verified = owned.every((row) => row.status === "Assessed" && row.rating != null
      && (row.confidence ?? 1) >= 0.75 && !validateSourceEvidence(row.evidence, text, { rating: row.rating }).length
      && (row.rating === 0 || text.includes(row.evidence.excerpt)));
    if (!verified) {
      parameters.push({ id, status: "Pending", rating: null, naOrPendingReason: "One or more job requirements still need verifiable evidence." });
      continue;
    }
    const rating = Math.floor(owned.reduce((sum, row) => sum + row.rating!, 0) / owned.length + 0.5);
    const severity = severityForRating(rating);
    parameters.push({
      id,
      status: "Assessed",
      rating,
      evidence: {
        excerpt: owned.map((row) => row.evidence.excerpt).filter(Boolean).join(" | "),
        location: "Linked candidate evidence and exact job requirements",
        rationale: "Equal average of the validated requirements owned by this criterion, rounded to the nearest integer.",
        absenceSearch: rating === 0 && owned.every((row) => row.evidence.absenceSearch?.outcome === "not_found")
          ? { scope: "Candidate resume", searchedFor: owned.map((row) => row.sourceText).join(" / "), outcome: "not_found" }
          : undefined,
      },
      issues: !severity ? [] : owned.filter((row) => row.rating! < 5).map((row) => ({
        severity: row.mandatory && row.confirmedBlocker ? "Critical" as const : severity,
        message: row.sourceText + (row.mandatory && row.confirmedBlocker ? ": confirmed unmet condition" : ": evidence gap; confirm the requirement against the candidate's evidence"),
        isMandatoryGap: row.mandatory,
        confirmedBlocker: row.mandatory && row.confirmedBlocker,
      })),
    });
  }

  const pages = signals?.geminiPageFindings ?? [];
  const count = signals?.pageCount ?? 0;
  const renderedAvailable = trustedDocument && signals?.hasVisualEvidence === true && count > 0;
  const visualAvailable = renderedAvailable && pages.length === count && new Set(pages.map((page) => page.page)).size === count
    && pages.every((page) => Number.isInteger(page.page) && page.page >= 1 && page.page <= count && (page.confidence ?? 0) >= 0.65);

  for (const id of VISUAL_PARAMETER_IDS) {
    if (!visualAvailable) {
      if (renderedAvailable) {
        parameters.push({ id, status: "Pending", rating: null, naOrPendingReason: "Document rendered successfully. Verified Gemini Vision findings are still needed for every page." });
      }
      continue;
    }
    const matches = signals?.geminiVisualCriteria?.filter((row) => row.code === id) ?? [];
    const row = matches.length === 1 ? matches[0] : undefined;
    if (!row || !Number.isInteger(row.rating) || row.confidence < 0.75
      || !row.pages.length || row.pages.some((page) => page < 1 || page > count)
      || row.anchorText !== getRatingAnchor(id, row.rating)
      || repeatsVisualAnchor(row.evidence, row.anchorText)
      || repeatsVisualAnchor(row.anchorJustification ?? "", row.anchorText)
      || !row.anchorJustification?.trim() || !row.nextAnchorGap?.trim()
      || validateSourceEvidence({ excerpt: row.evidence, rationale: row.anchorJustification }, text, { rendered: true, rating: row.rating }).length
      || !row.recommendation.trim()) continue;
    if (id === "V03" && signals?.textCollision && row.rating >= 4) {
      parameters.push({ id, status: "Pending", rating: null, naOrPendingReason: "Rendered-page rating conflicts with a measured text overlap; check the affected page." });
      continue;
    }
    const severity = severityForRating(row.rating);
    parameters.push({
      id,
      status: "Assessed",
      rating: row.rating,
      evidence: {
        excerpt: row.evidence,
        location: "Rendered pages " + row.pages.join(", "),
        rationale: row.anchorJustification,
      },
      anchorComparison: {
        anchor: row.anchorText,
        justification: row.anchorJustification,
        nextAnchorGap: row.nextAnchorGap,
        informationState: "present",
      },
      issues: severity ? [{ severity, message: row.recommendation }] : [],
    });
  }

  const textReliable = signals?.extractionReliable !== false && !/\[(?:Vision OCR error|Scanned.*Image Resume)/i.test(text) && text.trim().length >= 80;
  const evaluated = evaluateSuccessProV2({
    mode: jd ? "with_job_description" : "no_job_description",
    parameters,
    intakeGates: {
      textReliable,
      visualDocumentAvailable: renderedAvailable,
      meaningfulJdSupplied: !!jd && assessment?.meaningfulJd !== false
    }
  });
  if (!assessment) evaluated.operationalWarnings.push("The expert content assessment is pending. This report includes the document checks available so far.");
  if (!visualAvailable && trustedDocument && signals?.hasVisualEvidence) evaluated.operationalWarnings.push("Rendered pages are available, but the workbook visual inspection is incomplete.");
  if (trustedDocument && signals?.hasVisualEvidence && signals.textCollision) evaluated.operationalWarnings.push("The rendered document has a measured text overlap. Inspect the affected page and correct the collision.");
  const legacyCodes=signals?.geminiVisualCriteria?.filter(r=>visualCodeMapping(r.code).requiresReassessment).map(r=>r.code) ?? [];
  if(legacyCodes.length)evaluated.operationalWarnings.push("Legacy or unknown visual criteria require original-page reassessment: "+legacyCodes.join(", "));
  const v2 = {...evaluated,workbookSha256,requirements,employmentDateValidation:dateAudit};
  if(dateAudit.findings.length) {
    evaluated.operationalWarnings.push(...dateAudit.findings.filter(f => f.kind !== "gap").map(f => `${f.roles.join(" / ")}: ${f.message}`));
  }
  if(signals?.designWarnings?.some(w=>/reading_order|column_order/.test(w)))evaluated.operationalWarnings.push("Possible ATS reading-order issue: compare the extracted name, title, contacts and role/date associations with the original pages. Column detection alone does not verify reading order.");
  if(signals?.designWarnings?.includes("possible_concatenated_name_or_spacing"))evaluated.operationalWarnings.push("Possible joined name or malformed spacing in extraction; confirm against the original document.");
  const percent = (p:typeof v2.pillars.content) => p.fixedMaxPoints ? Math.round(p.confirmedEarned/p.fixedMaxPoints*100) : 0;
  return resumeAnalysisResultSchema.parse({...base,rubricVersion:"successpro-v2",v2,score:v2.cumulativeScore,rawScore:v2.cumulativeScore,
   gapRiskAnalysis: base.gapRiskAnalysis,
   completed:v2.scoreStatus === "completed",provisional:v2.scoreStatus !== "completed",evaluationCoverage:Math.round(100-v2.unresolvedMaximumPoints),
   contentQualityScore:percent(v2.pillars.content),visualDesignScore:v2.pillars.visual.state === "Assessed" ? percent(v2.pillars.visual) : null,
   visualDesignStatus:v2.pillars.visual.state === "Assessed" ? "evaluated" : v2.pillars.visual.state === "Partial" ? "partial" : "not_evaluated",
   jobMatchScore:v2.pillars.jobMatch.state === "Assessed" ? percent(v2.pillars.jobMatch) : null,jobMatchStatus:!jd ? "job_description_required" : v2.pillars.jobMatch.state === "Assessed" ? "completed" : "insufficient_content",
   jobMatchMethod:jd && v2.pillars.jobMatch.state === "Assessed" ? "gemini_semantic" : "not_evaluated",
   contentContribution:v2.pillars.content.confirmedEarned,visualContribution:v2.pillars.visual.confirmedEarned,jobMatchContribution:v2.pillars.jobMatch.confirmedEarned,
   factors:[],criteriaFindings:[],scoreSources:{atsReadiness:"Separate technical diagnostic",contentQuality:"Workbook C01–C09",visualDesign:"Workbook V01–V06: rendered pages and OpenCV",jobMatch:"Workbook J01–J05: owned JD requirements"},
   disclaimer:"SuccessPro V2 assesses resume evidence using the workbook rubric. It is not a hiring prediction or a universal ATS simulation. Pending allocations remain reserved."});
}

type PresentedResult = ResumeAnalysisResult & { _presentationAdjusted?: boolean };
type V2Result = NonNullable<ResumeAnalysisResult["v2"]>;

// Internal score bookkeeping never leaves the server. The stored record keeps the raw values.
function withoutInternalScoreFields(result: ResumeAnalysisResult): ResumeAnalysisResult {
  const { rawScore: _rawScore, ...rest } = result;
  if (!rest.v2) return rest;
  const {
    originalScore: _originalScore,
    originalConfirmedEarned: _originalConfirmedEarned,
    scoreReductionAmount: _scoreReductionAmount,
    scoreReductionFactor: _scoreReductionFactor,
    scoreAdjustmentStatus: _scoreAdjustmentStatus,
    ...v2
  } = rest.v2;
  const pillar = ({ originalConfirmedEarned: _original, ...value }: V2Result["pillars"]["content"]) => value;
  return {
    ...rest,
    v2: {
      ...v2,
      pillars: { content: pillar(v2.pillars.content), visual: pillar(v2.pillars.visual), jobMatch: pillar(v2.pillars.jobMatch) },
      parameters: v2.parameters.map(({ originalEarnedPoints: _original, ...row }) => row),
    },
  };
}

export function projectReviewGuidance<T extends { output: AiTaskOutput<"analyzeResume"> }>(guidance: T, input: ResumeAnalysisInput): T {
  const topActions = guidance.output.topActions.map((item) => {
    const excerpt = item.originalExcerpt.trim();
    const grounded = excerpt && input.text.includes(excerpt) && !isResumeEvidenceHeading(excerpt);
    const improvedExample = grounded && item.improvedExample
      && validateGroundedRewrite(item.improvedExample, excerpt, excerpt).length === 0
      ? item.improvedExample : undefined;
    const mentionVerifiedUse = input.jobDescription && /^(?:add|integrate|include|highlight|list|showcase)\b/i.test(item.suggestion)
      && /\b(?:tool|tools|proficien\w*|software|skills?)\b/i.test(item.suggestion)
      && !/\b(?:if|only|verify|verified|genuine|actually)\b/i.test(item.suggestion);
    const suggestion = mentionVerifiedUse ? "If you have hands-on experience, " + item.suggestion[0].toLowerCase() + item.suggestion.slice(1) : item.suggestion;
    return { ...item, originalExcerpt: grounded ? item.originalExcerpt : "", improvedExample, suggestion };
  });
  return { ...guidance, output: { ...guidance.output, topActions } };
}

export function projectWorkbookReview(result: ResumeAnalysisResult, paid: boolean, input?: ResumeAnalysisInput): ResumeAnalysisResult {
  if (input?.text) {
    result = { ...result, gapRiskAnalysis: analyzeResumeGapsAndRisks(input.text, input.documentSignals, input.jobDescription) };
  }
  const deduct = (score: number | null | undefined) => typeof score === "number" && Number.isFinite(score)
    ? Math.max(0, Math.round((score - 20) * 10) / 10)
    : null;

  const v2 = result.v2 ? { ...result.v2 } : undefined;
  if (v2?.paidReport) {
    if (!paid) delete v2.paidReport;
    else {
      v2.paidReport = generatePaidReport(v2.parameters);
      if (input?.text) {
        for (const action of v2.paidReport.actionPlan) {
          if (action.originalLine && !input.text.includes(action.originalLine)) delete action.originalLine;
        }
      }
    }
  }

  // Already presented: a result produced by this function (it carries no rawScore), including after
  // JSON serialization, or a record from the earlier presentation format. Never adjust twice.
  const alreadyPresented = (result as PresentedResult)._presentationAdjusted
    || Boolean(v2?.scoreAdjustmentStatus)
    || (v2 !== undefined && !Object.prototype.hasOwnProperty.call(result, "rawScore"));
  if (alreadyPresented) return withoutInternalScoreFields(v2 ? { ...result, v2 } : result);

  if (!v2) {
    const projected = { ...result, score: deduct(result.score) };
    Object.defineProperty(projected, "_presentationAdjusted", { value: true });
    return projected;
  }

  // Interim reports keep their confirmed raw values. The adjustment applies only to a publishable final score.
  if (v2.scoreStatus !== "completed" || v2.cumulativeScore === null) {
    return withoutInternalScoreFields({ ...result, v2 });
  }

  const originalScore = v2.cumulativeScore;
  const originalTotal = originalScore;
  const adjustedTotal = deduct(originalTotal) ?? 0;
  const factor = originalTotal > 20 ? (originalTotal - 20) / originalTotal : 0;

  // Allocate rounding tenths to the largest fractional remainders in workbook order.
  const allocations = v2.parameters.map(({ earnedPoints }, index) => {
    const exact = earnedPoints * factor * 10;
    const tenths = Math.floor(exact);
    return { index, tenths, remainder: exact - tenths };
  });
  const remainingTenths = Math.round(adjustedTotal * 10) - allocations.reduce((sum, row) => sum + row.tenths, 0);
  const candidates = allocations.filter((row) => row.remainder > 0)
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const row of candidates.slice(0, Math.max(0, remainingTenths))) row.tenths += 1;

  const pillarTenths = { content: 0, visual: 0, jobMatch: 0 };
  const parameters = v2.parameters.map((row, index) => {
    const { tenths } = allocations[index];
    pillarTenths[row.pillar] += tenths;
    return { ...row, earnedPoints: tenths / 10 };
  });
  const projectPillar = (pillar: keyof typeof pillarTenths) => ({
    ...v2.pillars[pillar],
    confirmedEarned: pillarTenths[pillar] / 10,
  });
  const cumulativeScore = deduct(originalScore);

  return withoutInternalScoreFields({
    ...result,
    score: deduct(result.score),
    contentContribution: pillarTenths.content / 10,
    visualContribution: pillarTenths.visual / 10,
    jobMatchContribution: pillarTenths.jobMatch / 10,
    v2: {
      ...v2,
      cumulativeScore,
      confirmedEarnedPoints: adjustedTotal,
      possibleScoreRange: [deduct(v2.possibleScoreRange[0]) ?? 0, deduct(v2.possibleScoreRange[1]) ?? 0],
      descriptiveBand: cumulativeScore === null ? v2.descriptiveBand : getDescriptiveBand(cumulativeScore),
      displayFootnote: undefined,
      pillars: { content: projectPillar("content"), visual: projectPillar("visual"), jobMatch: projectPillar("jobMatch") },
      parameters,
    },
  });
}
