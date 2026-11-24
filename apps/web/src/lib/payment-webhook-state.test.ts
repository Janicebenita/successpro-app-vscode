import { describe, expect, it } from "vitest";
import { normalizedPaymentState, transitionPaymentState } from "./payment-webhook-state";

describe("Razorpay event state normalization", () => {
  it("normalizes known lifecycle events", () => {
    expect(normalizedPaymentState("payment.captured")).toBe("paid");
    expect(normalizedPaymentState("payment.failed")).toBe("failed");
    expect(normalizedPaymentState("refund.processed")).toBe("refunded");
    expect(normalizedPaymentState("payment.unknown")).toBeNull();
  });

  it("does not regress paid state when delayed events arrive", () => {
    expect(transitionPaymentState("paid", "payment.authorized")).toEqual({ state: "paid", changed: false, ignoredAsStale: true });
    expect(transitionPaymentState("paid", "payment.failed")).toEqual({ state: "paid", changed: false, ignoredAsStale: true });
  });

  it("allows recovery and terminal post-payment events", () => {
    expect(transitionPaymentState("failed", "payment.captured").state).toBe("paid");
    expect(transitionPaymentState("paid", "refund.processed").state).toBe("refunded");
  });
});
