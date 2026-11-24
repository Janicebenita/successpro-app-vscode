import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";

function connectionId(a: string, b: string) { return createHash("sha256").update([a, b].sort().join(":"), "utf8").digest("hex").slice(0, 32); }

export async function GET() {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to view connections." }, { status: 401 });
  const snapshot = await adminDb.collection("connections").where("participantIds", "array-contains", user.uid).limit(500).get();
  const connections = await Promise.all(snapshot.docs.map(async (doc) => { const value = doc.data(); const peerId = (value.participantIds as string[]).find((id) => id !== user.uid) ?? ""; const profile = await adminDb.collection("public_profiles").where("ownerId", "==", peerId).where("published", "==", true).limit(1).get(); const peer = profile.docs[0]?.data() ?? {}; return { id: doc.id, status: value.status, incoming: value.recipientId === user.uid, muted: Array.isArray(value.mutedBy) && value.mutedBy.includes(user.uid), requestedAt: value.requestedAt?.toDate?.()?.toISOString?.() ?? null, connectedAt: value.connectedAt?.toDate?.()?.toISOString?.() ?? null, peer: { publicProfileId: profile.docs[0]?.id ?? "", fullName: peer.fullName ?? "SuccessPro member", headline: peer.headline ?? "", location: peer.location ?? "" } }; }));
  return NextResponse.json({ connections }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to connect with this member." }, { status: 401 });
  const rate = await consumeRateLimit(user.uid, { feature: "connection-request", limit: 20, windowSeconds: 86_400 }); if (!rate.allowed) return NextResponse.json({ error: "You have sent several connection requests today. Try again tomorrow." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const body = await request.json().catch(() => null) as { publicProfileId?: unknown } | null; const publicProfileId = typeof body?.publicProfileId === "string" ? body.publicProfileId : ""; if (!/^sp-[a-f0-9]{16}$/.test(publicProfileId)) return NextResponse.json({ error: "Choose a valid member profile." }, { status: 400 });
  const publicProfile = await adminDb.collection("public_profiles").doc(publicProfileId).get(); const recipientId = String(publicProfile.data()?.ownerId ?? ""); if (!publicProfile.exists || !publicProfile.data()?.published || !recipientId) return NextResponse.json({ error: "This member profile is unavailable." }, { status: 404 }); if (recipientId === user.uid) return NextResponse.json({ error: "You cannot connect with yourself." }, { status: 400 });
  const conversations = await adminDb.collection("conversations").where("participantIds", "array-contains", user.uid).limit(500).get(); const blocked = conversations.docs.some((doc) => { const value = doc.data(); return Array.isArray(value.participantIds) && value.participantIds.includes(recipientId) && Array.isArray(value.blockedBy) && value.blockedBy.length > 0; }); if (blocked) return NextResponse.json({ error: "A connection request is not available for this member." }, { status: 403 });
  const id = connectionId(user.uid, recipientId); const reference = adminDb.collection("connections").doc(id); const created = await adminDb.runTransaction(async (transaction) => { const existing = await transaction.get(reference); if (existing.exists && ["pending", "accepted"].includes(String(existing.data()?.status))) return false; transaction.set(reference, { id, participantIds: [user.uid, recipientId].sort(), requesterId: user.uid, recipientId, status: "pending", requestedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), connectedAt: null, schemaVersion: 1 }); return true; });
  if (!created) return NextResponse.json({ error: "A connection request or connection already exists." }, { status: 409 });
  await createNotification({ ownerId: recipientId, category: "career", title: "New connection request", message: "A SuccessPro member would like to connect with you.", href: "/network", dedupeKey: `connection-request-${id}` }).catch(() => undefined);
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
