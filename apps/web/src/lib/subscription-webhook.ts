export type SubscriptionWebhookRef = {
  providerSubscriptionId: string | null;
  internalSubscriptionId: string | null;
  providerStatus: string | undefined;
  currentEnd: number | undefined;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// Reads a Razorpay webhook body defensively. Never throws on malformed input.
export function extractSubscriptionRef(body: unknown): SubscriptionWebhookRef {
  const entity = record(record(record(record(body).payload).subscription).entity);
  const notes = record(entity.notes); // Razorpay sends [] when there are no notes
  const internal = notes.internal_subscription_id;
  return {
    providerSubscriptionId: typeof entity.id === "string" && entity.id ? entity.id : null,
    internalSubscriptionId: typeof internal === "string" && /^[A-Za-z0-9]{10,40}$/.test(internal) ? internal : null,
    providerStatus: typeof entity.status === "string" ? entity.status : undefined,
    currentEnd: typeof entity.current_end === "number" ? entity.current_end : undefined,
  };
}

// An event older than the last one applied must not overwrite newer state.
export function isStaleSubscriptionEvent(incomingCreatedAt: number, lastAppliedCreatedAt: unknown) {
  return Number.isFinite(incomingCreatedAt) && incomingCreatedAt > 0 && typeof lastAppliedCreatedAt === "number" && incomingCreatedAt < lastAppliedCreatedAt;
}
