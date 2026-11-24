import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { resolveBillingConfig } from "@/lib/billing-config";
import { createMonthlyPriceBook, paidPlanIdSchema } from "@/lib/price-book";
import { razorpaySubscriptionPayload } from "@/lib/subscription-order";

const inputSchema = z.object({ planId: paidPlanIdSchema, currency: z.string().trim().length(3).optional() });
const BLOCKING_STATES = new Set(["active", "authenticated", "past_due", "paused"]);
const REUSE_WINDOW_MS = 30 * 60 * 1000;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail("Sign in to choose a subscription.", 401);

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Choose an available plan.", 400);
  const { planId } = parsed.data;
  if (parsed.data.currency && parsed.data.currency.toUpperCase() !== "INR") {
    return fail("Subscriptions are available in Indian rupees only for now. No charge was made.", 409);
  }

  const billing = resolveBillingConfig();
  if (!billing.enabled || !billing.subscriptions.enabled) {
    return fail("Subscription checkout is not open yet. No charge was made.", 503);
  }
  const providerPlanId = billing.subscriptions.planIds[planId];

  if (user.email_verified !== true) return fail("Verify your email address before subscribing.", 403);
  const account = await adminDb.collection("users").doc(user.uid).get();
  if (account.data()?.registrationConsentComplete !== true) {
    return fail("Complete your registration confirmations before subscribing.", 403);
  }

  const priceBook = createMonthlyPriceBook({ currency: "INR" });
  if (!priceBook.available) return fail("A current verified price is unavailable. No charge was made.", 409);
  const amount = priceBook.plans[planId];

  const reference = adminDb.collection("subscriptions").doc();
  const now = FieldValue.serverTimestamp();

  // One transaction: block overlapping subscriptions, reuse a recent checkout, or save a record before calling Razorpay.
  const outcome = await adminDb.runTransaction(async (tx) => {
    const existing = await tx.get(adminDb.collection("subscriptions").where("ownerId", "==", user.uid).limit(50));
    const nowMs = Date.now();
    for (const document of existing.docs) {
      const data = document.data();
      const state = String(data.state ?? "");
      const paidUntil = typeof data.currentPeriodEnd?.toMillis === "function" ? data.currentPeriodEnd.toMillis() : 0;
      if (BLOCKING_STATES.has(state) || (state === "cancelled" && paidUntil > nowMs)) return { kind: "blocked" as const };
    }
    for (const document of existing.docs) {
      const data = document.data();
      const createdMs = typeof data.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : 0;
      if (data.state !== "created" || data.planId !== planId || createdMs < nowMs - REUSE_WINDOW_MS) continue;
      if (typeof data.providerSubscriptionId !== "string") return { kind: "in-progress" as const };
      return {
        kind: "reuse" as const,
        id: document.id,
        providerSubscriptionId: data.providerSubscriptionId,
        checkoutUrl: typeof data.checkoutUrl === "string" ? data.checkoutUrl : null,
      };
    }
    tx.create(reference, {
      id: reference.id,
      ownerId: user.uid,
      planId,
      amount,
      currency: "INR",
      priceBookVersion: priceBook.version,
      pricingRuleVersion: "inr-base-v1",
      fxRate: priceBook.fxRate,
      fxAsOf: priceBook.fxAsOf,
      provider: "razorpay",
      providerMode: billing.mode,
      providerPlanId,
      providerSubscriptionId: null,
      checkoutUrl: null,
      state: "created",
      renewalEnabled: true,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    });
    return { kind: "created" as const };
  });

  if (outcome.kind === "blocked") {
    return fail("Your current plan is still active. Manage it on the Billing page, and subscribe again after it ends.", 409);
  }
  if (outcome.kind === "in-progress") return fail("Your checkout is being prepared. Try again in a few seconds.", 409);
  if (outcome.kind === "reuse") {
    return NextResponse.json({ keyId: billing.keyId, subscriptionId: outcome.providerSubscriptionId, internalSubscriptionId: outcome.id, checkoutUrl: outcome.checkoutUrl, amount, currency: "INR", planId });
  }

  const payload = razorpaySubscriptionPayload({ planId, providerPlanId, internalSubscriptionId: reference.id });
  let provider: { id?: unknown; short_url?: unknown; status?: unknown } | null = null;
  try {
    const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${billing.keyId}:${billing.keySecret}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (response.ok) provider = await response.json();
  } catch {
    provider = null;
  }
  if (!provider || typeof provider.id !== "string" || !provider.id.startsWith("sub_")) {
    await reference.update({ state: "failed", failureReason: "provider-error", updatedAt: FieldValue.serverTimestamp() }).catch(() => undefined);
    return fail("Secure subscription checkout could not be started. No charge was made.", 502);
  }

  const checkoutUrl = typeof provider.short_url === "string" && provider.short_url.startsWith("https://") ? provider.short_url : null;
  await reference.update({
    providerSubscriptionId: provider.id,
    checkoutUrl,
    state: typeof provider.status === "string" ? provider.status : "created",
    updatedAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ keyId: billing.keyId, subscriptionId: provider.id, internalSubscriptionId: reference.id, checkoutUrl, amount, currency: "INR", planId });
}
