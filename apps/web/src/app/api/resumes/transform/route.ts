import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { extractedProfileSchema } from "@successpro/contracts/ai";
import { extractCanonicalProfile, reconcileExtractedProfile } from "@successpro/domain";
import { adminDb } from "@/lib/firebase-admin";
import { runAiTask } from "@/lib/ai/orchestrator";
import { getSessionUser } from "@/lib/session";
import { unansweredProfileQuestions } from "@/lib/profile-review-questions";

const requestSchema = z.object({ draft: extractedProfileSchema, reviewAnswers: z.array(z.string().max(100)).max(50).default([]), jobDescription: z.string().trim().max(100_000).default(""), refinementNotes: z.string().trim().max(2_000).default(""), mode: z.enum(["initial", "refine"]).default("initial") });

export async function POST(request: Request) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to transform your resume details." }, { status: 401 });
  const consent = await adminDb.collection("registration_consents").doc(user.uid).get();
  if (consent.data()?.externalAiDataUseAccepted !== true) return NextResponse.json({ error: "Accept the current data-use terms before using expert resume transformation.", consentRequired: true }, { status: 428 });
  const resume = await adminDb.collection("resumes").doc(user.uid).get(); const versionId = resume.data()?.latestVersionId;
  if (!versionId) return NextResponse.json({ error: "Upload a resume before transforming its details." }, { status: 409 });
  const reference = adminDb.collection("resume_versions").doc(String(versionId)); const snapshot = await reference.get(); const value = snapshot.data();
  if (!snapshot.exists || value?.ownerId !== user.uid || typeof value.extractedText !== "string") return NextResponse.json({ error: "The latest resume version is unavailable." }, { status: 404 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({ draft: value.profileDraft ?? {} })));
  if (!parsed.success) return NextResponse.json({ error: "Check the edited resume details and refinement notes before transforming again." }, { status: 400 });
  const currentProfile = await adminDb.collection("profiles").doc(user.uid).get();
  const recoveredDraft = reconcileExtractedProfile(extractCanonicalProfile(value.extractedText).draft, value.profileDraft ?? {});
  const editedDraft = { ...recoveredDraft, ...parsed.data.draft };
  const warnings = value.profileDraftQuestionsReviewed === true ? [] : Array.isArray(value.profileDraftWarnings) ? value.profileDraftWarnings.filter((item: unknown): item is string => typeof item === "string") : [];
  const unresolved = unansweredProfileQuestions(editedDraft, warnings, parsed.data.reviewAnswers);
  if (unresolved.length) return NextResponse.json({ error: `Confirm or complete ${unresolved.length} resume detail${unresolved.length === 1 ? "" : "s"} before transformation.`, questions: unresolved }, { status: 409 });
  const targetRoles = Array.isArray(editedDraft.targetRoles) ? editedDraft.targetRoles.map(String).slice(0, 10) : Array.isArray(currentProfile.data()?.targetRoles) ? currentProfile.data()!.targetRoles.map(String).slice(0, 10) : [];
  const result = await runAiTask("transformResumeProfile", { resumeText: value.extractedText, deterministicDraft: editedDraft, sourceLanguage: String(value.sourceLanguage ?? "und"), targetRoles, jobDescription: parsed.data.jobDescription, refinementNotes: parsed.data.refinementNotes, preserveStructure: parsed.data.mode === "refine" }, { ownerId: user.uid, sensitivity: "personal", preferredLanguage: String(editedDraft.preferredLanguage ?? currentProfile.data()?.preferredLanguage ?? "en") });
  if (result.meta.validation !== "passed") return NextResponse.json({ error: "The expert resume writer is temporarily unavailable. Your existing details have not been changed; please try again shortly." }, { status: 503 });
  const profileDraft = { ...editedDraft, ...result.output.profileDraft, openToWork: false, publicProfileEnabled: false, searchEngineIndexable: false };
  // Reassess questions against the customer's corrected draft. Old extraction
  // warnings must not follow a corrected fact into each later version.
  const outputWarnings = [...new Set(result.output.warnings)];
  const now = FieldValue.serverTimestamp(); const version = adminDb.collection("resume_transform_versions").doc(); const batch = adminDb.batch();
  batch.set(version, { id: version.id, ownerId: user.uid, resumeVersionId: reference.id, mode: parsed.data.mode, inputDraft: editedDraft, jobDescription: parsed.data.jobDescription, refinementNotes: parsed.data.refinementNotes, profileDraft, improvements: result.output.improvements, assistant: result.meta, createdAt: now, schemaVersion: 1 });
  batch.set(reference, { profileDraft, profileDraftWarnings: outputWarnings, profileDraftQuestionsReviewed: false, profileDraftReviewAnswers: [], profileDraftImprovements: result.output.improvements, profileDraftAssistant: result.meta, profileDraftStatus: "transformed-pending-user-review", latestTransformVersionId: version.id, transformedAt: now, updatedAt: now }, { merge: true });
  await batch.commit();
  return NextResponse.json({ profileDraft, warnings: outputWarnings, improvements: result.output.improvements, assistant: result.meta, transformVersionId: version.id });
}
