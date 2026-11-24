import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { consumeRateLimit } from "@/lib/rate-limit";
import { messagePage } from "@/lib/message-pagination";
import { createNotification } from "@/lib/notifications";

async function memberConversation(id: string, uid: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  const reference = adminDb.collection("conversations").doc(id);
  const snapshot = await reference.get();
  const data = snapshot.data();
  if (!snapshot.exists || !Array.isArray(data?.participantIds) || !data.participantIds.includes(uid)) return null;
  return { reference, data };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  const conversation = await memberConversation((await params).id, user.uid);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const peerId = (conversation.data.participantIds as string[]).find((id) => id !== user.uid) ?? "";
  const cursor = new URL(request.url).searchParams.get("cursor");
  const cursorSnapshot = cursor && /^[a-f0-9-]{20,40}$/i.test(cursor) ? await conversation.reference.collection("messages").doc(cursor).get() : null;
  if (cursor && !cursorSnapshot?.exists) return NextResponse.json({ error: "That message page is no longer available." }, { status: 400 });
  let messageQuery = conversation.reference.collection("messages").orderBy("createdAt", "desc").limit(51);
  if (cursorSnapshot?.exists) messageQuery = messageQuery.startAfter(cursorSnapshot);
  const [peer, messageSnapshot] = await Promise.all([
    adminDb.collection("users").doc(peerId).get(),
    messageQuery.get(),
  ]);
  const paged = messagePage(messageSnapshot.docs, 50);
  const lastMessageId = typeof conversation.data.lastMessageId === "string" ? conversation.data.lastMessageId : messageSnapshot.docs[0]?.id;
  if (lastMessageId && conversation.data.lastMessageSenderId !== user.uid) {
    await conversation.reference.set({ readMessageIds: { [user.uid]: lastMessageId } }, { merge: true });
  }
  return NextResponse.json({
    conversation: {
      id: conversation.reference.id,
      peerName: peer.data()?.displayName ?? "SuccessPro member",
      blocked: Array.isArray(conversation.data.blockedBy) && conversation.data.blockedBy.length > 0,
      blockedByMe: Array.isArray(conversation.data.blockedBy) && conversation.data.blockedBy.includes(user.uid),
    },
    messages: [...paged.page].reverse().map((document) => {
      const message = document.data();
      return { id: document.id, text: message.text, mine: message.senderId === user.uid, createdAt: message.createdAt?.toDate?.()?.toISOString?.() ?? null };
    }),
    nextCursor: paged.nextCursor,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  const rate = await consumeRateLimit(user.uid, { feature: "message-send", limit: 20, windowSeconds: 60 });
  if (!rate.allowed) return NextResponse.json({ error: "Messages are being sent too quickly. Wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const conversation = await memberConversation((await params).id, user.uid);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (Array.isArray(conversation.data.blockedBy) && conversation.data.blockedBy.length) return NextResponse.json({ error: "Messages are paused for this conversation." }, { status: 403 });
  const body = await request.json().catch(() => null) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message.length < 1 || message.length > 1_000) return NextResponse.json({ error: "Write a message of up to 1,000 characters." }, { status: 400 });
  const now = FieldValue.serverTimestamp();
  const messageId = randomUUID();
  const messageRef = conversation.reference.collection("messages").doc(messageId);
  const batch = adminDb.batch();
  batch.set(messageRef, { id: messageRef.id, senderId: user.uid, text: message, createdAt: now, schemaVersion: 1 });
  batch.set(conversation.reference, { lastMessagePreview: message.slice(0, 160), lastMessageId: messageId, lastMessageSenderId: user.uid, readMessageIds: { [user.uid]: messageId }, updatedAt: now, schemaVersion: 2 }, { merge: true });
  await batch.commit();
  const recipientId = (conversation.data.participantIds as string[]).find((id) => id !== user.uid);
  if (recipientId) await createNotification({ ownerId: recipientId, category: "messages", title: "New message", message: "You received a new private message on SuccessPro.", href: "/messages", dedupeKey: `message-${messageId}` }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  const rate = await consumeRateLimit(user.uid, { feature: "conversation-safety-action", limit: 10, windowSeconds: 60 });
  if (!rate.allowed) return NextResponse.json({ error: "Too many safety changes were made. Wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const conversation = await memberConversation((await params).id, user.uid);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { blocked?: unknown } | null;
  if (typeof body?.blocked !== "boolean") return NextResponse.json({ error: "Choose whether to block or unblock this conversation." }, { status: 400 });
  await conversation.reference.set({ blockedBy: body.blocked ? FieldValue.arrayUnion(user.uid) : FieldValue.arrayRemove(user.uid), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return NextResponse.json({ ok: true });
}
