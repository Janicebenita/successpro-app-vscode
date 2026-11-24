import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import type { DocumentData } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { resolveBillingConfig } from "@/lib/billing-config";

const CANCELLABLE_STATES = new Set(["active", "authenticated", "past_due", "paused"]);

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

// Browsers always send Origin on cross-site POSTs. Reject it when it does not match this site.
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return host === request.headers.get("host") || host === request.headers.get("x-forwarded-host");
  } catch {
    return false;
  }
}

function createdMillis(document: { data(): DocumentData }) {
  const value = document.data().createdAt;
  return typeof value?.toMillis === "function" ? value.toMillis() : 0;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("This request is not allowed.", 403);
  const user = await getSessionUser();
  if (!user) return fail("Sign in to manage your subscription.", 401);

  const billing = resolveBillingConfig();
  if (!billing.enabled) return fail("Subscription management is not available yet.", 503);

  const body = (await request.json().catch(() => null)) as { internalSubscriptionId?: unknown } | null;
  const wanted = typeof body?.internalSubscriptionId === "string" ? body.internalSubscriptionId : null;

  const snapshot = await adminDb.collection("subscriptions").where("ownerId", "==", user.uid).limit(50).get();
  const target = snapshot.docs
    .filter((document) => CANCELLABLE_STATES.has(String(document.data().state ?? "")) && (!wanted || document.id === wanted))
    .sort((a, b) => createdMillis(b) - createdMillis(a))[0];
  if (!target) return fail("You have no active subscription to cancel.", 404);

  const data = target.data();
  const periodEnd = typeof data.currentPeriodEnd?.toMillis === "function" ? new Date(data.currentPeriodEnd.toMillis()).toISOString() : null;
  if (data.cancelAtCycleEnd === true || data.renewalEnabled === false) {
    return NextResponse.json({ ok: true, alreadyCancelled: true, accessUntil: periodEnd });
  }
  if (typeof data.providerSubscriptionId !== "string" || !data.providerSubscriptionId.startsWith("sub_")) {
    return fail("This subscription cannot be cancelled online. Contact support.", 409);
  }

  // Active subscriptions end after the paid cycle. Others have nothing further to charge, so they end now.
  const immediate = data.state !== "active";
  let response: Response | null = null;
  try {
    response = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(data.providerSubscriptionId)}/cancel`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${billing.keyId}:${billing.keySecret}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ cancel_at_cycle_end: immediate ? 0 : 1 }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    response = null;
  }
  if (!response || !response.ok) {
    const detail = response ? await response.json().catch(() => null) : null;
    console.error("Razorpay cancel failed", { status: response?.status ?? "no-response", description: detail?.error?.description ?? null });
    return fail("We could not cancel right now. Nothing was changed. Please try again in a moment.", 502);
  }

  const now = FieldValue.serverTimestamp();
  await target.ref
    .update({ cancelAtCycleEnd: !immediate, renewalEnabled: false, cancelRequestedAt: now, updatedAt: now, ...(immediate ? { state: "cancelled" } : {}) })
    .catch((error) => console.error("Cancel accepted by Razorpay but local save failed", { id: target.id, error: String(error) }));
  return NextResponse.json({ ok: true, cancelAtCycleEnd: !immediate, accessUntil: periodEnd });
}
