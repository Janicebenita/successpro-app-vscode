import type { PaidPlanId } from "./price-book";

// Renews until the user cancels. Razorpay requires a finite total_count, so these are long caps (8 to 10 years).
const cycleCounts: Record<PaidPlanId, number> = { "premium-monthly": 100, "premium-quarterly": 40, "premium-annual": 10 };

export function razorpaySubscriptionPayload(input: { planId: PaidPlanId; providerPlanId: string; internalSubscriptionId: string }) {
  return {
    plan_id: input.providerPlanId,
    total_count: cycleCounts[input.planId],
    quantity: 1,
    customer_notify: true, // Razorpay sends payment and pre-debit notices to the customer.
    notes: { internal_subscription_id: input.internalSubscriptionId, successpro_plan_id: input.planId },
  };
}
