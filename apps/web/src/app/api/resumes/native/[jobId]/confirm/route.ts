import { NextResponse } from "next/server";
import { z } from "zod";
import { nativeOwnerId } from "@/lib/resume-native/handler";
import { ownedJob, resumeDatabase } from "@/lib/resume-native/infrastructure";

export const runtime = "nodejs";

const confirmationSchema = z.object({
  fields: z.record(z.string(), z.unknown()).default({}),
  removedFields: z.array(z.string().max(120)).max(100).default([]),
});

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const ownerId = await nativeOwnerId();
  if (!ownerId) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  const { jobId } = await context.params;
  const job = await ownedJob(jobId, ownerId);
  if (!job) return NextResponse.json({ error: "Resume processing job not found." }, { status: 404 });
  if (job.status !== "awaiting_review" && job.status !== "completed") return NextResponse.json({ error: "This resume is not ready for confirmation." }, { status: 409 });
  const parsed = confirmationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The corrected profile is invalid.", details: parsed.error.flatten() }, { status: 400 });
  const confirmed = JSON.stringify({ ...parsed.data, confirmedAt: new Date().toISOString(), source: "user" });
  await resumeDatabase().execute("UPDATE resume_processing_jobs SET confirmed_result = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?", [confirmed, jobId, ownerId]);
  return NextResponse.json({ id: jobId, status: "completed", confirmed: parsed.data });
}

