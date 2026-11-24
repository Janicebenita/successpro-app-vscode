export type UsageEntry = { occurredAt: Date; outcome: "completed" | "parse_failed" | "system_failed" };

export function monthlyCompletedReviews(entries: UsageEntry[], now: Date) {
  return entries.filter((entry) => entry.outcome === "completed" && entry.occurredAt.getUTCFullYear() === now.getUTCFullYear() && entry.occurredAt.getUTCMonth() === now.getUTCMonth()).length;
}

export function canStartFreeReview(entries: UsageEntry[], now: Date, limit = 3) {
  const used = monthlyCompletedReviews(entries, now);
  return { allowed: used < limit, used, remaining: Math.max(0, limit - used), limit };
}
