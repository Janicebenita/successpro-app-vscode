export function razorpayOrderPayload(input: { amount: number; currency: string; internalOrderId: string; addonId: string }) {
  return {
    amount: input.amount,
    currency: input.currency,
    receipt: input.internalOrderId.slice(0, 40),
    notes: { internal_order_id: input.internalOrderId, addon_id: input.addonId },
  };
}
