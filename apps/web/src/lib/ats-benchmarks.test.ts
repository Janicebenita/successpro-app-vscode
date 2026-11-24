import { describe, expect, it } from "vitest";
import { runComprehensiveAtsBenchmark } from "@successpro/domain";

const cleanSingleColumnResume = `
Jordan Lee
jordan.lee@example.com | (555) 123-4567 | linkedin.com/in/jordanlee
PROFESSIONAL SUMMARY
Senior Software Engineer with 7 years of distributed systems engineering.
EXPERIENCE
Staff Engineer | Acme Corp (2021 - Present)
- Architected high-throughput message streaming processing 2M events/sec.
Senior Engineer | Beta Tech (2018 - 2021)
- Led microservice migration reducing latency by 35%.
EDUCATION
B.S. in Computer Science | State University (2014 - 2018)
SKILLS
Go, Python, Kubernetes, Redis, MySQL, Distributed Systems
`;

const riskyMultiColumnResume = `
Alex Morgan
alex@example.com
Side Column:
Skills: React, Node.js
Main Content:
Software developer with experience. No formal dates provided.
`;

const scannedImageResume = `
[Scanned / Image Only]
`;

describe("ATS Vendor Benchmarking Adapters", () => {
  it("evaluates clean single-column resume with high compliance across all ATS vendors", () => {
    const report = runComprehensiveAtsBenchmark({ text: cleanSingleColumnResume });
    expect(report.overallAtsReadinessScore).toBeGreaterThanOrEqual(90);
    expect(report.vendorBenchmarks.greenhouse.complianceScore).toBeGreaterThanOrEqual(90);
    expect(report.vendorBenchmarks.lever.complianceScore).toBeGreaterThanOrEqual(90);
    expect(report.vendorBenchmarks.workday.complianceScore).toBeGreaterThanOrEqual(90);
    expect(report.commonPitfalls).toHaveLength(0);
  });

  it("penalizes multi-column and missing dates according to vendor parsing behaviors", () => {
    const report = runComprehensiveAtsBenchmark({
      text: riskyMultiColumnResume,
      documentSignals: { multiColumn: true, tableHeavy: false },
    });
    expect(report.overallAtsReadinessScore).toBeLessThanOrEqual(75);
    expect(report.vendorBenchmarks.lever.riskDeductions.some((d) => d.rule === "MULTI_COLUMN_READING_ORDER")).toBe(true);
    expect(report.vendorBenchmarks.workday.riskDeductions.some((d) => d.rule === "WORKDAY_DATE_GRID")).toBe(true);
  });

  it("severely penalizes flat scanned images that fail text extraction", () => {
    const report = runComprehensiveAtsBenchmark({
      text: scannedImageResume,
      documentSignals: { imageOnly: true },
    });
    expect(report.overallAtsReadinessScore).toBeLessThanOrEqual(25);
    expect(report.vendorBenchmarks.greenhouse.extractionSuccess).toBe(false);
    expect(report.vendorBenchmarks.lever.extractionSuccess).toBe(false);
    expect(report.vendorBenchmarks.workday.extractionSuccess).toBe(false);
    expect(report.unsupportedFormats).toContain("Scanned image PDF");
  });
});
