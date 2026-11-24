import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { recruiterApplicationSchema } from "@/lib/recruiter-account";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to view recruiter status." }, { status: 401 });
  const snapshot = await adminDb.collection("recruiter_accounts").doc(user.uid).get();
  if (!snapshot.exists) return NextResponse.json({ account: null });
  const value = snapshot.data() ?? {}; return NextResponse.json({ account: { organizationName: value.organizationName, organizationWebsite: value.organizationWebsite, workEmail: value.workEmail, recruiterTitle: value.recruiterTitle, registrationJurisdiction: value.registrationJurisdiction, registrationNumber: value.registrationNumber, hiringPurpose: value.hiringPurpose, dueDiligenceStatus: value.dueDiligenceStatus, recruiterEnabled: Boolean(value.recruiterEnabled), submittedAt: value.submittedAt?.toDate?.()?.toISOString?.() ?? null, reviewedAt: value.reviewedAt?.toDate?.()?.toISOString?.() ?? null, decisionReason: value.decisionReason ?? "" } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to request recruiter access." }, { status: 401 });
  const rate = await consumeRateLimit(user.uid, { feature: "recruiter-application", limit: 3, windowSeconds: 86_400 }); if (!rate.allowed) return NextResponse.json({ error: "Too many recruiter applications were submitted. Try again tomorrow." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = recruiterApplicationSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the organization details." }, { status: 400 });
  const reference = adminDb.collection("recruiter_accounts").doc(user.uid); const existing = await reference.get(); const current = existing.data()?.dueDiligenceStatus;
  if (current === "pending" || current === "approved") return NextResponse.json({ error: current === "pending" ? "Your recruiter application is already under review." : "Recruiter access is already approved." }, { status: 409 });
  await reference.set({ ownerId: user.uid, ...parsed.data, dueDiligenceStatus: "pending", recruiterEnabled: false, submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), reviewedAt: null, reviewedBy: null, decisionReason: "", schemaVersion: 1 }, { merge: true });
  return NextResponse.json({ ok: true, status: "pending" }, { status: 201 });
}
