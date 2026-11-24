import { describe, expect, it } from "vitest";
import { extractCanonicalProfile } from "@successpro/domain";

describe("canonical profile extraction", () => {
  it("creates a reviewable draft from a labelled resume", () => {
    const result = extractCanonicalProfile(`Avery Patel
Product Analyst
avery@example.com | +91 98765 43210
Professional Summary
Product analyst focused on measurable activation and retention improvements.
Experience
Senior Product Analyst | Northstar Systems | 2023 - Present
Improved activation by 24% across three markets.
Education
B.Tech Information Technology | Example University | 2016 - 2020
Skills: SQL, Product analytics, Experimentation`);

    expect(result.draft.fullName).toBe("Avery Patel");
    expect(result.draft.currentRole).toBe("Senior Product Analyst");
    expect(result.draft.skills).toContain("SQL");
    expect(result.draft.experience).toHaveLength(1);
    expect(result.draft.education).toHaveLength(1);
    expect(result.confidence).not.toBe("low");
  });

  it("flags sparse text instead of inventing career records", () => {
    const result = extractCanonicalProfile("Resume content without labelled sections and very little structure.");
    expect(result.draft.experience).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
