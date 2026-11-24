import { describe, expect, it } from "vitest";
import { analyseSalaryResearch } from "@successpro/domain";
import type { SalaryResearch } from "@successpro/contracts";

const base: SalaryResearch = { role: "Product Manager", location: "Bengaluru", yearsExperience: 8, industry: "Software", companySize: "large", skills: ["Product strategy"], education: "MBA", currentCompensation: 2_500_000, targetCompensation: 3_200_000, currency: "INR", sources: [], searchSuggestionHtml: "" };

describe("salary research", () => {
  it("refuses to invent a range without sources", () => {
    expect(analyseSalaryResearch(base, new Date("2026-09-23T00:00:00Z"))).toMatchObject({ available: false, range: null, confidence: "not available" });
  });

  it("uses the median of dated, user-confirmed source ranges", () => {
    const sources = [
      { id: "a", name: "Source A", url: "https://example.com/a", publishedOn: "2026-01-01", dateBasis: "published" as const, low: 2_400_000, midpoint: 3_000_000, high: 3_600_000 },
      { id: "b", name: "Source B", url: "https://example.org/b", publishedOn: "2025-12-01", dateBasis: "published" as const, low: 2_600_000, midpoint: 3_200_000, high: 3_800_000 },
      { id: "c", name: "Source C", url: "https://example.net/c", publishedOn: "2026-02-01", dateBasis: "published" as const, low: 2_500_000, midpoint: 3_100_000, high: 3_700_000 },
    ];
    expect(analyseSalaryResearch({ ...base, sources }, new Date("2026-09-23T00:00:00Z"))).toMatchObject({ available: true, range: { low: 2_500_000, midpoint: 3_100_000, high: 3_700_000 }, confidence: "high", currentGap: 600_000, targetPosition: "within range" });
  });

  it("does not treat repeated sites or access dates as independent, fresh publications", () => {
    const sources = [
      { id: "a", name: "A", url: "https://example.com/a", publishedOn: "2026-09-23", dateBasis: "accessed" as const, low: 2_000_000, midpoint: 3_000_000, high: 4_000_000 },
      { id: "b", name: "B", url: "https://example.com/b", publishedOn: "2026-09-23", dateBasis: "accessed" as const, low: 20_000_000, midpoint: 30_000_000, high: 40_000_000 },
      { id: "c", name: "C", url: "https://another.example/c", publishedOn: "2026-09-23", dateBasis: "accessed" as const, low: 2_200_000, midpoint: 3_200_000, high: 4_200_000 },
    ];
    expect(analyseSalaryResearch({ ...base, sources }, new Date("2026-09-23T00:00:00Z"))).toMatchObject({ available: true, range: { low: 2_100_000, midpoint: 3_100_000, high: 4_100_000 }, confidence: "low" });
  });

  it("does not use one fresh report to make an older source set high confidence", () => {
    const sources = [
      { id: "a", name: "A", url: "https://example.com/a", publishedOn: "2026-01-01", dateBasis: "published" as const, low: 2_000_000, midpoint: 3_000_000, high: 4_000_000 },
      { id: "b", name: "B", url: "https://example.org/b", publishedOn: "2021-01-01", dateBasis: "published" as const, low: 2_000_000, midpoint: 3_000_000, high: 4_000_000 },
      { id: "c", name: "C", url: "https://example.net/c", publishedOn: "2021-01-01", dateBasis: "published" as const, low: 2_000_000, midpoint: 3_000_000, high: 4_000_000 },
    ];
    expect(analyseSalaryResearch({ ...base, sources }, new Date("2026-09-23T00:00:00Z")).confidence).toBe("medium");
  });

  it("treats Google grounding redirect links as distinct only when publisher names differ", () => {
    const source = (id: string, name: string) => ({ id, name, url: `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${id}`, publishedOn: "2026-09-23", dateBasis: "accessed" as const, low: 2_000_000, midpoint: 3_000_000, high: 4_000_000 });
    const analysis = analyseSalaryResearch({ ...base, sources: [source("a", "survey.example"), source("b", "survey.example"), source("c", "benchmark.example")] }, new Date("2026-09-23T00:00:00Z"));
    expect(analysis.explanation).toContain("2 independent market sources");
    expect(analysis.confidence).toBe("low");
  });
});
