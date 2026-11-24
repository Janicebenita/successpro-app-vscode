import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { configuredFxReference, resolveSignupPriceLock } from "@/lib/price-book";

const inputSchema = z.object({
  adultAndTermsAccepted: z.literal(true),
  automatedCareerProcessingAccepted: z.literal(true),
  externalAiDataUseAccepted: z.literal(true),
  selectedPlan: z.enum(["free", "premium-monthly", "premium-quarterly", "premium-annual"]).default("free"),
  requestedCurrency: z.string().trim().length(3).default("INR"),
});

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Missing identity token." }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "All registration confirmations are required." }, { status: 400 });
  try {
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7), true);
    const now = FieldValue.serverTimestamp();
    const consentRef = adminDb.collection("registration_consents").doc(decoded.uid);
    const eventRef = adminDb.collection("consent_events").doc();
    const fxSnapshot = parsed.data.requestedCurrency.toUpperCase() === "INR" ? null : await adminDb.collection("fx_rates").doc("latest").get();
    const priceLock = resolveSignupPriceLock({ planId: parsed.data.selectedPlan, currency: parsed.data.requestedCurrency, fx: fxSnapshot?.data() ?? configuredFxReference() });
    if (!priceLock) return NextResponse.json({ error: "That currency is not available right now. Choose Indian rupees or try again later." }, { status: 409 });
    const priceLockRef = adminDb.collection("signup_price_locks").doc(decoded.uid);
    const existingPriceLock = await priceLockRef.get();
    const record = {
      ownerId: decoded.uid,
      email: decoded.email ?? null,
      adultAndTermsAccepted: true,
      automatedCareerProcessingAccepted: true,
      externalAiDataUseAccepted: true,
      termsVersion: "successpro-terms-2026-09-23",
      privacyVersion: "successpro-privacy-2026-09-24",
      automatedProcessingVersion: "successpro-career-processing-2026-09-24",
      externalAiDataUseVersion: "successpro-external-ai-data-use-2026-09-24",
      acceptedAt: now,
      schemaVersion: 1,
    };
    const batch = adminDb.batch();
    batch.set(consentRef, record, { merge: true });
    batch.set(eventRef, { ...record, event: "accepted" });
    if (!existingPriceLock.exists) batch.set(priceLockRef, { ownerId: decoded.uid, ...priceLock, pricingRuleVersion: "signup-price-lock-v1", createdAt: now, updatedAt: now, schemaVersion: 1 });
    batch.set(adminDb.collection("users").doc(decoded.uid), { registrationConsentComplete: true, registrationConsentVersion: record.automatedProcessingVersion, updatedAt: now }, { merge: true });
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to record your registration choices." }, { status: 401 });
  }
}
