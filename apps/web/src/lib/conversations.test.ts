import { describe, expect, it } from "vitest";
import { isConversationUnread } from "./conversation-state";

describe("conversation read state", () => {
  it("marks a peer's unseen latest message as unread", () => {
    expect(isConversationUnread({ lastMessageId: "message-2", lastMessageSenderId: "peer", readMessageIds: { member: "message-1" } }, "member")).toBe(true);
  });

  it("marks the latest message as read after its ID is recorded", () => {
    expect(isConversationUnread({ lastMessageId: "message-2", lastMessageSenderId: "peer", readMessageIds: { member: "message-2" } }, "member")).toBe(false);
  });

  it("does not show a member's own latest message as unread", () => {
    expect(isConversationUnread({ lastMessageId: "message-2", lastMessageSenderId: "member", readMessageIds: {} }, "member")).toBe(false);
  });

  it("keeps legacy conversations without a latest message ID readable", () => {
    expect(isConversationUnread({ lastMessageSenderId: "peer" }, "member")).toBe(false);
  });
});
