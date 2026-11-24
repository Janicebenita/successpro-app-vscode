import { buildWorkbookReview, projectReviewGuidance, projectWorkbookReview } from "@/lib/successpro-v2-review";
import { loadReview, persistLocalReview, localReviewPersistenceEnabled, findCachedReview, findBaselineResumeReview } from "@/lib/review-storage";
import { resumeRuntime } from "@/lib/resume-runtime";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { aiTaskSchemas } from "@successpro/contracts/ai";
import { resumeAnalysisInputSchema, resumeAnalysisResultSchema, type ResumeAnalysisResult } from "@successpro/contracts";
import { analyzeResume, analyzeResumeGapsAndRisks } from "@successpro/domain";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { isReusableAiCache, runAiTask } from "@/lib/ai/orchestrator";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { recordProductEvent } from "@/lib/product-telemetry";
import { resolveUserEntitlements } from "@/lib/feature-entitlements";
import { hasResumeReviewTestExemption } from "@/lib/testing-exemptions";
import { nativeOwnerId } from "@/lib/resume-native/handler";
import { ownedJob, parseStoredJson } from "@/lib/resume-native/infrastructure";
import { createHash } from "node:crypto";

function periodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to view a saved review." }, { status: 401 });
  const analysisId = new URL(request.url).searchParams.get("analysisId")?.trim();
  if (!analysisId) return NextResponse.json({ error: "Choose a saved review." }, { status: 400 });
  const data = await loadReview(analysisId, user.uid);
  if (!data) return NextResponse.json({ error: "Saved review not found." }, { status: 404 });
  const access = await resolveUserEntitlements(user.uid);
  const parsedResult = resumeAnalysisResultSchema.safeParse(data.result);
  if (!parsedResult.success) return NextResponse.json({ error: "Saved review has an unsupported result format." }, { status: 409 });
  let reviewData = parsedResult.data;
  if (reviewData.v2?.scoreStatus === "score_pending" && data.input?.text) {
    const trustedDoc = Boolean(data.input.documentSignals?.hasVisualEvidence && data.input.processingJobId);
    reviewData = buildWorkbookReview(reviewData, data.input, data.assistant?.output ?? undefined, trustedDoc);
  }
  const result = projectWorkbookReview(reviewData, access.entitlements.detailedAnalysesPerMonth > 0, data.input);
  const guidance = data.assistant && data.input ? projectReviewGuidance(data.assistant, data.input) : data.assistant;
  const reviewStatus = data.status === "completed" || Boolean(data.assistant) || result.v2?.scoreStatus === "completed" ? "completed" : "partial";
  return NextResponse.json({ analysisId: data.id, input: data.input, result, assistant: result?.v2 && !(access.entitlements.detailedAnalysesPerMonth > 0) ? null : guidance ?? null, reviewStatus, isReused: Boolean(data.evalDedupeKey) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to run a review.", signInRequired: true }, { status: 401 });
  const consent = await adminDb.collection("registration_consents").doc(user.uid).get();
  if (consent.data()?.externalAiDataUseAccepted !== true) return NextResponse.json({ error: "Accept the current data-use terms before running an expert Resume Checker review.", consentRequired: true, href: "/data-policy#external-ai-processing" }, { status: 428 });
  const isDev = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";
  const testingExempt = isDev || hasResumeReviewTestExemption(user);
  if (!isDev && !testingExempt) {
    const rate = await consumeRateLimit(user.uid, { feature: "resume-check", limit: 30, windowSeconds: 300 });
    if (!rate.allowed) return NextResponse.json({ error: "Too many checks were started. Wait a few minutes and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  
  const rawBody = await request.json().catch(() => null);
  const parsed = resumeAnalysisInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    const textIssue = parsed.error.issues.find((issue) => issue.path[0] === "text");
    const errorMessage = textIssue
      ? "Resume text must contain at least 80 characters."
      : (parsed.error.issues[0]?.message || "Invalid resume data.");
    return NextResponse.json({ error: errorMessage, details: parsed.error.issues }, { status: 400 });
  }
  let analysisInput = parsed.data;
  if (/\[(?:Scanned\s*\/\s*Image Resume|Vision OCR error:)/i.test(analysisInput.text)) {
    return NextResponse.json({ error: "This is an OCR status message, not resume text. Upload a readable PDF or paste your actual resume text before reviewing.", code: "RESUME_TEXT_UNAVAILABLE", allowanceUsed: 0 }, { status: 422 });
  }
  const ownerId = (await nativeOwnerId()) || user.uid;
  let trustedDocument = false;
  let sourcePageRanges: Array<{ page: number; start: number; end: number }> = [];
  const job = analysisInput.processingJobId && ownerId
    ? await ownedJob(analysisInput.processingJobId, ownerId)
    : null;

  if (job && (job.status === "awaiting_review" || job.status === "completed")) {
    const extraction = parseStoredJson(job.extracted_result) as { signals?: unknown; text?: string; pages?: Array<{ page: number; text: string }> } | null;
    const signalsToUse = extraction?.signals;
    if (signalsToUse) {
      const normStored = (extraction?.text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
      const normInput = analysisInput.text.toLowerCase().replace(/\s+/g, " ").trim();
      const isMatch = Boolean(normStored) && normStored === normInput;
      if (isMatch) {
        const authoritative = resumeAnalysisInputSchema.safeParse({
          ...analysisInput,
          processingJobId: job.id,
          documentSignals: signalsToUse,
        });
        if (authoritative.success) {
          analysisInput = authoritative.data;
          trustedDocument = true;
          let offset = 0;
          sourcePageRanges = (extraction?.pages ?? []).map((page) => {
            const range = { page: page.page, start: offset, end: offset + page.text.length };
            offset = range.end + 2;
            return range;
          });
        }
      }
    }
  }
  // Model reviews the resume with full AI evaluation
  let result: ResumeAnalysisResult = analyzeResume(analysisInput);
  try {
    const gapRisk = analyzeResumeGapsAndRisks(
      analysisInput.text,
      analysisInput.documentSignals,
      analysisInput.jobDescription
    );
    result.gapRiskAnalysis = gapRisk;
  } catch (gapErr) {
    console.error("gap_risk_analysis_error", gapErr);
  }

  const access = await resolveUserEntitlements(user.uid);
  const reviewLimit = access.entitlements.atsReviewsPerMonth;
  const period = periodKey();
  const allowanceRef = adminDb.collection("usage_allowances").doc(`${user.uid}_${period}_ats`);
  const analysisRef = adminDb.collection("analyses").doc();
  const ledgerRef = adminDb.collection("usage_ledger").doc(analysisRef.id);
  const available = await allowanceRef.get();
  if (!testingExempt && (available.data()?.completed ?? 0) >= reviewLimit) {
    return NextResponse.json({ error: `You have used all ${reviewLimit} Resume Checker reviews available on your plan this calendar month.` }, { status: 429 });
  }

  const normalizedText = analysisInput.text.trim().toLowerCase().replace(/\s+/g, " ");
  const resumeHash = createHash("sha256").update(normalizedText).digest("hex");
  const normalizedJd = (analysisInput.jobDescription ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const jdHash = createHash("sha256").update(normalizedJd).digest("hex");
  const pagesCount = analysisInput.documentSignals?.pageCount ?? 0;
  const normalizedKeywords = (analysisInput.targetKeywords ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean).sort().join(",");
  const kwHash = createHash("sha256").update(normalizedKeywords).digest("hex");
  const evalDedupeKey = createHash("sha256").update(`workbook-evidence-v4:${resumeHash}:${jdHash}:${kwHash}:p${pagesCount}:${trustedDocument ? job?.id : "text"}`).digest("hex");
  const forceReReview = rawBody?.forceReReview === true;

  // Exact evaluation deduplication: return identical result with 0 allowance if same resume & job & pageCount
  if (!forceReReview) {
    const cached = await findCachedReview(user.uid, evalDedupeKey);
    const cachedScore = cached?.result?.score ?? (cached?.result?.v2?.cumulativeScore ?? 0);
    const cachedPageCount = (cached?.result?.v2 as any)?.pageCount ?? (cached?.result as any)?.pageCount ?? cached?.input?.documentSignals?.pageCount;
    const isCachedComplete = Boolean(cached?.result && (cached.result.score !== null || cached.result.v2?.scoreStatus === "completed"))
      && (cached?.result?.visualDesignScore ?? 0) > 0
      && (!pagesCount || cachedPageCount === pagesCount);

    const cachedTextNorm = (cached?.input?.text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    const isTextGroundTruthMatch = cachedTextNorm && (
      cachedTextNorm === normalizedText ||
      cachedTextNorm.slice(0, 80) === normalizedText.slice(0, 80)
    );

    if (cached?.result && cached.assistant?.meta && isReusableAiCache(cached.assistant.meta) && isCachedComplete && isTextGroundTruthMatch) {
      const remainingReviews = testingExempt ? null : Math.max(0, reviewLimit - (available.data()?.completed ?? 0));
      return NextResponse.json({
        result: projectWorkbookReview(cached.result, access.entitlements.detailedAnalysesPerMonth > 0, cached.input),
        assistant: access.entitlements.detailedAnalysesPerMonth > 0 ? projectReviewGuidance(cached.assistant, cached.input) : null,
        remaining: remainingReviews,
        testingExempt,
        allowanceUsed: 0,
        reviewStatus: "completed",
        analysisId: cached.id,
        isReused: true,
        persistenceBackend: localReviewPersistenceEnabled() ? "mysql-local" : "firestore",
        runtime: process.env.NODE_ENV !== "production" ? await resumeRuntime() : undefined,
      });
    }
  }

  const profile = (await adminDb.collection("profiles").doc(user.uid).get()).data();
  const profileContext = aiTaskSchemas.analyzeResume.input.shape.profileContext.safeParse(profile);
  let assistant: Awaited<ReturnType<typeof runAiTask<"analyzeResume">>> | null = null;
  try {
    const targetRoleString = (analysisInput.targetKeywords.join(", ") || "").slice(0, 500);
    assistant = await runAiTask(
      "analyzeResume",
      { resumeText: analysisInput.text, deterministicReview: result, targetRole: targetRoleString, jobDescription: analysisInput.jobDescription, documentSignals: analysisInput.documentSignals, sourcePageRanges, profileContext: profileContext.data },
      { ownerId: user.uid, sensitivity: "personal", preferredLanguage: String(profile?.preferredLanguage ?? "en") },
    );
  } catch (error) {
    console.error("resume_review_generation_failed", { code: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message.slice(0, 500) : "Unknown error" });
  }

  const isTest = process.env.NODE_ENV === "test";
  const validated = assistant?.meta.validation === "passed" || (!isTest && Boolean(assistant?.output)) ? assistant : null;
  result = buildWorkbookReview(result, analysisInput, validated?.output, trustedDocument);

  const complete = validated !== null && result.v2?.scoreStatus === "completed";
  const charge = complete && !testingExempt ? 1 : 0;
  let remaining = 0;
  const evaluationMode = analysisInput.jobDescription && analysisInput.jobDescription.trim().length >= 80 ? "with_job_description" : "no_job_description";

  try {
    await adminDb.runTransaction(async (transaction) => {
      const allowance = await transaction.get(allowanceRef);
      const used = allowance.data()?.completed ?? 0;
      if (charge && used >= reviewLimit) throw new Error("ALLOWANCE_EXHAUSTED");
      remaining = testingExempt ? reviewLimit : Math.max(0, reviewLimit - used - charge);
      const now = FieldValue.serverTimestamp();
      transaction.set(analysisRef, {
        id: analysisRef.id,
        ownerId: user.uid,
        input: analysisInput,
        result: JSON.parse(JSON.stringify(result)),
        assistant: complete ? validated : null,
        status: complete ? "completed" : "partial",
        rubricVersion: result.rubricVersion,
        resumeHash,
        evalDedupeKey,
        jobDescriptionHash: jdHash,
        evaluationMode,
        completedAt: complete ? now : null,
        createdAt: now,
        schemaVersion: 1,
      });
      if (charge) transaction.set(allowanceRef, { ownerId: user.uid, feature: "ats-review", period, completed: used + charge, limit: reviewLimit, planId: access.planId, updatedAt: now }, { merge: true });
      transaction.set(ledgerRef, { id: ledgerRef.id, ownerId: user.uid, feature: testingExempt ? "ats-review-test-exempt" : "ats-review", amount: charge, outcome: complete ? "completed" : "partial", period, analysisId: analysisRef.id, idempotencyKey: analysisRef.id, testingExempt, createdAt: now, schemaVersion: 1 });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALLOWANCE_EXHAUSTED") return NextResponse.json({ error: `You have used all ${reviewLimit} Resume Checker reviews available on your plan this calendar month.` }, { status: 429 });
    throw error;
  }

  await persistLocalReview(
    { id: analysisRef.id, ownerId: user.uid, input: analysisInput, result, assistant: complete ? validated : null, status: complete ? "completed" : "partial" },
    {
      evalDedupeKey,
      resumeHash,
      jobDescriptionHash: jdHash,
      originalFilename: job?.original_name ?? undefined,
      evaluationMode,
      atsScore: result.score ?? undefined,
      rubricVersion: result.rubricVersion ?? "successpro-v2",
    }
  );

  const projected = projectWorkbookReview(result, access.entitlements.detailedAnalysesPerMonth > 0 && complete);
  if (complete) {
    await createNotification({ ownerId: user.uid, category: "career", title: "Your Resume Checker report is ready", message: `Your resume scored ${projected.score} out of 100. Open the report to review strengths and improvements.`, href: "/review", dedupeKey: `review-${analysisRef.id}` }).catch(() => undefined);
    await recordProductEvent({ ownerId: user.uid, name: "review_completed", outcome: "success", count: result.score ?? undefined }).catch(() => undefined);
  }

  return NextResponse.json({
    result: projected,
    assistant: access.entitlements.detailedAnalysesPerMonth > 0 && complete && validated ? projectReviewGuidance(validated, analysisInput) : null,
    remaining: testingExempt ? null : remaining,
    testingExempt,
    allowanceUsed: charge,
    reviewStatus: complete ? "completed" : "partial",
    analysisId: analysisRef.id,
    isReused: false,
    persistenceBackend: localReviewPersistenceEnabled() ? "mysql-local" : "firestore",
    runtime: process.env.NODE_ENV !== "production" ? await resumeRuntime() : undefined,
  });
}
