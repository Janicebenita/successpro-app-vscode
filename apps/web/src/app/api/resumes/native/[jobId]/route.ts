import { repeatsVisualAnchor } from "@successpro/domain";
import { NextResponse } from "next/server";
import { nativeOwnerId } from "@/lib/resume-native/handler";
import { ownedJob, parseStoredJson, requeueVisualInspection } from "@/lib/resume-native/infrastructure";

import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const ownerId = await nativeOwnerId();
  if (!ownerId) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  const { jobId } = await context.params;
  const job = await ownedJob(jobId, ownerId);
  if (!job) return NextResponse.json({ error: "Resume processing job not found." }, { status: 404 });
  return NextResponse.json({ id: job.id, status: job.status, attemptCount: job.attempt_count, extraction: parseStoredJson(job.extracted_result), analysis: parseStoredJson(job.ai_result), confirmed: parseStoredJson(job.confirmed_result), error: job.error_message, updatedAt: job.updated_at });
}


export async function POST(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const ownerId = await nativeOwnerId();
  if (!ownerId) return NextResponse.json({ error: "Sign in to retry the visual inspection." }, { status: 401 });
  const consent = await adminDb.collection("registration_consents").doc(ownerId).get();
  if (consent.data()?.externalAiDataUseAccepted !== true) {
    return NextResponse.json({ error: "Accept data-use terms before retrying the visual inspection." }, { status: 428 });
  }
  const { jobId } = await context.params;
  const job = await ownedJob(jobId, ownerId);
  if (!job) return NextResponse.json({ error: "Resume processing job not found." }, { status: 404 });
  if (job.status === "queued" || job.status === "processing") return NextResponse.json({ status: job.status }, { status: 202 });
  if (job.status !== "awaiting_review" && job.status !== "completed") {
    return NextResponse.json({ error: "The saved resume is unavailable for visual reinspection." }, { status: 409 });
  }
  const extraction = parseStoredJson(job.extracted_result) as { provider_metadata?: { validation?: string }; signals?: { geminiVisualCriteria?: Array<{ evidence: string; anchorText: string; anchorJustification: string }> } } | null;
  const echoedAnchor = extraction?.signals?.geminiVisualCriteria?.some((row) => (
    repeatsVisualAnchor(row.evidence ?? "", row.anchorText ?? "")
    || repeatsVisualAnchor(row.anchorJustification ?? "", row.anchorText ?? "")
  ));
  if (extraction?.provider_metadata?.validation === "passed" && !echoedAnchor) return NextResponse.json({ status: job.status });
  try {
    await requeueVisualInspection(job, ownerId);
    return NextResponse.json({ status: "queued" }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Visual inspection could not be queued. Your saved upload is still available." }, { status: 503 });
  }
}
