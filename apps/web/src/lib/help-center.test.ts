import { describe, expect, it } from "vitest";
import { helpArticles, mandatoryHumanEscalation, supportCategories, supportPriority } from "./help-center";

describe("help and human escalation policy", () => {
  it("routes every high-stakes category to a person", () => {
    for (const category of ["privacy-grievance", "security-concern", "payment-dispute", "data-correction", "abuse", "mentor-conflict"] as const) expect(mandatoryHumanEscalation.has(category)).toBe(true);
    expect(supportPriority("security-concern")).toBe("urgent");
    expect(supportPriority("product-help")).toBe("normal");
  });
  it("has searchable coverage for every current product help area", () => {
    expect(helpArticles.length).toBeGreaterThanOrEqual(10);
    expect(supportCategories).toContain("privacy-grievance");
    expect(helpArticles.some((article) => article.category === "Resume Checker")).toBe(true);
    expect(helpArticles.some((article) => article.category === "Privacy")).toBe(true);
  });
});
