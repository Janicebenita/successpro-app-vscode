import { describe, expect, it } from "vitest";
import {
  calculateMAE,
  calculatePrecisionRecallF1,
  calculateSpearmanRankCorrelation,
  runBenchmarkSuite,
  benchmarkResumeDataset,
} from "@successpro/domain";

describe("Validation Framework Metrics", () => {
  it("computes precision, recall, and F1 safely without zero division", () => {
    const zeroCase = calculatePrecisionRecallF1(0, 0, 0);
    expect(zeroCase.precision).toBe(1.0);
    expect(zeroCase.recall).toBe(1.0);
    expect(zeroCase.f1).toBe(1.0);

    const normalCase = calculatePrecisionRecallF1(8, 10, 10);
    expect(normalCase.precision).toBe(0.8);
    expect(normalCase.recall).toBe(0.8);
    expect(normalCase.f1).toBe(0.8);
  });

  it("calculates Mean Absolute Error correctly", () => {
    const mae = calculateMAE([80, 90, 70], [85, 88, 72]);
    expect(mae).toBe(3); // (|80-85| + |90-88| + |70-72|) / 3 = (5 + 2 + 2) / 3 = 3
  });

  it("calculates Spearman rank correlation accurately", () => {
    const perfectRank = calculateSpearmanRankCorrelation([10, 20, 30, 40], [100, 200, 300, 400]);
    expect(perfectRank).toBe(1.0);

    const invertedRank = calculateSpearmanRankCorrelation([10, 20, 30, 40], [400, 300, 200, 100]);
    expect(invertedRank).toBe(-1.0);
  });

  it("runs the 30-resume benchmark suite and verifies high correlation and zero variance", () => {
    expect(benchmarkResumeDataset.length).toBeGreaterThanOrEqual(30);

    const report = runBenchmarkSuite();
    expect(report.totalResumesAnalyzed).toBeGreaterThanOrEqual(30);
    expect(report.extractionMetrics.precision).toBeGreaterThan(0.85);
    expect(report.extractionMetrics.recall).toBeGreaterThan(0.85);
    expect(report.extractionMetrics.f1).toBeGreaterThan(0.85);

    // Human score rank correlation
    expect(report.scoreAgreement.spearmanRankCorrelation).toBeGreaterThan(0.70);
    // Score variance across repeated evaluations must be 0 (deterministic)
    expect(report.scoreAgreement.scoreVarianceAcrossRuns).toBe(0);
    // MAE within expected band
    expect(report.scoreAgreement.meanAbsoluteError).toBeLessThan(20);
  });
});
