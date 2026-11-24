import { adminDb } from "./firebase-admin";

export type RetentionRule = {
  collection: string;
  field: string;
  days: number;
  value: "date" | "iso-date" | "iso-instant";
  purpose: string;
};

export const RETENTION_RULES: RetentionRule[] = [
  { collection: "ai_cache", field: "expiresAt", days: 0, value: "iso-instant", purpose: "Expired generated-response cache" },
  { collection: "rate_limits", field: "expiresAt", days: 0, value: "iso-instant", purpose: "Expired abuse-control windows" },
  { collection: "contact_match_consents", field: "expiresAt", days: 0, value: "date", purpose: "Expired consented contact hashes" },
  { collection: "job_refresh_requests", field: "requestedAt", days: 7, value: "date", purpose: "Short-lived refresh throttles" },
  { collection: "daily_job_feeds", field: "generatedAt", days: 30, value: "date", purpose: "Stale personalized job feeds" },
  { collection: "ai_runs", field: "createdAt", days: 90, value: "date", purpose: "AI operational metadata" },
  { collection: "jobs", field: "lastSeenOn", days: 90, value: "iso-date", purpose: "Stale employer-source job records" },
  { collection: "document_draft_versions", field: "createdAt", days: 180, value: "date", purpose: "Old document edit history" },
  { collection: "resume_transform_versions", field: "createdAt", days: 180, value: "date", purpose: "Old iterative resume transformation history" },
  { collection: "account_deletion_events", field: "completedAt", days: 365, value: "date", purpose: "De-identified deletion audit evidence" },
  { collection: "usage_allowances", field: "updatedAt", days: 730, value: "date", purpose: "Expired product allowance periods" },
  { collection: "usage_ledger", field: "createdAt", days: 730, value: "date", purpose: "Product-usage history" },
  { collection: "product_events", field: "createdAt", days: 730, value: "date", purpose: "Privacy-minimized product telemetry" },
];

export function retentionCutoff(rule: RetentionRule, now = new Date()) {
  const cutoff = new Date(now.getTime() - rule.days * 86_400_000);
  if (rule.value === "iso-date") return cutoff.toISOString().slice(0, 10);
  if (rule.value === "iso-instant") return cutoff.toISOString();
  return cutoff;
}

export async function enforceRetention(now = new Date(), maximumDeletes = 2_000) {
  const deleted: Record<string, number> = {};
  let remaining = maximumDeletes;
  for (const rule of RETENTION_RULES) {
    deleted[rule.collection] = 0;
    while (remaining > 0) {
      const limit = Math.min(200, remaining);
      const snapshot = await adminDb.collection(rule.collection).where(rule.field, "<=", retentionCutoff(rule, now)).limit(limit).get();
      if (snapshot.empty) break;
      const batch = adminDb.batch();
      snapshot.docs.forEach((document) => batch.delete(document.ref));
      await batch.commit();
      deleted[rule.collection] += snapshot.size;
      remaining -= snapshot.size;
      if (snapshot.size < limit) break;
    }
    if (remaining <= 0) break;
  }
  return { deleted, maximumDeletes, limitReached: remaining <= 0, completedAt: now.toISOString() };
}
