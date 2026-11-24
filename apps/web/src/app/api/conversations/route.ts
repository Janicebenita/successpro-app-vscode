import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { conversationSummaries } from "@/lib/conversations";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { resolveUserEntitlements } from "@/lib/feature-entitlements";

function monthKey() {
  const date = new Date();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  return NextResponse.json({ conversations: await conversationSummaries(user.uid) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to contact this member." }, { status: 401 });
  const rate = await consumeRateLimit(user.uid, { feature: "new-contact", limit: 3, windowSeconds: 3_600 });
  if (!rate.allowed) return NextResponse.json({ error: "Too many contact attempts were made. Wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const body = await request.json().catch(() => null) as { publicProfileId?: unknown; message?: unknown } | null;
  const publicProfileId = typeof body?.publicProfileId === "string" ? body.publicProfileId : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!/^sp-[a-f0-9]{16}$/.test(publicProfileId) || message.length < 20 || message.length > 1_000) return NextResponse.json({ error: "Write a message between 20 and 1,000 characters." }, { status: 400 });

  const publicRef = adminDb.collection("public_profiles").doc(publicProfileId);
  const conversationId = createHash("sha256").update(`${user.uid}:${publicProfileId}`).digest("hex").slice(0, 32);
  const conversationRef = adminDb.collection("conversations").doc(conversationId);
  const allowanceRef = adminDb.collection("usage_allowances").doc(`${user.uid}_${monthKey()}_contacts`);
  const messageId = randomUUID();
  const messageRef = conversationRef.collection("messages").doc(messageId);
  const ledgerRef = adminDb.collection("usage_ledger").doc(`${conversationId}_${monthKey()}_contact`);
  const now = FieldValue.serverTimestamp();
  const access = await resolveUserEntitlements(user.uid);
  const contactLimit = access.entitlements.contactInitiationsPerMonth;

  const result = await adminDb.runTransaction(async (transaction) => {
    const [publicSnapshot, conversationSnapshot, allowanceSnapshot] = await Promise.all([
      transaction.get(publicRef),
      transaction.get(conversationRef),
      transaction.get(allowanceRef),
    ]);
    const recipient = publicSnapshot.data();
    if (!publicSnapshot.exists || !recipient?.published || !recipient.openToWork) return { status: 404, error: "This profile is not accepting contact requests." };
    if (recipient.ownerId === user.uid) return { status: 400, error: "You cannot contact your own profile." };
    const isNew = !conversationSnapshot.exists;
    const used = allowanceSnapshot.data()?.completed ?? 0;
    if (isNew && used >= contactLimit) return { status: 429, error: `You have started all ${contactLimit} new conversations available on your plan this month. You can start more next month.` };
    transaction.set(conversationRef, { id: conversationId, participantIds: [user.uid, recipient.ownerId], initiatedBy: user.uid, recipientPublicProfileId: publicProfileId, lastMessagePreview: message.slice(0, 160), lastMessageId: messageId, lastMessageSenderId: user.uid, readMessageIds: { [user.uid]: messageId }, createdAt: conversationSnapshot.data()?.createdAt ?? now, updatedAt: now, schemaVersion: 2 }, { merge: true });
    transaction.set(messageRef, { id: messageRef.id, senderId: user.uid, text: message, createdAt: now, schemaVersion: 1 });
    if (isNew) {
      transaction.set(allowanceRef, { ownerId: user.uid, feature: "profile_contacts", month: monthKey(), completed: used + 1, limit: contactLimit, planId: access.planId, updatedAt: now }, { merge: true });
      transaction.create(ledgerRef, { id: ledgerRef.id, ownerId: user.uid, feature: "profile_contacts", amount: 1, period: monthKey(), conversationId, idempotencyKey: ledgerRef.id, planId: access.planId, createdAt: now, schemaVersion: 1 });
    }
    return { status: 200, remaining: Math.max(0, contactLimit - used - (isNew ? 1 : 0)), recipientId: String(recipient.ownerId) };
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  await createNotification({ ownerId: result.recipientId!, category: "messages", title: "New contact request", message: "A SuccessPro member sent you a private message.", href: "/messages", dedupeKey: `contact-${conversationId}-${messageId}` }).catch(() => undefined);
  return NextResponse.json({ ok: true, conversationId, remaining: result.remaining });
}
