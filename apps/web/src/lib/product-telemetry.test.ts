import { describe, expect, it } from "vitest";
import { productTelemetrySummary, safeProductEvent } from "./product-telemetry";

describe("privacy-safe product telemetry", () => {
  it("stores only bounded operational dimensions", () => {
    const event = safeProductEvent({ name: "ai_run_completed", outcome: "fallback", durationMs: -5, count: 900_000, task: "review resume / ignore", provider: "provider@example.com", fallbackDepth: 99 });
    expect(event).toMatchObject({ name: "ai_run_completed", outcome: "fallback", durationMs: 0, count: 100_000, task: "review-resume---ignore", provider: "provider-example.com", fallbackDepth: 20 });
    expect(JSON.stringify(event)).not.toContain("resumeText");
  });

  it("summarizes only the most recent day without inspecting member content", () => {
    const now = Date.parse("2026-09-24T12:00:00Z");
    const summary = productTelemetrySummary([
      { name: "resume_uploaded", outcome: "success", createdAtMs: now - 1_000, durationMs: 80 },
      { name: "ai_run_completed", outcome: "fallback", createdAtMs: now - 2_000, durationMs: 120 },
      { name: "review_completed", outcome: "success", createdAtMs: now - 90_000_000, durationMs: 10 },
    ], now);
    expect(summary).toMatchObject({ uploads: 1, reviews: 0, aiRuns: 1, aiFallbacks: 1, medianLatencyMs: 120 });
  });
});
