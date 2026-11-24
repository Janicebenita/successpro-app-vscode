import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";

export type RateLimitPolicy = { feature: string; limit: number; windowSeconds: number };
export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number; resetAt: string };

export function rateLimitWindow(policy: RateLimitPolicy, now = Date.now()) {
  const windowMs = policy.windowSeconds * 1_000;
  const startsAt = Math.floor(now / windowMs) * windowMs;
  return { startsAt, resetAt: startsAt + windowMs, key: `${policy.feature}:${startsAt}` };
}

export function rateLimitDecision(current: number, limit: number) {
  return current >= limit ? { allowed: false, nextCount: current } : { allowed: true, nextCount: current + 1 };
}

export async function consumeRateLimit(ownerId: string, policy: RateLimitPolicy, now = Date.now()): Promise<RateLimitResult> {
  const window = rateLimitWindow(policy, now);
  const id = createHash("sha256").update(`${ownerId}:${window.key}`).digest("hex");
  const reference = adminDb.collection("rate_limits").doc(id);
  const count = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = Number(snapshot.data()?.count ?? 0);
    const decision = rateLimitDecision(current, policy.limit);
    if (!decision.allowed) return -1;
    transaction.set(reference, { ownerId, feature: policy.feature, startsAt: new Date(window.startsAt).toISOString(), expiresAt: new Date(window.resetAt + 86_400_000).toISOString(), count: decision.nextCount, updatedAt: FieldValue.serverTimestamp(), schemaVersion: 1 }, { merge: true });
    return decision.nextCount;
  });
  return {
    allowed: count >= 0,
    remaining: count < 0 ? 0 : Math.max(0, policy.limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1_000)),
    resetAt: new Date(window.resetAt).toISOString(),
  };
}
