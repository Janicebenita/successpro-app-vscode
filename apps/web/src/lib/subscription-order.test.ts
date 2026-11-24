import { describe, expect, it } from "vitest";
import { razorpaySubscriptionPayload } from "./subscription-order";

describe("subscription provider payload", () => {
  it.each([["premium-monthly", 100], ["premium-quarterly", 40], ["premium-annual", 10]] as const)("creates a long renew-until-cancelled %s term", (planId, totalCount) => {
    const payload = razorpaySubscriptionPayload({ planId, providerPlanId: "plan_test123", internalSubscriptionId: "internal-sub-123" });
    expect(payload).toMatchObject({ plan_id: "plan_test123", total_count: totalCount, quantity: 1, customer_notify: true });
    expect(JSON.stringify(payload)).not.toContain("email");
    expect(JSON.stringify(payload)).not.toContain("ownerId");
  });
});
