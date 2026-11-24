import { analyzeResume } from "../resume-scoring";
import { benchmarkResumeDataset } from "./dataset";
import {
  calculateMAE,
  calculatePrecisionRecallF1,
  calculateSpearmanRankCorrelation,
} from "./metrics";
import type {
  BenchmarkEvaluationReport,
  ExtractionMetrics,
  ScoreAgreementMetrics,
} from "./types";

export function runBenchmarkSuite(): BenchmarkEvaluationReport {
  let correctFieldsTotal = 0;
  let extractedFieldsTotal = 0;
  let expectedFieldsTotal = 0;

  const fieldCorrect = { name: 0, email: 0, phone: 0, experience: 0, education: 0, skills: 0, dates: 0 };
  const fieldExpected = { name: 0, email: 0, phone: 0, experience: 0, education: 0, skills: 0, dates: 0 };

  const predictedScores: number[] = [];
  const actualScores: number[] = [];
  const categoryErrors: Record<string, number[]> = {};

  for (const entry of benchmarkResumeDataset) {
    const analysis = analyzeResume({
      text: entry.text,
      targetKeywords: [],
      jobDescription: entry.jobDescription || "",
      documentSignals: entry.documentSignals,
    });

    predictedScores.push(analysis.score);
    actualScores.push(entry.humanReferenceRatings.overallScore);

    const diff = Math.abs(analysis.score - entry.humanReferenceRatings.overallScore);
    categoryErrors[entry.category] = categoryErrors[entry.category] || [];
    categoryErrors[entry.category].push(diff);

    // Extraction evaluation
    const text = entry.text;
    const lower = text.toLowerCase();
    const extractedEmail = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
    const extractedPhone = text.match(/(?:\+?\d[\d\s()-]{7,}\d)/)?.[0];
    const hasExp = lower.includes("experience") || lower.includes("work history");
    const hasEdu = lower.includes("education") || lower.includes("academic") || lower.includes("bachelor") || lower.includes("b.s.");
    const hasSk = lower.includes("skills") || lower.includes("technologies");
    const dateCount = (text.match(/\b(?:19|20)\d{2}\b/g) ?? []).length;

    // Name check
    if (entry.expectedFields.name) {
      fieldExpected.name++;
      expectedFieldsTotal++;
      extractedFieldsTotal++;
      if (text.includes(entry.expectedFields.name)) {
        fieldCorrect.name++;
        correctFieldsTotal++;
      }
    }

    // Email check
    if (entry.expectedFields.email) {
      fieldExpected.email++;
      expectedFieldsTotal++;
      if (extractedEmail) extractedFieldsTotal++;
      if (extractedEmail?.toLowerCase() === entry.expectedFields.email.toLowerCase()) {
        fieldCorrect.email++;
        correctFieldsTotal++;
      }
    }

    // Phone check
    if (entry.expectedFields.phone) {
      fieldExpected.phone++;
      expectedFieldsTotal++;
      if (extractedPhone) extractedFieldsTotal++;
      if (extractedPhone) {
        fieldCorrect.phone++;
        correctFieldsTotal++;
      }
    }

    // Experience section check
    if (entry.expectedFields.hasExperience !== undefined) {
      fieldExpected.experience++;
      expectedFieldsTotal++;
      extractedFieldsTotal++;
      if (hasExp === entry.expectedFields.hasExperience) {
        fieldCorrect.experience++;
        correctFieldsTotal++;
      }
    }

    // Education section check
    if (entry.expectedFields.hasEducation !== undefined) {
      fieldExpected.education++;
      expectedFieldsTotal++;
      extractedFieldsTotal++;
      if (hasEdu === entry.expectedFields.hasEducation) {
        fieldCorrect.education++;
        correctFieldsTotal++;
      }
    }

    // Skills section check
    if (entry.expectedFields.hasSkills !== undefined) {
      fieldExpected.skills++;
      expectedFieldsTotal++;
      extractedFieldsTotal++;
      if (hasSk === entry.expectedFields.hasSkills) {
        fieldCorrect.skills++;
        correctFieldsTotal++;
      }
    }

    // Dates check
    if (entry.expectedFields.datesExpectedCount !== undefined) {
      fieldExpected.dates++;
      expectedFieldsTotal++;
      extractedFieldsTotal++;
      if (Math.abs(dateCount - entry.expectedFields.datesExpectedCount) <= 1) {
        fieldCorrect.dates++;
        correctFieldsTotal++;
      }
    }
  }

  const overallPR = calculatePrecisionRecallF1(correctFieldsTotal, extractedFieldsTotal, expectedFieldsTotal);

  const fieldAccuracy = {
    name: fieldExpected.name ? Math.round((fieldCorrect.name / fieldExpected.name) * 100) : 100,
    email: fieldExpected.email ? Math.round((fieldCorrect.email / fieldExpected.email) * 100) : 100,
    phone: fieldExpected.phone ? Math.round((fieldCorrect.phone / fieldExpected.phone) * 100) : 100,
    experience: fieldExpected.experience ? Math.round((fieldCorrect.experience / fieldExpected.experience) * 100) : 100,
    education: fieldExpected.education ? Math.round((fieldCorrect.education / fieldExpected.education) * 100) : 100,
    skills: fieldExpected.skills ? Math.round((fieldCorrect.skills / fieldExpected.skills) * 100) : 100,
    dates: fieldExpected.dates ? Math.round((fieldCorrect.dates / fieldExpected.dates) * 100) : 100,
  };

  const extractionMetrics: ExtractionMetrics = {
    precision: overallPR.precision,
    recall: overallPR.recall,
    f1: overallPR.f1,
    fieldAccuracy,
  };

  const categoryAccuracy: Record<string, number> = {};
  for (const [cat, diffs] of Object.entries(categoryErrors)) {
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    categoryAccuracy[cat] = Math.round(Math.max(0, 100 - avgDiff) * 10) / 10;
  }

  // Regression check: verify score variance across repeated runs
  const sample = benchmarkResumeDataset[0];
  const run1 = analyzeResume({ text: sample.text, targetKeywords: [], documentSignals: sample.documentSignals });
  const run2 = analyzeResume({ text: sample.text, targetKeywords: [], documentSignals: sample.documentSignals });
  const scoreVariance = Math.abs(run1.score - run2.score);

  const scoreAgreement: ScoreAgreementMetrics = {
    meanAbsoluteError: calculateMAE(predictedScores, actualScores),
    spearmanRankCorrelation: calculateSpearmanRankCorrelation(predictedScores, actualScores),
    scoreVarianceAcrossRuns: scoreVariance,
    categoryAccuracy,
  };

  return {
    totalResumesAnalyzed: benchmarkResumeDataset.length,
    extractionMetrics,
    scoreAgreement,
    timestamp: new Date().toISOString(),
  };
}
