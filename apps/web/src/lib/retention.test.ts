import { describe, expect, it } from "vitest";
import { RETENTION_RULES, retentionCutoff } from "./retention";

describe("retention policy", () => {
  const now = new Date("2026-09-24T12:30:00.000Z");

  it("defines a bounded rule for every temporary operational data class", () => {
    expect(RETENTION_RULES.map((rule) => rule.collection)).toEqual(expect.arrayContaining(["ai_cache", "rate_limits", "contact_match_consents", "job_refresh_requests", "daily_job_feeds", "ai_runs", "jobs", "document_draft_versions", "resume_transform_versions", "usage_allowances", "usage_ledger"]));
    expect(RETENTION_RULES.every((rule) => rule.days >= 0 && Boolean(rule.purpose))).toBe(true);
  });

  it("uses type-correct UTC cutoffs for Firestore timestamps and ISO fields", () => {
    const cache = RETENTION_RULES.find((rule) => rule.collection === "ai_cache")!;
    const jobs = RETENTION_RULES.find((rule) => rule.collection === "jobs")!;
    const drafts = RETENTION_RULES.find((rule) => rule.collection === "document_draft_versions")!;
    expect(retentionCutoff(cache, now)).toBe("2026-09-24T12:30:00.000Z");
    expect(retentionCutoff(jobs, now)).toBe("2026-06-26");
    expect(retentionCutoff(drafts, now)).toEqual(new Date("2026-03-28T12:30:00.000Z"));
  });
});
