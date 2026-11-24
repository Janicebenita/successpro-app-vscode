import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE } from "@/lib/session";
import { createNotification } from "@/lib/notifications";
import { recordProductEvent } from "@/lib/product-telemetry";
import { normalizedContactHash } from "@/lib/contact-matching";

const FIVE_DAYS = 60 * 60 * 24 * 5 * 1000;

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Missing identity token." }, { status: 401 });
  try {
    const idToken = authorization.slice(7);
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    if (!decoded.email_verified) return NextResponse.json({ error: "Verify your email before signing in." }, { status: 403 });
    const registration = await adminDb.collection("registration_consents").doc(decoded.uid).get();
    const choices = registration.data();
    if (choices?.adultAndTermsAccepted !== true || (choices?.automatedCareerProcessingAccepted !== true && !choices?.withdrawnAt)) {
      return NextResponse.json({ code: "registration_consent_required", error: "Review and accept the required registration choices before continuing." }, { status: 409 });
    }
    const session = await adminAuth.createSessionCookie(idToken, { expiresIn: FIVE_DAYS });
    const now = FieldValue.serverTimestamp();
    await adminDb.collection("users").doc(decoded.uid).set({
      id: decoded.uid,
      email: decoded.email ?? null,
      emailHash: decoded.email ? normalizedContactHash(decoded.email) : null,
      displayName: decoded.name ?? null,
      emailVerified: true,
      status: "active",
      schemaVersion: 1,
      updatedAt: now,
      lastLoginAt: now,
      createdAt: now,
    }, { merge: true });
    const account = await adminDb.collection("users").doc(decoded.uid).get();
    const restricted = account.data()?.processingConsentStatus === "withdrawn";
    await createNotification({ ownerId: decoded.uid, category: "security", title: "New sign-in", message: "Your SuccessPro account was signed in. If this was not you, contact security support immediately.", href: "/help", dedupeKey: `signin-${decoded.uid}-${new Date().toISOString().slice(0, 10)}` }).catch(() => undefined);
    await recordProductEvent({ ownerId: decoded.uid, name: "session_signed_in", outcome: "success" }).catch(() => undefined);
    const response = NextResponse.json({ ok: true, restricted });
    response.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: FIVE_DAYS / 1000,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to establish a secure session." }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/" });
  return response;
}
