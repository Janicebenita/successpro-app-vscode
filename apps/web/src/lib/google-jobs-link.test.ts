import { describe, expect, it } from "vitest";
import { googleJobsSearchUrl } from "./google-jobs-link";

describe("Google Jobs discovery links", () => {
  it("builds a role, region, experience, and keyword-specific user search", () => {
    const url = new URL(googleJobsSearchUrl({ role: "Business Development", location: "New York", experienceYears: 7, keywords: ["SaaS", "enterprise sales"] }));
    expect(url.hostname).toBe("www.google.com");
    expect(url.searchParams.get("udm")).toBe("jobs");
    expect(url.searchParams.get("q")).toBe("job opportunities in New York for Business Development 7 years experience SaaS enterprise sales");
  });
});
