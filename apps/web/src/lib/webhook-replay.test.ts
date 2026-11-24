import { describe, expect, it } from "vitest";
import { webhookReplayEligibility } from "./webhook-replay";

describe("failed webhook replay eligibility", () => {
  it("allows a bounded unmatched event with a provider identifier", () => expect(webhookReplayEligibility({ processingResult: "unmatched", processingAttempts: 1, providerOrderId: "order_1" }).allowed).toBe(true));
  it("rejects already processed and stale events", () => {
    expect(webhookReplayEligibility({ processingResult: "processed", processingAttempts: 1, providerOrderId: "order_1" }).allowed).toBe(false);
    expect(webhookReplayEligibility({ processingResult: "ignored-stale", processingAttempts: 1, providerOrderId: "order_1" }).allowed).toBe(false);
  });
  it("rejects missing identifiers and the fifth retry", () => {
    expect(webhookReplayEligibility({ processingResult: "failed", processingAttempts: 1 }).allowed).toBe(false);
    expect(webhookReplayEligibility({ processingResult: "failed", processingAttempts: 1, providerOrderId: "   " }).allowed).toBe(false);
    expect(webhookReplayEligibility({ processingResult: "failed", processingAttempts: -1, providerOrderId: "order_1" }).allowed).toBe(false);
    expect(webhookReplayEligibility({ processingResult: "failed", processingAttempts: 5, providerSubscriptionId: "sub_1" }).allowed).toBe(false);
  });
});
