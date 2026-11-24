import { analyzeResume } from "./packages/domain/src/resume-scoring";
import { calculateOverallScore } from "./packages/domain/src/scoring-config";

console.log("--- RUNNING 5-CASE MASTER SCORING ENGINE TEST SUITE ---");

// Case 1 — No Job Description
// Content Quality: 80, Visual Quality: 90, Job Match: NOT_EVALUATED
// Expected Overall Score: 62.5/100
// Expected Evaluation Coverage: 75%
// ATS Readiness must remain independent.
const case1 = calculateOverallScore({
  contentQualityScore: 80,
  visualQualityScore: 90,
  jobMatchScore: null,
  hasJobDescription: false,
});
console.log("Case 1 result:", case1);
if (case1.score !== 62.5) {
  console.error(`Case 1 FAIL: score is ${case1.score}, expected 62.5`);
  process.exit(1);
}
if (case1.evaluationCoverage !== 75) {
  console.error(`Case 1 FAIL: coverage is ${case1.evaluationCoverage}, expected 75`);
  process.exit(1);
}
if (case1.contentContribution !== 40) {
  console.error(`Case 1 FAIL: contentContribution is ${case1.contentContribution}, expected 40`);
  process.exit(1);
}
if (case1.visualContribution !== 22.5) {
  console.error(`Case 1 FAIL: visualContribution is ${case1.visualContribution}, expected 22.5`);
  process.exit(1);
}
if (case1.jobMatchStatus !== "not_evaluated" || case1.jobMatchContribution !== null) {
  console.error("Case 1 FAIL: jobMatchStatus should be not_evaluated");
  process.exit(1);
}
if (!case1.provisional) {
  console.error("Case 1 FAIL: should be marked provisional");
  process.exit(1);
}
console.log("✓ Case 1 passed: 62.5/100 score, 75% coverage, provisional = true");

// Case 2 — Job Description Provided
// Content Quality: 80, Job Match: 90, Visual Quality: 85
// Expected Overall Score: 83.75/100
// Expected Evaluation Coverage: 100%
const case2 = calculateOverallScore({
  contentQualityScore: 80,
  visualQualityScore: 85,
  jobMatchScore: 90,
  hasJobDescription: true,
});
console.log("Case 2 result:", case2);
if (case2.score !== 83.75) {
  console.error(`Case 2 FAIL: score is ${case2.score}, expected 83.75`);
  process.exit(1);
}
if (case2.evaluationCoverage !== 100) {
  console.error(`Case 2 FAIL: coverage is ${case2.evaluationCoverage}, expected 100`);
  process.exit(1);
}
if (case2.contentContribution !== 40 || case2.visualContribution !== 21.25 || case2.jobMatchContribution !== 22.5) {
  console.error(`Case 2 FAIL: contributions mismatch: content=${case2.contentContribution}, visual=${case2.visualContribution}, jobMatch=${case2.jobMatchContribution}`);
  process.exit(1);
}
if (case2.jobMatchStatus !== "completed" || case2.provisional) {
  console.error("Case 2 FAIL: jobMatchStatus should be completed and provisional should be false");
  process.exit(1);
}
console.log("✓ Case 2 passed: 83.75/100 score, 100% coverage, full breakdown verified");

// Case 3 — Visual Signals Missing
// Visual Quality: NOT_EVALUATED
// Do not invent a visual score.
// Do not silently redistribute its 25% weight.
const case3 = calculateOverallScore({
  contentQualityScore: 80,
  visualQualityScore: null,
  jobMatchScore: null,
  hasJobDescription: false,
  visualStatus: "not_evaluated",
});
console.log("Case 3 result:", case3);
if (case3.visualContribution !== 0 || case3.visualDesignStatus !== "not_evaluated") {
  console.error("Case 3 FAIL: visual contribution should be 0 and status not_evaluated");
  process.exit(1);
}
if (case3.evaluationCoverage !== 50) {
  console.error(`Case 3 FAIL: coverage should be 50% without visual or JD, got ${case3.evaluationCoverage}`);
  process.exit(1);
}
if (case3.score !== 40) {
  console.error(`Case 3 FAIL: score should be 40 (only 80 * 0.5), got ${case3.score}`);
  process.exit(1);
}
console.log("✓ Case 3 passed: visual not invented, weight not redistributed, coverage = 50%");

