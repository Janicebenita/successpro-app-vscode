import mysql from "mysql2/promise";
import { resumeAnalysisInputSchema } from "@successpro/contracts";
import { analyzeResume } from "@successpro/domain";
import { calculateOverallScore } from "@successpro/domain";

const SEMANTIC_FACTOR_ALIASES: Record<string, string> = {
  achievement_quality: "impact",
  impact: "impact",
  action_writing: "action-writing",
  "action-writing": "action-writing",
  career_progression: "coherence",
  coherence: "coherence",
  professional_positioning: "positioning",
  positioning: "positioning",
  contextual_skills: "skills",
  skill_relevance: "skills",
  skills: "skills",
  content_clarity: "readability",
  readability: "readability",
};
const SEMANTIC_WEIGHTS: Record<string, number> = {
  "action-writing": 7,
  impact: 10,
  coherence: 8,
  positioning: 8,
  skills: 10,
  readability: 8,
};

function applyValidatedAiRatings(base: any, criteria: any[], resumeText: string, jobDescription: string) {
  const accepted = criteria
    .filter((item) => item.category !== "visual_design")
    .map((item) => ({ ...item, criterionCode: SEMANTIC_FACTOR_ALIASES[item.criterionCode] ?? item.criterionCode, source: "gemini" as const }))
    .filter((item) => item.confidence >= 0.75 && item.evidence.trim().length > 0 && item.maximumRating > 0);

  const categoryScore = (category: string, fallback: number | null) => {
    const values = accepted.filter((item) => item.category === category);
    if (!values.length) return fallback;
    return Math.round(values.reduce((sum, item) => sum + (item.rating / item.maximumRating) * 100, 0) / values.length);
  };
  const contentQualityScore = categoryScore("content_quality", base.contentQualityScore) ?? base.contentQualityScore;
  const visualDesignScore = base.visualDesignStatus === "evaluated" || base.visualDesignStatus === "partial" ? base.visualDesignScore : null;
  const visualDesignStatus = visualDesignScore !== null ? (base.visualDesignStatus ?? "evaluated") : "not_evaluated";

  const hasJobDescription = jobDescription.trim().length >= 120;
  const jobCriteria = accepted.filter((item) => item.category === "job_match");
  const jobMatchScore = jobCriteria.length > 0 ? categoryScore("job_match", null) : null;

  const overall = calculateOverallScore({
    contentQualityScore,
    visualQualityScore: visualDesignScore,
    jobMatchScore,
    hasJobDescription,
    visualStatus: visualDesignStatus,
  });

  return {
    ...base,
    score: overall.score,
    visualDesignScore,
    visualDesignStatus: overall.visualDesignStatus,
    visualContribution: overall.visualContribution,
  };
}

async function main() {
  const conn = await mysql.createConnection("mysql://successpro:successpro@127.0.0.1:3307/successpro_local");
  const [rows] = await conn.query<any[]>("SELECT id, status, extracted_result FROM resume_processing_jobs ORDER BY created_at DESC LIMIT 1");
  const job = rows[0];
  const extraction = typeof job.extracted_result === "string" ? JSON.parse(job.extracted_result) : job.extracted_result;

  const rawInput = {
    text: extraction.text,
    targetKeywords: ["Product Designer"],
    jobDescription: "Senior Product Designer with strong Figma and Design Systems experience.",
    processingJobId: job.id,
    documentSignals: extraction.signals,
  };

  const parsed = resumeAnalysisInputSchema.parse(rawInput);
  let result = analyzeResume(parsed);
  console.log("Before AI ratings - visualDesignScore:", result.visualDesignScore);

  // simulate applyValidatedAiRatings with empty criteria (fallback)
  result = applyValidatedAiRatings(result, [], rawInput.text, rawInput.jobDescription);
  console.log("After AI ratings (fallback) - visualDesignScore:", result.visualDesignScore);
  console.log("After AI ratings - visualDesignStatus:", result.visualDesignStatus);

  await conn.end();
}

main().catch(console.error);
