import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireRecentIdentity, SESSION_COOKIE } from "@/lib/session";

export async function DELETE(request: Request) {
  const user = await requireRecentIdentity(request);
  if (!user) return NextResponse.json({ error: "Confirm your identity again before withdrawing consent." }, { status: 401 });
  const now = FieldValue.serverTimestamp();
  const eventRef = adminDb.collection("consent_events").doc();
  const batch = adminDb.batch();
  batch.set(eventRef, { ownerId: user.uid, event: "automated-career-processing-withdrawn", consentVersion: "successpro-career-processing-2026-09-23", occurredAt: now, schemaVersion: 1 });
  batch.set(adminDb.collection("registration_consents").doc(user.uid), { automatedCareerProcessingAccepted: false, withdrawnAt: now, updatedAt: now }, { merge: true });
  batch.set(adminDb.collection("users").doc(user.uid), { processingConsentStatus: "withdrawn", processingConsentWithdrawnAt: now, updatedAt: now }, { merge: true });
  await batch.commit();
  await adminAuth.revokeRefreshTokens(user.uid);
  const response = NextResponse.json({ ok: true, message: "Automated career processing has stopped. You can sign in only to export or delete your account." });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/" });
  return response;
}
