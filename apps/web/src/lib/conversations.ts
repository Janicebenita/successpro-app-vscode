import { adminDb } from "@/lib/firebase-admin";
import { isConversationUnread } from "@/lib/conversation-state";

export type ConversationSummary = { id: string; peerName: string; lastMessage: string; updatedAt: string | null; blocked: boolean; unread: boolean };

export async function conversationSummaries(uid: string): Promise<ConversationSummary[]> {
  const snapshot = await adminDb.collection("conversations").where("participantIds", "array-contains", uid).limit(50).get();
  const conversations = snapshot.docs.map((document) => document.data());
  const peerIds = [...new Set(conversations.flatMap((conversation) => conversation.participantIds as string[]).filter((id) => id !== uid))];
  const peerSnapshots = peerIds.length ? await adminDb.getAll(...peerIds.map((id) => adminDb.collection("users").doc(id))) : [];
  const peers = new Map(peerSnapshots.map((document) => [document.id, document.data()]));
  return conversations.map((conversation) => {
    const peerId = (conversation.participantIds as string[]).find((id) => id !== uid) ?? "";
    return {
      id: conversation.id,
      peerName: peers.get(peerId)?.displayName ?? "SuccessPro member",
      lastMessage: conversation.lastMessagePreview ?? "Open this conversation to read the messages.",
      updatedAt: conversation.updatedAt?.toDate?.()?.toISOString?.() ?? null,
      blocked: Array.isArray(conversation.blockedBy) && conversation.blockedBy.length > 0,
      unread: isConversationUnread(conversation, uid),
    };
  }).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
