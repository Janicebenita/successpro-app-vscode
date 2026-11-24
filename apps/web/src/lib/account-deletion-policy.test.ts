import { describe, expect, it } from "vitest";
import { anonymizeConversationForDeletedAccount, DELETE_DIRECT_COLLECTIONS, DELETE_OWNER_COLLECTIONS } from "./account-deletion-policy";

describe("account deletion policy", () => {
  it("queries compound-ID quota and velocity records by owner", () => {
    expect(DELETE_OWNER_COLLECTIONS).toContain("usage_allowances");
    expect(DELETE_OWNER_COLLECTIONS).toContain("rate_limits");
    expect(DELETE_OWNER_COLLECTIONS).toContain("ai_cache");
    expect(DELETE_OWNER_COLLECTIONS).toContain("feed_events");
    expect(DELETE_OWNER_COLLECTIONS).toContain("feed_reactions");
    expect(DELETE_DIRECT_COLLECTIONS).not.toContain("usage_allowances");
  });

  it("removes a deleted identity from every shared-conversation identity field", () => {
    const result = anonymizeConversationForDeletedAccount({
      participantIds: ["deleted-user", "remaining-user"],
      initiatedBy: "deleted-user",
      recipientPublicProfileId: "sp-0123456789abcdef",
      lastMessageSenderId: "deleted-user",
      lastMessagePreview: "My private message",
      readMessageIds: { "deleted-user": "m2", "remaining-user": "m1" },
      readAtByParticipant: { "deleted-user": "yesterday", "remaining-user": "today" },
      blockedBy: ["deleted-user", "remaining-user"],
    }, "deleted-user", "deleted-anonymous-reference");

    expect(result).toEqual({
      participantIds: ["remaining-user", "deleted-anonymous-reference"],
      initiatedBy: "deleted-anonymous-reference",
      recipientPublicProfileId: null,
      lastMessageSenderId: "deleted-anonymous-reference",
      lastMessagePreview: "Message removed after account deletion.",
      readMessageIds: { "remaining-user": "m1" },
      readAtByParticipant: { "remaining-user": "today" },
      blockedBy: ["remaining-user"],
    });
    expect(JSON.stringify(result)).not.toContain("deleted-user");
    expect(JSON.stringify(result)).not.toContain("My private message");
  });

  it("preserves the surviving member's last-message summary", () => {
    const result = anonymizeConversationForDeletedAccount({
      participantIds: ["deleted-user", "remaining-user"],
      initiatedBy: "remaining-user",
      lastMessageSenderId: "remaining-user",
      lastMessagePreview: "Surviving member message",
    }, "deleted-user", "deleted-anonymous-reference");
    expect(result.lastMessageSenderId).toBe("remaining-user");
    expect(result.lastMessagePreview).toBe("Surviving member message");
  });
});
