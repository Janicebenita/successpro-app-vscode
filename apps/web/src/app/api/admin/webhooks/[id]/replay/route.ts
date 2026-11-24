import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase-admin";
import { transitionPaymentState } from "@/lib/payment-webhook-state";
import { subscriptionAccessUpdate } from "@/lib/subscription-state";
import { webhookReplayEligibility } from "@/lib/webhook-replay";
import { isStaleSubscriptionEvent } from "@/lib/subscription-webhook";

const replaySchema = z.object({ reason: z.string().trim().min(20).max(1_000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(["finance_admin", "ops_admin"]);
  if (!admin) return NextResponse.json({ error: "Finance or operations-admin access is required." }, { status: 403 });
  const parsed = replaySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Add a replay reason." }, { status: 400 });
  const id = (await params).id;
  if (!/^[A-Za-z0-9_-]{3,200}$/.test(id)) return NextResponse.json({ error: "Webhook event not found." }, { status: 404 });
  const eventRef = adminDb.collection("webhook_events").doc(id); const initial = await eventRef.get();
  if (!initial.exists) return NextResponse.json({ error: "Webhook event not found." }, { status: 404 });
  const event = initial.data() ?? {}; const eligible = webhookReplayEligibility(event);
  if (!eligible.allowed) return NextResponse.json({ error: eligible.reason }, { status: 409 });
  const orderId = typeof event.providerOrderId === "string" && event.providerOrderId.trim() ? event.providerOrderId.trim() : null; const subscriptionId = typeof event.providerSubscriptionId === "string" && event.providerSubscriptionId.trim() ? event.providerSubscriptionId.trim() : null;
  const [orders, subscriptions] = await Promise.all([orderId ? adminDb.collection("addon_orders").where("razorpayOrderId", "==", orderId).limit(1).get() : null, subscriptionId ? adminDb.collection("subscriptions").where("providerSubscriptionId", "==", subscriptionId).limit(1).get() : null]);
  const matchedOrder = orders && !orders.empty ? orders.docs[0] : null; let matchedSubscription: DocumentSnapshot | null = subscriptions && !subscriptions.empty ? subscriptions.docs[0] : null;
  const internalId = typeof event.internalSubscriptionId === "string" ? event.internalSubscriptionId.trim() : "";
  if (!matchedSubscription && /^[A-Za-z0-9]{10,40}$/.test(internalId)) { const direct = await adminDb.collection("subscriptions").doc(internalId).get(); const stored = direct.data()?.providerSubscriptionId; if (direct.exists && (stored == null || stored === subscriptionId)) matchedSubscription = direct; }
  const auditRef = adminDb.collection("admin_audit_events").doc();
  if (!matchedOrder && !matchedSubscription) {
    const attemptRecorded = await adminDb.runTransaction(async (transaction) => {
      const latest = await transaction.get(eventRef); const value = latest.data() ?? {}; const currentEligibility = webhookReplayEligibility(value);
      if (!latest.exists || !currentEligibility.allowed) return false;
      const now = FieldValue.serverTimestamp(); const nextAttempts = currentEligibility.attempts + 1;
      transaction.set(eventRef, { processingAttempts: nextAttempts, replayLastAttemptAt: now, replayLastAttemptBy: admin.user.uid, replayLastReason: parsed.data.reason, replayLastOutcome: "still-unmatched" }, { merge: true });
      transaction.create(auditRef, { id: auditRef.id, actorId: admin.user.uid, actorRoles: admin.roles, action: "payment-webhook-replay-attempted", targetType: "webhook_event", targetId: id, before: { processingResult: value.processingResult, processingAttempts: value.processingAttempts }, after: { processingResult: value.processingResult, processingAttempts: nextAttempts, replayOutcome: "still-unmatched" }, reason: parsed.data.reason, outcome: "failed", createdAt: now, schemaVersion: 1 });
      return true;
    });
    return NextResponse.json({ error: attemptRecorded ? "The referenced payment or subscription still does not exist. The failed attempt was recorded." : "The event changed before replay; refresh the queue." }, { status: 409 });
  }
  const outcome = await adminDb.runTransaction(async (transaction) => {
    const latest = await transaction.get(eventRef); const value = latest.data() ?? {}; const currentEligibility = webhookReplayEligibility(value);
    if (!latest.exists || !currentEligibility.allowed) return null;
    const order = matchedOrder ? await transaction.get(matchedOrder.ref) : null; const subscription = matchedSubscription ? await transaction.get(matchedSubscription.ref) : null;
    const type = String(value.type ?? "unknown"); const transition = transitionPaymentState(order?.data()?.state, type);
    const access = subscriptionAccessUpdate({ eventType: type, providerStatus: typeof value.providerSubscriptionStatus === "string" ? value.providerSubscriptionStatus : undefined, currentEnd: typeof value.providerCurrentEnd === "number" ? value.providerCurrentEnd : undefined });
    const now = FieldValue.serverTimestamp(); const subscriptionStale = Boolean(matchedSubscription) && isStaleSubscriptionEvent(Number(value.providerCreatedAt ?? 0), subscription?.data()?.lastProviderCreatedAt); const normalizedState = matchedSubscription ? (subscriptionStale ? String(subscription?.data()?.state ?? "unknown") : access.state ?? String(subscription?.data()?.state ?? "unknown")) : transition.state;
    if (matchedOrder && !transition.ignoredAsStale) transaction.set(matchedOrder.ref, { state: transition.state, lastEventId: id, lastProviderCreatedAt: value.providerCreatedAt ?? null, updatedAt: now }, { merge: true });
    if (matchedSubscription && access.state && !subscriptionStale) {
      transaction.set(matchedSubscription.ref, { state: access.state, renewalEnabled: subscription?.data()?.cancelAtCycleEnd === true ? false : access.renewalEnabled, currentPeriodEnd: access.activeUntilSeconds ? Timestamp.fromMillis(access.activeUntilSeconds * 1_000) : subscription?.data()?.currentPeriodEnd ?? null, lastEventId: id, ...(typeof value.providerCreatedAt === "number" && value.providerCreatedAt ? { lastProviderCreatedAt: value.providerCreatedAt } : {}), updatedAt: now }, { merge: true });
      if ((access.grantAccess || access.preservePaidThrough) && access.activeUntilSeconds) transaction.set(adminDb.collection("entitlements").doc(String(subscription?.data()?.ownerId)), { ownerId: subscription?.data()?.ownerId, planId: subscription?.data()?.planId, activeUntil: Timestamp.fromMillis(access.activeUntilSeconds * 1_000), sourceSubscriptionId: matchedSubscription.id, entitlementSyncState: "synced", lastEventId: id, updatedAt: now, schemaVersion: 1 }, { merge: true });
    }
    const processingResult = (matchedSubscription ? subscriptionStale : matchedOrder && transition.ignoredAsStale) ? "ignored-stale" : "processed";
    transaction.set(eventRef, { matchedRecordType: matchedSubscription ? "subscription" : "addon_order", matchedRecordId: matchedSubscription?.id ?? matchedOrder?.id, normalizedState, processingResult, processingAttempts: currentEligibility.attempts + 1, replayedAt: now, replayedBy: admin.user.uid, replayReason: parsed.data.reason }, { merge: true });
    transaction.create(auditRef, { id: auditRef.id, actorId: admin.user.uid, actorRoles: admin.roles, action: "payment-webhook-replayed", targetType: "webhook_event", targetId: id, before: { processingResult: value.processingResult, processingAttempts: value.processingAttempts }, after: { processingResult, processingAttempts: currentEligibility.attempts + 1, matchedRecordType: matchedSubscription ? "subscription" : "addon_order", normalizedState }, reason: parsed.data.reason, outcome: "completed", createdAt: now, schemaVersion: 1 });
    return { state: normalizedState, processingResult };
  });
  return outcome ? NextResponse.json({ ok: true, ...outcome }) : NextResponse.json({ error: "The event changed before replay; refresh the queue." }, { status: 409 });
}
