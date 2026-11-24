import { describe, expect, it } from "vitest";
import { rateLimitDecision, rateLimitWindow } from "./rate-limit";

describe("rate-limit windows", () => {
  it("creates deterministic UTC windows without storing raw user identifiers in document IDs", () => {
    const policy = { feature: "resume-upload", limit: 5, windowSeconds: 60 };
    expect(rateLimitWindow(policy, Date.parse("2026-09-24T00:00:42Z"))).toEqual({
      startsAt: Date.parse("2026-09-24T00:00:00Z"),
      resetAt: Date.parse("2026-09-24T00:01:00Z"),
      key: `resume-upload:${Date.parse("2026-09-24T00:00:00Z")}`,
    });
  });

  it("permits exactly the configured number of attempts and rejects the next one", () => {
    expect(rateLimitDecision(0, 2)).toEqual({ allowed: true, nextCount: 1 });
    expect(rateLimitDecision(1, 2)).toEqual({ allowed: true, nextCount: 2 });
    expect(rateLimitDecision(2, 2)).toEqual({ allowed: false, nextCount: 2 });
  });
});
