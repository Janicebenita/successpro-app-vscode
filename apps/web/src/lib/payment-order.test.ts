import { describe, expect, it } from "vitest";
import { razorpayOrderPayload } from "./payment-order";

describe("payment-provider data minimization", () => {
  it("sends only non-personal order references to Razorpay", () => {
    const payload = razorpayOrderPayload({ amount: 1_000_000, currency: "INR", internalOrderId: "internal-order-123", addonId: "resume-writer" });
    expect(payload.notes).toEqual({ internal_order_id: "internal-order-123", addon_id: "resume-writer" });
    expect(JSON.stringify(payload)).not.toContain("owner");
    expect(JSON.stringify(payload)).not.toContain("email");
  });
});
