export type PaymentState = "created" | "processing" | "failed" | "paid" | "refunded" | "disputed";

const precedence: Record<PaymentState, number> = { created: 0, processing: 1, failed: 2, paid: 3, disputed: 4, refunded: 5 };

export function normalizedPaymentState(eventType: string): PaymentState | null {
  if (["payment.captured", "order.paid", "subscription.activated", "subscription.charged"].includes(eventType)) return "paid";
  if (eventType.includes("refund") && (eventType.includes("processed") || eventType.includes("created"))) return "refunded";
  if (eventType.includes("dispute") || eventType.includes("chargeback")) return "disputed";
  if (eventType.includes("failed")) return "failed";
  if (["payment.authorized", "order.created", "subscription.authenticated", "subscription.pending"].includes(eventType)) return "processing";
  return null;
}

export function transitionPaymentState(current: unknown, eventType: string) {
  const present: PaymentState = typeof current === "string" && current in precedence ? current as PaymentState : "created";
  const incoming = normalizedPaymentState(eventType);
  if (!incoming || precedence[incoming] < precedence[present]) return { state: present, changed: false, ignoredAsStale: Boolean(incoming) };
  return { state: incoming, changed: incoming !== present, ignoredAsStale: false };
}
