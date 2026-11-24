import { adminDb } from "./firebase-admin";
import { chronologicalFeed } from "./feed";
import type { FeedAttachment } from "./feed-attachments";

type StoredFeedEvent = { id: string; ownerId: string; category: string; title: string; details: string; attachment?: FeedAttachment | null; reactionCounts: { celebrate: number; support: number; insightful: number }; createdAt: string | null; createdAtMs: number };

export async function canViewFeedEvent(viewerId: string, ownerId: string) {
  if (viewerId === ownerId) return true;
  const connections = await adminDb.collection("connections").where("participantIds", "array-contains", viewerId).limit(500).get();
  return connections.docs.some((doc) => {
    const value = doc.data();
    return value.status === "accepted" && Array.isArray(value.participantIds) && value.participantIds.includes(ownerId) && !(Array.isArray(value.mutedBy) && value.mutedBy.includes(viewerId));
  });
}

export async function feedForUser(ownerId: string) {
  const connectionSnapshot = await adminDb.collection("connections").where("participantIds", "array-contains", ownerId).limit(500).get();
  const accepted = connectionSnapshot.docs.filter((doc) => doc.data().status === "accepted");
  const connectionByPeer = new Map<string, { id: string; muted: boolean }>();
  for (const doc of accepted) {
    const value = doc.data();
    const peerId = (value.participantIds as string[]).find((id) => id !== ownerId);
    if (peerId) connectionByPeer.set(peerId, { id: doc.id, muted: Array.isArray(value.mutedBy) && value.mutedBy.includes(ownerId) });
  }
  const authorIds = new Set([ownerId, ...[...connectionByPeer].filter(([, value]) => !value.muted).map(([peerId]) => peerId)]);
  const snapshot = await adminDb.collection("feed_events").orderBy("createdAt", "desc").limit(500).get();
  const raw: StoredFeedEvent[] = snapshot.docs.filter((doc) => authorIds.has(String(doc.data().ownerId))).map((doc) => { const value = doc.data(); const attachment = value.attachment && typeof value.attachment === "object" ? value.attachment as FeedAttachment : null; return { id: doc.id, ownerId: String(value.ownerId ?? ""), category: String(value.category ?? "career-milestone"), title: String(value.title ?? ""), details: String(value.details ?? ""), attachment, reactionCounts: { celebrate: Number(value.reactionCounts?.celebrate ?? 0), support: Number(value.reactionCounts?.support ?? 0), insightful: Number(value.reactionCounts?.insightful ?? 0) }, createdAtMs: value.createdAt?.toMillis?.() ?? 0, createdAt: value.createdAt?.toDate?.()?.toISOString?.() ?? null }; });
  const ownerIds = [...new Set(raw.map((event) => String(event.ownerId)))];
  const profiles = await Promise.all(ownerIds.map(async (profileOwnerId) => {
    const matches = await adminDb.collection("public_profiles").where("ownerId", "==", profileOwnerId).limit(5).get();
    const profile = matches.docs.find((doc) => doc.data().published);
    const value = profile?.data() ?? {};
    return [profileOwnerId, { publicProfileId: profile?.id ?? "", fullName: value.fullName ?? "SuccessPro member", headline: value.headline ?? "" }] as const;
  }));
  const reactions = await adminDb.collection("feed_reactions").where("ownerId", "==", ownerId).limit(1_000).get();
  const myReactions = new Map(reactions.docs.map((doc) => [String(doc.data().eventId), String(doc.data().reaction)]));
  const profileMap = new Map(profiles);
  return chronologicalFeed(raw).map((event) => ({ ...event, author: profileMap.get(String(event.ownerId)), connectionId: connectionByPeer.get(String(event.ownerId))?.id ?? null, myReaction: myReactions.get(event.id) ?? null, createdAtMs: undefined }));
}
