import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";

export const productEventNames = [
  "session_signed_in",
  "resume_uploaded",
  "review_completed",
  "ai_run_completed",
  "job_search_completed",
  "job_feed_generated",
  "payment_event_received",
  "support_ticket_created",
] as const;

export type ProductEventName = typeof productEventNames[number];
type Outcome = "success" | "failed" | "fallback" | "empty" | "processing";
type ProductEvent = {
  ownerId?: string;
  name: ProductEventName;
  outcome: Outcome;
  durationMs?: number;
  count?: number;
  source?: "pdf" | "doc" | "docx" | "txt" | "razorpay" | "scheduled" | "manual" | "cache" | "provider" | "rules";
  task?: string;
  provider?: string;
  fallbackDepth?: number;
};

function boundedInteger(value: number | undefined, maximum: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.round(value!))) : undefined;
}

function boundedLabel(value: string | undefined) {
  return value?.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || undefined;
}

export function safeProductEvent(input: ProductEvent) {
  return {
    name: input.name,
    outcome: input.outcome,
    ...(input.ownerId ? { ownerId: input.ownerId } : {}),
    ...(input.durationMs === undefined ? {} : { durationMs: boundedInteger(input.durationMs, 300_000) }),
    ...(input.count === undefined ? {} : { count: boundedInteger(input.count, 100_000) }),
    ...(input.source ? { source: input.source } : {}),
    ...(input.task ? { task: boundedLabel(input.task) } : {}),
    ...(input.provider ? { provider: boundedLabel(input.provider) } : {}),
    ...(input.fallbackDepth === undefined ? {} : { fallbackDepth: boundedInteger(input.fallbackDepth, 20) }),
    schemaVersion: 1,
  };
}

export async function recordProductEvent(input: ProductEvent) {
  const reference = adminDb.collection("product_events").doc();
  await reference.set({ id: reference.id, ...safeProductEvent(input), createdAt: FieldValue.serverTimestamp() });
}

export function productTelemetrySummary(records: Array<{ name?: unknown; outcome?: unknown; durationMs?: unknown; createdAtMs?: unknown }>, nowMs = Date.now()) {
  const recent = records.filter((record) => typeof record.createdAtMs === "number" && record.createdAtMs >= nowMs - 86_400_000);
  const count = (name: ProductEventName) => recent.filter((record) => record.name === name).length;
  const ai = recent.filter((record) => record.name === "ai_run_completed");
  const latencies = recent.map((record) => typeof record.durationMs === "number" ? record.durationMs : null).filter((value): value is number => value !== null).sort((a, b) => a - b);
  return {
    uploads: count("resume_uploaded"),
    reviews: count("review_completed"),
    jobSearches: count("job_search_completed"),
    paymentEvents: count("payment_event_received"),
    aiRuns: ai.length,
    aiFallbacks: ai.filter((record) => record.outcome === "fallback").length,
    medianLatencyMs: latencies.length ? latencies[Math.floor(latencies.length / 2)] : null,
  };
}
