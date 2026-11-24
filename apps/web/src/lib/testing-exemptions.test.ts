import { afterEach, describe, expect, it } from "vitest";
import { hasResumeReviewTestExemption, normalizedEmailSet } from "./testing-exemptions";

describe("Resume Checker testing exemptions", () => {
  const previous = process.env.SUCCESSPRO_RESUME_REVIEW_EXEMPT_EMAILS;
  afterEach(() => { if (previous === undefined) delete process.env.SUCCESSPRO_RESUME_REVIEW_EXEMPT_EMAILS; else process.env.SUCCESSPRO_RESUME_REVIEW_EXEMPT_EMAILS = previous; });

  it("normalizes an explicit comma-separated allowlist", () => {
    expect([...normalizedEmailSet(" Tester@Example.com,second@example.com ")]).toEqual(["tester@example.com", "second@example.com"]);
  });

  it("requires both a verified email and an exact allowlist match", () => {
    process.env.SUCCESSPRO_RESUME_REVIEW_EXEMPT_EMAILS = "deepakjosey@gmail.com";
    expect(hasResumeReviewTestExemption({ email: "DeepakJosey@gmail.com", email_verified: true })).toBe(true);
    expect(hasResumeReviewTestExemption({ email: "deepakjosey@gmail.com", email_verified: false })).toBe(false);
    expect(hasResumeReviewTestExemption({ email: "other@gmail.com", email_verified: true })).toBe(false);
  });
});
