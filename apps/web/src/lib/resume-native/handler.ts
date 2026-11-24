import { unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { localDevelopmentOwnerId, NATIVE_REJECTION_MESSAGE, nativeResumeEnabled } from "./config";
import { createAndEnqueueJob, saveOriginal } from "./infrastructure";
import { inspectNativeUpload } from "./validation";

export async function nativeOwnerId() {
  const local = localDevelopmentOwnerId();
  if (local) return local;
  const user = await getSessionUser();
  return user?.uid ?? null;
}

function isUploadFile(value: unknown): value is File {
  return value instanceof File || (typeof value === "object" && value !== null && "name" in value && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function");
}

export async function postNativeResume(request: Request) {
  if (!nativeResumeEnabled()) return NextResponse.json({ error: "Native resume processing is disabled." }, { status: 404 });
  const ownerId = await nativeOwnerId();
  if (!ownerId) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("resume");
  if (!isUploadFile(file)) return NextResponse.json({ error: NATIVE_REJECTION_MESSAGE }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  let inspection;
  try { inspection = await inspectNativeUpload(file, bytes); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : NATIVE_REJECTION_MESSAGE }, { status: 422 }); }
  const stored = await saveOriginal(ownerId, file, bytes);
  try {
    const job = await createAndEnqueueJob({ ...stored, ownerId, originalName: file.name, mimeType: file.type || (inspection.kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), size: file.size, pageCount: inspection.pageCount });

    // Expose the text preview separately from the worker’s verified analysis.
    const immediateText = inspection.text ?? "";

    return NextResponse.json({
      processingJobId: job.id,
      status: job.status,
      duplicate: job.duplicate,
      text: immediateText || undefined,
      signals: immediateText ? {
        ...(inspection.pageCount ? { pageCount: inspection.pageCount } : {}),
        hasVisualEvidence: false,
        extractionReliable: immediateText.length >= 80,
      } : undefined,
      message: job.duplicate ? "Resume upload found. Checking processing status." : "Resume uploaded. Waiting for document inspection."
    }, { status: 202 });
  } catch (error) {
    await unlink(stored.objectPath).catch(() => undefined);
    console.error("resume-native-enqueue-failed", { error: error instanceof Error ? error.message : "UnknownError" });
    return NextResponse.json({ error: "Local resume services are unavailable. Start MySQL and Redis, then try again." }, { status: 503 });
  }
}

