import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { createNotification, paymentNotification } from "@/lib/notifications";
import { recordProductEvent } from "@/lib/product-telemetry";
import { transitionPaymentState } from "@/lib/payment-webhook-state";
import { subscriptionAccessUpdate } from "@/lib/subscription-state";
import { extractSubscriptionRef, isStaleSubscriptionEvent } from "@/lib/subscription-webhook";

type RazorpayWebhook = {
  event?: unknown;
  created_at?: unknown;
  payload?: { payment?: { entity?: { order_id?: unknown; created_at?: unknown } }; order?: { entity?: { id?: unknown } } };
};

function validSignature(secret: string, raw: string, signature: string) {
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// Match by Razorpay's id first; fall back to our own id when our post-checkout save never completed.
async function findSubscription(providerSubscriptionId: string | null, internalId: string | null): Promise<DocumentSnapshot | null> {
  if (providerSubscriptionId) {
    const byProvider = await adminDb.collection("subscriptions").where("providerSubscriptionId", "==", providerSubscriptionId).limit(1).get();
    if (!byProvider.empty) return byProvider.docs[0];
  }
  if (internalId) {
    const direct = await adminDb.collection("subscriptions").doc(internalId).get();
    const stored = direct.data()?.providerSubscriptionId;
    if (direct.exists && (stored == null || stored === providerSubscriptionId)) return direct;
  }
  return null;
}

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("Razorpay webhook rejected: RAZORPAY_WEBHOOK_SECRET is not configured.");
    return NextResponse.json({ error: "Webhook receiver is not configured." }, { status: 500 });
  }
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const eventId = request.headers.get("x-razorpay-event-id") ?? "";
  const raw = await request.text();
  if (!signature || !eventId) return NextResponse.json({ error: "Webhook authentication is missing." }, { status: 401 });
  if (!validSignature(secret, raw, signature)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  let body: RazorpayWebhook;
  try { body = JSON.parse(raw) as RazorpayWebhook; } catch { return NextResponse.json({ error: "Webhook body is not valid JSON." }, { status: 400 }); }

  const ref = extractSubscriptionRef(body);
  const eventRef = adminDb.collection("webhook_events").doc(eventId);
  const rawOrderId = body?.payload?.payment?.entity?.order_id ?? body?.payload?.order?.entity?.id;
  const orderId = typeof rawOrderId === "string" ? rawOrderId : null;
  const event = String(body?.event ?? "unknown");
  const providerCreatedAt = Number(body?.created_at ?? body?.payload?.payment?.entity?.created_at ?? 0);
  const [orders, matchedSubscription] = await Promise.all([
    orderId ? adminDb.collection("addon_orders").where("razorpayOrderId", "==", orderId).limit(1).get() : null,
    findSubscription(ref.providerSubscriptionId, ref.internalSubscriptionId),
  ]);
  const matchedOrder = orders && !orders.empty ? orders.docs[0] : null;

  const processed = await adminDb.runTransaction(async (transaction) => {
    const existing = await transaction.get(eventRef);
    if (existing.exists) return { duplicate: true, state: String(existing.data()?.normalizedState ?? "unknown"), ignoredAsStale: false };
    const currentOrder = matchedOrder ? await transaction.get(matchedOrder.ref) : null;
    const currentSubscription = matchedSubscription ? await transaction.get(matchedSubscription.ref) : null;
    const subscriptionData = currentSubscription?.data();
    const transition = transitionPaymentState(currentOrder?.data()?.state, event);
    const access = subscriptionAccessUpdate({ eventType: event, providerStatus: ref.providerStatus, currentEnd: ref.currentEnd });
    const subscriptionStale = Boolean(matchedSubscription) && isStaleSubscriptionEvent(providerCreatedAt, subscriptionData?.lastProviderCreatedAt);
    const now = FieldValue.serverTimestamp();
    const matchedType = matchedSubscription ? "subscription" : matchedOrder ? "addon_order" : null;
    const matchedId = matchedSubscription?.id ?? matchedOrder?.id ?? null;
    const currentSubscriptionState = String(subscriptionData?.state ?? "unknown");
    const normalizedState = matchedSubscription ? (subscriptionStale ? currentSubscriptionState : access.state ?? currentSubscriptionState) : transition.state;
    const ignoredAsStale = matchedSubscription ? subscriptionStale : transition.ignoredAsStale;

    transaction.create(eventRef, {
      id: eventId, provider: "razorpay", type: event,
      providerOrderId: orderId ?? null, providerSubscriptionId: ref.providerSubscriptionId, internalSubscriptionId: ref.internalSubscriptionId,
      providerSubscriptionStatus: ref.providerStatus ?? null, providerCurrentEnd: ref.currentEnd ?? null, providerCreatedAt: providerCreatedAt || null,
      rawBodySha256: createHash("sha256").update(raw).digest("hex"), receivedAt: now, normalizedState,
      matchedRecordType: matchedType, matchedRecordId: matchedId, processingAttempts: 1,
      processingResult: matchedType ? (ignoredAsStale ? "ignored-stale" : "processed") : "unmatched", schemaVersion: 1,
    });
    if (matchedOrder && !transition.ignoredAsStale) {
      transaction.set(matchedOrder.ref, { state: transition.state, lastEventId: eventId, lastProviderCreatedAt: providerCreatedAt || null, updatedAt: now }, { merge: true });
    }
    if (matchedSubscription && access.state && !subscriptionStale) {
      transaction.set(matchedSubscription.ref, {
        state: access.state,
        renewalEnabled: subscriptionData?.cancelAtCycleEnd === true ? false : access.renewalEnabled,
        currentPeriodEnd: access.activeUntilSeconds ? Timestamp.fromMillis(access.activeUntilSeconds * 1_000) : subscriptionData?.currentPeriodEnd ?? null,
        lastEventId: eventId,
        ...(providerCreatedAt ? { lastProviderCreatedAt: providerCreatedAt } : {}),
        ...(ref.providerSubscriptionId && !subscriptionData?.providerSubscriptionId ? { providerSubscriptionId: ref.providerSubscriptionId } : {}),
        updatedAt: now,
      }, { merge: true });
      if ((access.grantAccess || access.preservePaidThrough) && access.activeUntilSeconds) {
        transaction.set(adminDb.collection("entitlements").doc(String(subscriptionData?.ownerId)), {
          ownerId: subscriptionData?.ownerId, planId: subscriptionData?.planId,
          activeUntil: Timestamp.fromMillis(access.activeUntilSeconds * 1_000),
          sourceSubscriptionId: matchedSubscription.id, entitlementSyncState: "synced", lastEventId: eventId, updatedAt: now, schemaVersion: 1,
        }, { merge: true });
      }
    }
    return { duplicate: false, state: String(normalizedState), ignoredAsStale };
  });

  if (processed.duplicate) return NextResponse.json({ ok: true, duplicate: true });
  const ownerId = matchedSubscription?.data()?.ownerId ?? matchedOrder?.data().ownerId;
  if (typeof ownerId === "string" && ownerId) {
    const notice = paymentNotification(event);
    await createNotification({ ownerId, category: "payments", ...notice, href: "/billing", dedupeKey: `payment-${eventId}` }).catch(() => undefined);
  }
  await recordProductEvent({
    ...(typeof ownerId === "string" ? { ownerId } : {}),
    name: "payment_event_received",
    outcome: processed.state === "paid" ? "success" : processed.state === "failed" ? "failed" : "processing",
    source: "razorpay",
  }).catch(() => undefined);
  return NextResponse.json({ ok: true, state: processed.state, ignoredAsStale: processed.ignoredAsStale });
}
