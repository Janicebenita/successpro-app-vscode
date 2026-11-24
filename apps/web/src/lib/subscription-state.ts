export type SubscriptionState = "created" | "authenticated" | "active" | "past_due" | "paused" | "cancelled" | "completed";

export function normalizedSubscriptionState(eventType: string, providerStatus?: string): SubscriptionState | null {
  if (eventType === "subscription.charged" || eventType === "subscription.activated" || providerStatus === "active") return "active";
  if (eventType === "subscription.authenticated" || providerStatus === "authenticated") return "authenticated";
  if (eventType === "subscription.pending" || eventType === "payment.failed" || providerStatus === "pending" || providerStatus === "halted") return "past_due";
  if (eventType === "subscription.paused" || providerStatus === "paused") return "paused";
  if (eventType === "subscription.cancelled" || providerStatus === "cancelled") return "cancelled";
  if (eventType === "subscription.completed" || eventType === "subscription.expired" || providerStatus === "completed" || providerStatus === "expired") return "completed";
  return null;
}

export function subscriptionAccessUpdate(input: { eventType: string; providerStatus?: string; currentEnd?: number; nowSeconds?: number }) {
  const state = normalizedSubscriptionState(input.eventType, input.providerStatus);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1_000);
  const validEnd = Number.isInteger(input.currentEnd) && Number(input.currentEnd) > now ? Number(input.currentEnd) : null;
  return {
    state,
    grantAccess: state === "active" && validEnd !== null,
    activeUntilSeconds: validEnd,
    preservePaidThrough: ["past_due", "paused", "cancelled", "completed"].includes(state ?? "") && validEnd !== null,
    renewalEnabled: !["cancelled", "completed"].includes(state ?? ""),
  };
}
