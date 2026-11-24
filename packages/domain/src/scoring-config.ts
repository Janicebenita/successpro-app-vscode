/**
 * Centralized, Modular Resume Scoring Configuration
 * 
 * Top-level weights are fixed:
 * - Content Quality: 50%
 * - Job Description Match: 25%
 * - Visual Quality: 25%
 * Total: 100%
 * 
 * Subcategories, factor definitions, thresholds, and scoring parameters
 * remain modular and configurable for ongoing tuning.
 */

export interface TopLevelWeights {
  readonly contentQuality: number; // 0.50
  readonly jobMatch: number;       // 0.25
  readonly visualQuality: number;  // 0.25
}

export interface ContentSubcategoryConfig {
  readonly code: string;
  readonly label: string;
  readonly defaultWeight: number;
  readonly description: string;
}

export interface VisualScoringConfig {
  readonly openCvWeight: number;
  readonly geminiVisionWeight: number;
  readonly baselineScore: number;
  readonly fontCountThresholds: {
    readonly idealMax: number;
    readonly acceptableMax: number;
    readonly penaltyPerExcessFont: number;
  };
  readonly fontSizeThresholds: {
    readonly idealMin: number;
    readonly acceptableMin: number;
    readonly unreadableThreshold: number;
  };
}

export interface JobMatchScoringConfig {
  readonly requiredSkillWeight: number;
  readonly preferredSkillWeight: number;
  readonly experienceAlignmentWeight: number;
  readonly educationAlignmentWeight: number;
  readonly seniorityAlignmentWeight: number;
}

export interface AtsDiagnosticConfig {
  readonly factorIds: readonly string[];
}

export interface ScoringEngineConfig {
  readonly topLevelWeights: TopLevelWeights;
  readonly contentSubcategories: Record<string, ContentSubcategoryConfig>;
  readonly visualConfig: VisualScoringConfig;
  readonly jobMatchConfig: JobMatchScoringConfig;
  readonly atsDiagnosticConfig: AtsDiagnosticConfig;
}

export const DEFAULT_SCORING_CONFIG: ScoringEngineConfig = {
  topLevelWeights: {
    contentQuality: 0.50,
    jobMatch: 0.25,
    visualQuality: 0.25,
  },
  contentSubcategories: {
    "action-writing": {
      code: "action-writing",
      label: "Achievement-Led Action Writing",
      defaultWeight: 7,
      description: "Action verbs, active voice, and clear ownership of contributions.",
    },
    impact: {
      code: "impact",
      label: "Measurable Impact & Scope",
      defaultWeight: 10,
      description: "Quantified accomplishments, scale, business impact, and verifiable outcomes.",
    },
    coherence: {
      code: "coherence",
      label: "Career Progression & Coherence",
      defaultWeight: 8,
      description: "Narrative clarity, role-to-role progression, and experience continuity.",
    },
    positioning: {
      code: "positioning",
      label: "Professional Positioning & Summary",
      defaultWeight: 8,
      description: "Target identity, executive summary, and clarity of expertise.",
    },
    skills: {
      code: "skills",
      label: "Technical & Professional Skills",
      defaultWeight: 10,
      description: "Demonstrated and contextual skills backed by work experience.",
    },
    readability: {
      code: "readability",
      label: "Content Clarity & Readability",
      defaultWeight: 8,
      description: "Conciseness, bullet structure, line length, and absence of fluff.",
    },
  },
  visualConfig: {
    openCvWeight: 0.50,
    geminiVisionWeight: 0.50,
    baselineScore: 80,
    fontCountThresholds: {
      idealMax: 2,
      acceptableMax: 3,
      penaltyPerExcessFont: 10,
    },
    fontSizeThresholds: {
      idealMin: 10.0,
      acceptableMin: 9.0,
      unreadableThreshold: 8.0,
    },
  },
  jobMatchConfig: {
    requiredSkillWeight: 0.40,
    preferredSkillWeight: 0.20,
    experienceAlignmentWeight: 0.25,
    educationAlignmentWeight: 0.10,
    seniorityAlignmentWeight: 0.05,
  },
  atsDiagnosticConfig: {
    factorIds: ["parseability", "contact", "structure", "chronology", "language"],
  },
};

