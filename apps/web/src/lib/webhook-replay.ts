export const WEBHOOK_REPLAY_MAX_ATTEMPTS = 5;

export function webhookReplayEligibility(value: { processingResult?: unknown; processingAttempts?: unknown; providerOrderId?: unknown; providerSubscriptionId?: unknown }) {
  const result = String(value.processingResult ?? "");
  const attempts = Number(value.processingAttempts ?? 0);
  if (result !== "unmatched" && result !== "failed") return { allowed: false as const, reason: "Only unmatched or failed events can be replayed." };
  if (!Number.isInteger(attempts) || attempts < 0 || attempts >= WEBHOOK_REPLAY_MAX_ATTEMPTS) return { allowed: false as const, reason: "This event has reached the replay-attempt limit." };
  const orderId = typeof value.providerOrderId === "string" ? value.providerOrderId.trim() : "";
  const subscriptionId = typeof value.providerSubscriptionId === "string" ? value.providerSubscriptionId.trim() : "";
  if (!orderId && !subscriptionId) return { allowed: false as const, reason: "This event has no provider record identifier." };
  return { allowed: true as const, attempts };
}
