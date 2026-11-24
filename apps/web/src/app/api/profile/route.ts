import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { canonicalProfileSchema } from "@successpro/contracts";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { publicProfileProjection } from "@/lib/public-profile";
import { unansweredProfileQuestions } from "@/lib/profile-review-questions";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  const snapshot = await adminDb.collection("profiles").doc(user.uid).get();
  return NextResponse.json({ profile: snapshot.exists ? snapshot.data() : null });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const parsed = canonicalProfileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check your name, headline, and other required details before saving.", details: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.awards.some((item) => !item.kind)) return NextResponse.json({ error: "Choose whether each saved highlight is an award or an achievement before confirming your profile." }, { status: 400 });
  const reviewAnswers = Array.isArray(body.reviewAnswers) ? body.reviewAnswers.filter((item: unknown): item is string => typeof item === "string" && item.length <= 100).slice(0, 50) : [];
  const profileRef = adminDb.collection("profiles").doc(user.uid);
  const versionRef = adminDb.collection("profile_versions").doc();
  const generatedPublicId = `sp-${randomBytes(8).toString("hex")}`;
  const now = FieldValue.serverTimestamp();
  const result = await adminDb.runTransaction(async (transaction) => {
    const current = await transaction.get(profileRef);
    const resume = await transaction.get(adminDb.collection("resumes").doc(user.uid));
    const resumeVersionId = resume.data()?.latestVersionId;
    const resumeVersionRef = typeof resumeVersionId === "string" ? adminDb.collection("resume_versions").doc(resumeVersionId) : null;
    const resumeVersion = resumeVersionRef ? await transaction.get(resumeVersionRef) : null;
    if (resumeVersion?.data()?.ownerId === user.uid) {
      const warnings = resumeVersion.data()?.profileDraftQuestionsReviewed === true ? [] : Array.isArray(resumeVersion.data()?.profileDraftWarnings) ? resumeVersion.data()!.profileDraftWarnings.filter((item: unknown): item is string => typeof item === "string") : [];
      const unresolved = unansweredProfileQuestions(parsed.data, warnings, reviewAnswers);
      if (unresolved.length) return { error: `Confirm or complete ${unresolved.length} resume detail${unresolved.length === 1 ? "" : "s"} before saving.`, questions: unresolved };
    }
    const version = (current.data()?.version ?? 0) + 1;
    const publicProfileId = current.data()?.publicProfileId ?? generatedPublicId;
    const record = { ...parsed.data, id: user.uid, ownerId: user.uid, publicProfileId, version, schemaVersion: 1, updatedAt: now, createdAt: current.data()?.createdAt ?? now };
    transaction.set(profileRef, record);
    transaction.set(versionRef, { ...record, id: versionRef.id, profileId: user.uid, correctionSource: "user-confirmed" });
    if (resumeVersionRef && resumeVersion?.data()?.ownerId === user.uid) transaction.set(resumeVersionRef, { profileDraftQuestionsReviewed: true, profileDraftReviewAnswers: reviewAnswers, profileDraftQuestionsReviewedAt: now }, { merge: true });
    const publicRef = adminDb.collection("public_profiles").doc(publicProfileId);
    if (parsed.data.publicProfileEnabled) {
      transaction.set(publicRef, {
        id: publicProfileId,
        ownerId: user.uid,
        published: true,
        ...publicProfileProjection(parsed.data),
        updatedAt: now,
        schemaVersion: 1,
      });
    } else if (current.data()?.publicProfileId) {
      transaction.set(publicRef, { published: false, openToWork: false, updatedAt: now }, { merge: true });
    }
    return { publicProfileId: parsed.data.publicProfileEnabled ? publicProfileId : null };
  });
  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json({ ok: true, publicProfileId: result.publicProfileId });
}
