import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { extractCanonicalProfile, reconcileExtractedProfile, validateResumeUpload } from "@successpro/domain";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { cleanExtractedText, detectResumeSourceLanguage, extractDocxResume, extractLegacyDocResume, extractPdfResume } from "@/lib/resume-extraction";
import { getSessionUser } from "@/lib/session";
import { consumeRateLimit } from "@/lib/rate-limit";
import { recordProductEvent } from "@/lib/product-telemetry";
import { runAiTask } from "@/lib/ai/orchestrator";
import { nativeResumeEnabled } from "@/lib/resume-native/config";
import { postNativeResume } from "@/lib/resume-native/handler";

export const runtime = "nodejs";

function safeName(name: string) {
  return name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-120);
}

export async function POST(request: Request) {
  try {
    if (nativeResumeEnabled()) return await postNativeResume(request);
  } catch (error) {
    console.error("POST_RESUME_FATAL_ERROR", error);
    const message = process.env.NODE_ENV !== "production"
      ? (error instanceof Error ? error.message : String(error))
      : "An unexpected error occurred while processing the resume. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev) {
    const rate = await consumeRateLimit(user.uid, { feature: "resume-upload", limit: 30, windowSeconds: 300 });
    if (!rate.allowed) return NextResponse.json({ error: "Too many uploads were started. Wait a few minutes and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  const form = await request.formData();
  const file = form.get("resume");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF, Word (.doc or .docx), or TXT resume." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateResumeUpload({ name: file.name, mimeType: file.type, size: file.size, signature: bytes.slice(0, 4) });
  if (!validation.valid) return NextResponse.json({ error: validation.message }, { status: 400 });
  const buffer = Buffer.from(bytes);
  if (validation.kind === "docx" && buffer.includes(Buffer.from("vbaProject.bin"))) return NextResponse.json({ error: "This Word file contains automated content we cannot accept. Save a new DOCX copy and try again." }, { status: 400 });

  let text = "";
  let pageCount: number | null = null;
  let extractionMethod: "plain-text" | "doc" | "docx" | "embedded-text" | "cloud-ocr" = "plain-text";
  let layoutSignals = { multiColumn: false, tableHeavy: false, crowdedLayout: false, excessiveWhitespace: false, inconsistentMargins: false, excessiveColor: false, smallText: false };
  try {
    if (validation.kind === "txt") text = buffer.toString("utf8");
    if (validation.kind === "doc") {
      const result = await extractLegacyDocResume(buffer);
      text = result.text;
      pageCount = result.pageCount;
      layoutSignals = result.layout;
      extractionMethod = "doc";
      if (pageCount && pageCount > 12) return NextResponse.json({ error: "Please upload a resume with 12 pages or fewer." }, { status: 400 });
    }
    if (validation.kind === "docx") {
      const result = await extractDocxResume(buffer);
      text = result.text;
      pageCount = result.pageCount;
      layoutSignals = result.layout;
      extractionMethod = "docx";
      if (pageCount && pageCount > 12) return NextResponse.json({ error: "Please upload a resume with 12 pages or fewer." }, { status: 400 });
    }
    if (validation.kind === "pdf") {
      const result = await extractPdfResume(bytes);
      text = result.text;
      pageCount = result.pageCount;
      extractionMethod = result.method;
      layoutSignals = result.layout;
      if (pageCount > 12) return NextResponse.json({ error: "Please upload a resume with 12 pages or fewer." }, { status: 400 });
    }
  } catch (error) {
    console.error("resume-extraction-failed", { kind: validation.kind, errorName: error instanceof Error ? error.name : "UnknownError", errorCode: typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined });
    return NextResponse.json({ error: "We could not read this file. If it is a scanned PDF, try a clearer scan; otherwise save a fresh PDF or Word copy and upload it again.", text: cleanExtractedText(text) }, { status: 422 });
  }
  text = cleanExtractedText(text);
  if (text.length < 80) return NextResponse.json({ error: "We found very little readable text, even after checking scanned pages. Try a clearer scan or upload a Word file.", text }, { status: 422 });
  if (text.length > 200_000) return NextResponse.json({ error: "This file contains more text than we can review safely. Please contact support rather than removing career details." }, { status: 400 });
  const sourceLanguage = detectResumeSourceLanguage(text);

  const versionId = randomUUID();
  const objectName = `resumes/${user.uid}/${versionId}/${safeName(file.name)}`;
  const hash = createHash("sha256").update(buffer).digest("hex");
  await adminStorage.bucket(process.env.SUCCESSPRO_PRIVATE_BUCKET).file(objectName).save(buffer, {
    resumable: false,
    contentType: file.type,
    metadata: { cacheControl: "private, no-store", contentDisposition: `attachment; filename="${safeName(file.name)}"`, metadata: { ownerId: user.uid, sha256: hash } },
  });
  const now = FieldValue.serverTimestamp();
  const extraction = extractCanonicalProfile(text);
  const assisted = await runAiTask("extractResumeProfile", { resumeText: text, deterministicDraft: extraction.draft, sourceLanguage, transform: false }, { ownerId: user.uid, sensitivity: "personal" });
  const profileDraft = { ...reconcileExtractedProfile(extraction.draft, assisted.output.profileDraft), openToWork: false, publicProfileEnabled: false, searchEngineIndexable: false };
  const profileDraftWarnings = uniqueStrings([...extraction.warnings, ...assisted.output.warnings]);
  const versionRef = adminDb.collection("resume_versions").doc(versionId);
  await Promise.all([
    versionRef.set({ id: versionId, ownerId: user.uid, originalName: file.name, objectName, sha256: hash, mimeType: file.type, size: file.size, pageCount, extractedText: text, sourceLanguage, extractionMethod, layoutSignals, extractionReliable: text.length >= 300, profileDraft, profileDraftConfidence: extraction.confidence, profileDraftWarnings, profileDraftImprovements: assisted.output.improvements, profileDraftAssistant: assisted.meta, profileDraftStatus: "pending-user-review", securityScan: "signature-and-macro-screen", schemaVersion: 1, createdAt: now, updatedAt: now }),
    adminDb.collection("resumes").doc(user.uid).set({ id: user.uid, ownerId: user.uid, latestVersionId: versionId, latestHash: hash, updatedAt: now, schemaVersion: 1 }, { merge: true }),
  ]);
  await recordProductEvent({ ownerId: user.uid, name: "resume_uploaded", outcome: "success", source: validation.kind, count: pageCount ?? undefined }).catch(() => undefined);
  return NextResponse.json({ versionId, text, sourceLanguage, profileDraft, profileDraftConfidence: extraction.confidence, profileDraftWarnings, profileDraftAssistant: assisted.meta, signals: { extractionReliable: text.length >= 300, imageOnly: extractionMethod === "cloud-ocr", pageCount: pageCount ?? undefined, ...layoutSignals, hasVisualEvidence: validation.kind === "pdf" || validation.kind === "docx", designWarnings: [] }, extractionMethod, message: extractionMethod === "cloud-ocr" ? `${file.name} is ready. We read the scanned pages and filled the text below.` : `${file.name} is ready. We filled the text below and checked its content, structure, and formatting.` });
}

function uniqueStrings(values: string[]) { return [...new Set(values.filter(Boolean))]; }