// Case 4 — Gemini Unavailable (Fallback verification via analyzeResume)
// Verify fallback behavior.
// Clearly identify deterministic fallback scores versus Gemini-evaluated scores.
const resumeSample = `
Jane Doe
jane.doe@example.com | (555) 123-4567 | linkedin.com/in/janedoe
Summary: Experienced software engineer with expertise in TypeScript, React, and Node.js.
Experience:
Senior Software Engineer - TechCorp (2020 - Present)
• Spearheaded migration of microservices architecture to Kubernetes, reducing latency by 35%.
• Optimized database indexing in PostgreSQL, improving query throughput by 50%.
• Led a cross-functional team of 8 engineers delivering features on time.
Education:
B.S. in Computer Science - University of Science (2016 - 2020)
Skills:
TypeScript, Node.js, React, Docker, Kubernetes, SQL, PostgreSQL, Git, Python
`;
const fallbackAnalysis = analyzeResume({
  text: resumeSample,
  targetKeywords: ["TypeScript", "React", "PostgreSQL"],
  documentSignals: { hasVisualEvidence: false },
});
console.log("Case 4 result (Fallback analysis):");
console.log(" - scoreSources:", fallbackAnalysis.scoreSources);
console.log(" - atsReadinessScore:", fallbackAnalysis.atsReadinessScore);
console.log(" - contentQualityScore:", fallbackAnalysis.contentQualityScore);
console.log(" - visualDesignScore:", fallbackAnalysis.visualDesignScore);
console.log(" - visualDesignStatus:", fallbackAnalysis.visualDesignStatus);
if (!fallbackAnalysis.scoreSources.contentQuality.includes("Deterministic baseline")) {
  console.error("Case 4 FAIL: scoreSources.contentQuality should identify deterministic fallback!");
  process.exit(1);
}
if (fallbackAnalysis.visualDesignScore !== null || fallbackAnalysis.visualDesignStatus !== "not_evaluated") {
  console.error("Case 4 FAIL: visual design should be null/not_evaluated when hasVisualEvidence is false!");
  process.exit(1);
}
console.log("✓ Case 4 passed: deterministic fallback clearly identified in scoreSources and visual correctly un-evaluated");

// Case 5 — Job Description Added Later
// Verify that Job Match is evaluated and the overall score and coverage update correctly.
const initialWithoutJd = calculateOverallScore({
  contentQualityScore: 80,
  visualQualityScore: 85,
  jobMatchScore: null,
  hasJobDescription: false,
});
console.log("Case 5 step 1 (before JD): score =", initialWithoutJd.score, "coverage =", initialWithoutJd.evaluationCoverage);
if (initialWithoutJd.score !== 61.25 || initialWithoutJd.evaluationCoverage !== 75) {
  console.error(`Case 5 step 1 FAIL: expected 61.25 and 75, got ${initialWithoutJd.score} and ${initialWithoutJd.evaluationCoverage}`);
  process.exit(1);
}
// User adds JD later with match score of 90
const updatedWithJd = calculateOverallScore({
  contentQualityScore: 80,
  visualQualityScore: 85,
  jobMatchScore: 90,
  hasJobDescription: true,
});
console.log("Case 5 step 2 (after JD added): score =", updatedWithJd.score, "coverage =", updatedWithJd.evaluationCoverage);
if (updatedWithJd.score !== 83.75 || updatedWithJd.evaluationCoverage !== 100 || updatedWithJd.provisional) {
  console.error(`Case 5 step 2 FAIL: expected 83.75, 100% coverage, provisional=false`);
  process.exit(1);
}
console.log("✓ Case 5 passed: successfully updated from 61.25 (75% coverage) to 83.75 (100% coverage)");

console.log("\n=========================================");
console.log("ALL 5 MASTER SCORING CASES PASSED 100%!");
console.log("=========================================");
