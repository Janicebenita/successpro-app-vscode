import { describe, expect, it } from "vitest";
import { normalizedSubscriptionState, subscriptionAccessUpdate } from "./subscription-state";

describe("subscription state", () => {
  it("normalizes charged, failed, cancelled, and completed events", () => {
    expect(normalizedSubscriptionState("subscription.charged")).toBe("active");
    expect(normalizedSubscriptionState("payment.failed", "halted")).toBe("past_due");
    expect(normalizedSubscriptionState("subscription.cancelled")).toBe("cancelled");
    expect(normalizedSubscriptionState("subscription.completed")).toBe("completed");
  });

  it("grants only verified active paid-through access", () => {
    expect(subscriptionAccessUpdate({ eventType: "subscription.charged", currentEnd: 2_000, nowSeconds: 1_000 })).toMatchObject({ grantAccess: true, activeUntilSeconds: 2_000, renewalEnabled: true });
    expect(subscriptionAccessUpdate({ eventType: "subscription.charged", currentEnd: 500, nowSeconds: 1_000 }).grantAccess).toBe(false);
  });

  it("preserves paid-through access when renewal is cancelled", () => {
    expect(subscriptionAccessUpdate({ eventType: "subscription.cancelled", currentEnd: 2_000, nowSeconds: 1_000 })).toMatchObject({ state: "cancelled", preservePaidThrough: true, renewalEnabled: false });
  });
});
