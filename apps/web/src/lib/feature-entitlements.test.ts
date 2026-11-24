import { describe, expect, it } from "vitest";
import { PLAN_ENTITLEMENTS } from "@successpro/domain";
import { featureAvailable, featureValue, normalizeEntitlements } from "./feature-entitlements";

describe("central feature entitlements", () => {
  it("covers every requested feature and rejects unsafe overrides", () => {
    const value = normalizeEntitlements({ atsReviewsPerMonth: 12, detailedAnalysesPerMonth: -1, resumeBuilder: true, jobSearch: false, rewriteCreditsPerMonth: 999_999 }, PLAN_ENTITLEMENTS.free);
    expect(featureValue(value, "resumeReviews")).toBe(12);
    expect(featureValue(value, "detailedReports")).toBe(0);
    expect(featureValue(value, "resumeBuilder")).toBe(true);
    expect(featureValue(value, "jobSearch")).toBe(false);
    expect(featureValue(value, "salaryAnalyses")).toBe(0);
    expect(featureValue(value, "contacts")).toBe(3);
    expect(featureValue(value, "rewriteCredits")).toBe(0);
    expect(featureAvailable({ entitlements: value }, "rewriteCredits")).toBe(false);
  });
});