export interface OverallScoreInput {
  contentQualityScore: number;
  visualQualityScore: number | null;
  jobMatchScore: number | null;
  hasJobDescription: boolean;
  visualStatus?: "evaluated" | "not_evaluated" | "partial";
  jobMatchStatus?: "completed" | "not_evaluated" | "job_description_required" | "insufficient_content";
  config?: ScoringEngineConfig;
}

export interface OverallScoreResult {
  score: number;
  evaluationCoverage: number;
  provisional: boolean;
  contentContribution: number;
  visualContribution: number;
  jobMatchContribution: number | null;
  jobMatchStatus: "completed" | "not_evaluated" | "job_description_required" | "insufficient_content";
  visualDesignStatus: "evaluated" | "not_evaluated" | "partial";
  topLevelWeights: TopLevelWeights;
}

/**
 * Calculates the overall resume score following the strict Master Implementation rules:
 *
 * 1. Content Quality: 50%
 * 2. Visual Quality: 25%
 * 3. Job Match: 25%
 *
 * When NO job description is provided:
 * - Content retains 50% contribution
 * - Visual retains 25% contribution
 * - Job match is NOT_EVALUATED, its 25% remains unallocated
 * - Overall score is out of 100 using only available contributions (Content * 0.50 + Visual * 0.25)
 * - Coverage is 75% (or 50% if visual is also not evaluated)
 * - NEVER normalize by dividing by 0.75!
 */
export function calculateOverallScore(input: OverallScoreInput): OverallScoreResult {
  const cfg = input.config ?? DEFAULT_SCORING_CONFIG;
  const weights = cfg.topLevelWeights;

  const contentContribution = Math.round(input.contentQualityScore * weights.contentQuality * 100) / 100;
  
  const visualStatus: "evaluated" | "not_evaluated" | "partial" = 
    input.visualStatus ?? (input.visualQualityScore !== null ? "evaluated" : "not_evaluated");
  const visualContribution = visualStatus !== "not_evaluated" && input.visualQualityScore !== null
    ? Math.round(input.visualQualityScore * weights.visualQuality * 100) / 100
    : 0;

  let jobMatchContribution: number | null = null;
  let jobMatchStatus: "completed" | "not_evaluated" | "job_description_required" | "insufficient_content" = "not_evaluated";
  let coverage = 0;
  let provisional = false;

  coverage += Math.round(weights.contentQuality * 100);
  if (visualStatus !== "not_evaluated" && input.visualQualityScore !== null) {
    coverage += Math.round(weights.visualQuality * 100);
  }

  if (input.hasJobDescription && typeof input.jobMatchScore === "number" && input.jobMatchScore >= 0) {
    jobMatchContribution = Math.round(input.jobMatchScore * weights.jobMatch * 100) / 100;
    jobMatchStatus = "completed";
    coverage += Math.round(weights.jobMatch * 100);
    provisional = false;
  } else {
    jobMatchContribution = null;
    jobMatchStatus = input.jobMatchStatus ?? "not_evaluated";
    provisional = true;
  }

  provisional = coverage < 100;

  // Combined score out of 100 (unallocated weights remain unearned, not divided/normalized)
  const score = Math.round((contentContribution + visualContribution + (jobMatchContribution ?? 0)) * 100) / 100;

  return {
    score,
    evaluationCoverage: coverage,
    provisional,
    contentContribution,
    visualContribution,
    jobMatchContribution,
    jobMatchStatus,
    visualDesignStatus: visualStatus,
    topLevelWeights: weights,
  };
}
