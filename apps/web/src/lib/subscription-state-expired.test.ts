import { describe, expect, it } from "vitest";
import { normalizedSubscriptionState, subscriptionAccessUpdate } from "./subscription-state";

describe("expired subscriptions", () => {
  it("maps the expired event to the ended state", () => {
    expect(normalizedSubscriptionState("subscription.expired")).toBe("completed");
  });

  it("maps the expired provider status to the ended state", () => {
    expect(normalizedSubscriptionState("subscription.updated", "expired")).toBe("completed");
  });

  it("keeps paid-through access but stops renewal", () => {
    expect(subscriptionAccessUpdate({ eventType: "subscription.expired", currentEnd: 2_000, nowSeconds: 1_000 })).toMatchObject({ state: "completed", grantAccess: false, preservePaidThrough: true, renewalEnabled: false });
  });
});
