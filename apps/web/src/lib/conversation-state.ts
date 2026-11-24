export function isConversationUnread(conversation: Record<string, unknown>, uid: string) {
  const lastMessageId = typeof conversation.lastMessageId === "string" ? conversation.lastMessageId : "";
  const lastMessageSenderId = typeof conversation.lastMessageSenderId === "string" ? conversation.lastMessageSenderId : "";
  const readMessageIds = conversation.readMessageIds && typeof conversation.readMessageIds === "object" ? conversation.readMessageIds as Record<string, unknown> : {};
  return Boolean(lastMessageId && lastMessageSenderId && lastMessageSenderId !== uid && readMessageIds[uid] !== lastMessageId);
}
