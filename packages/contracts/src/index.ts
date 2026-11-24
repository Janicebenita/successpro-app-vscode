import { z } from "zod";
import { successProV2ResultSchema } from "./successpro-v2";
export * from "./successpro-v2";
import { webUrlSchema } from "./url";
import { gapRiskResultSchema } from "./gap-risk";
export * from "./gap-risk";

export const documentSignalsSchema = z.object({
  extractionReliable: z.boolean().default(true),
  multiColumn: z.boolean().default(false),
  tableHeavy: z.boolean().default(false),
  imageOnly: z.boolean().default(false),
  criticalContentInHeaderFooter: z.boolean().default(false),
  inconsistentChronology: z.boolean().default(false),
  pageCount: z.number().int().min(1).max(25).nullish(),
  fontCount: z.number().int().min(0).nullish(),
  minimumFontSize: z.number().min(0).nullish(),
  crowdedLayout: z.boolean().default(false),
  excessiveWhitespace: z.boolean().default(false),
  inconsistentMargins: z.boolean().default(false),
  excessiveColor: z.boolean().default(false),
  smallText: z.boolean().default(false),
  textCollision: z.boolean().default(false).optional(),
  hasVisualEvidence: z.boolean().default(false),
  designWarnings: z.array(z.string()).default([]),
  geminiVisualScore: z.number().min(0).max(100).nullish(),
  geminiVisualCritique: z.string().nullish(),
  geminiVisualConfidence: z.number().min(0).max(1).nullish(),
  geminiPageFindings: z.array(z.object({
    page: z.number(),
    score: z.number().int().min(0).max(100).optional(),
    confidence: z.number().min(0).max(1).optional(),
    observations: z.array(z.string()),
    warnings: z.array(z.string()),
  })).optional(),
  geminiVisualCriteria: z.array(z.object({
    code: z.string(),
    rating: z.number().min(0).max(5),
    confidence: z.number().min(0).max(1),
    pages: z.array(z.number().int().positive()),
    evidence: z.string(),
    recommendation: z.string(),
    anchorText: z.string().optional(),
    anchorJustification: z.string().optional(),
    nextAnchorGap: z.string().optional(),
  })).optional(),
});

export const resumeAnalysisInputSchema = z.object({
  text: z.string().trim().min(80).max(200_000),
  targetKeywords: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  jobDescription: z.string().trim().max(100_000).default(""),
  processingJobId: z.string().uuid().optional(),
  documentSignals: documentSignalsSchema.default({
    extractionReliable: true,
    multiColumn: false,
    tableHeavy: false,
    imageOnly: false,
    criticalContentInHeaderFooter: false,
    inconsistentChronology: false,
    crowdedLayout: false,
    excessiveWhitespace: false,
    inconsistentMargins: false,
    excessiveColor: false,
    smallText: false,
    hasVisualEvidence: false,
    designWarnings: [],
  }),
});

export const severitySchema = z.enum(["Critical", "High", "Medium", "Low"]);

export const factorResultSchema = z.object({
  id: z.string(),
  label: z.string(),
  earned: z.number().int().nonnegative(),
  maximum: z.number().int().positive(),
  evidence: z.array(z.string()),
  issues: z.array(z.object({ severity: severitySchema, message: z.string() })),
  action: z.string(),
});

export const scoringCategorySchema = z.enum(["ats_readiness", "content_quality", "visual_design", "job_match"]);

export const structuredCriterionFindingSchema = z.object({
  criterionCode: z.string().min(1),
  category: scoringCategorySchema,
  rating: z.number().min(0).max(10),
  maximumRating: z.number().positive(),
  confidence: z.number().min(0).max(1),
  page: z.number().int().positive().nullable().optional(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().optional(),
  evidence: z.string(),
  reason: z.string(),
  recommendation: z.string(),
  source: z.enum(["deterministic", "gemini"]).default("deterministic"),
  pointEffect: z.number().optional(),
});

export const scoreSourcesSchema = z.object({
  atsReadiness: z.string().default("Rule-based parser"),
  contentQuality: z.string().default("Gemini 3.5 Flash"),
  visualDesign: z.string().default("OpenCV layout inspection"),
  jobMatch: z.string().default("Target keywords match"),
});

export const resumeAnalysisResultSchema = z.object({
  rubricVersion: z.enum(["successpro-ats-v1", "successpro-ats-v2", "ats-ai-hybrid-v1"]).or(z.string()),
  score: z.number().min(0).max(100).nullable(),
  v2: successProV2ResultSchema.optional(),
  rawScore: z.number().min(0).max(100).nullable().optional(),
  atsReadinessScore: z.number().int().min(0).max(100).default(0),
  contentQualityScore: z.number().int().min(0).max(100).default(0),
  visualDesignScore: z.number().min(0).max(100).nullable().default(null),
  visualDesignStatus: z.enum(["evaluated", "not_evaluated", "partial"]).default("not_evaluated"),
  jobMatchScore: z.number().int().min(0).max(100).nullable().default(null),
  jobMatchStatus: z.enum(["completed", "not_evaluated", "job_description_required", "insufficient_content"]).default("not_evaluated"),
  jobMatchMethod: z.enum(["gemini_semantic", "deterministic_fallback", "not_evaluated"]).default("not_evaluated"),
  evaluationCoverage: z.number().min(0).max(100).default(75),
  provisional: z.boolean().default(true),
  contentContribution: z.number().optional(),
  visualContribution: z.number().optional(),
  jobMatchContribution: z.number().nullable().optional(),
  scoreSources: scoreSourcesSchema.optional(),
  calibration: z.object({ reductionPercent: z.number(), explanation: z.string() }).optional(),
  factors: z.array(factorResultSchema),
  criteriaFindings: z.array(structuredCriterionFindingSchema).default([]),
  gapRiskAnalysis: gapRiskResultSchema.optional(),
  completed: z.boolean(),
  disclaimer: z.string(),
});

export type ScoreSources = z.infer<typeof scoreSourcesSchema>;
export type ScoringCategory = z.infer<typeof scoringCategorySchema>;
export type StructuredCriterionFinding = z.infer<typeof structuredCriterionFindingSchema>;

export type ResumeAnalysisInput = z.input<typeof resumeAnalysisInputSchema>;
export type DocumentSignals = z.input<typeof documentSignalsSchema>;
export type FactorResult = z.infer<typeof factorResultSchema>;
export type ResumeAnalysisResult = z.infer<typeof resumeAnalysisResultSchema>;

export const experienceSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  employer: z.string().trim().min(1).max(160),
  startDate: z.string().trim().max(20),
  endDate: z.string().trim().max(20),
  achievements: z.array(z.string().trim().min(1).max(500)).max(20),
});

export const educationSchema = z.object({
  id: z.string().min(1),
  qualification: z.string().trim().min(1).max(160),
  institution: z.string().trim().min(1).max(180),
  startDate: z.string().trim().max(20),
  endDate: z.string().trim().max(20),
});

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1_000),
  link: z.union([z.literal(""), webUrlSchema(500)]).default(""),
});

export const certificationSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(180),
  issuer: z.string().trim().max(180),
  date: z.string().trim().max(20),
  credentialUrl: z.union([z.literal(""), webUrlSchema(500)]).default(""),
});

export const awardSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["award", "achievement"]).optional(),
  title: z.string().trim().min(1).max(180),
  issuer: z.string().trim().max(180),
  date: z.string().trim().max(20),
  description: z.string().trim().max(1_000),
});

export const publicationSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(240),
  publisher: z.string().trim().max(180),
  date: z.string().trim().max(20),
  link: z.union([z.literal(""), webUrlSchema(500)]).default(""),
});

export const volunteerExperienceSchema = z.object({
  id: z.string().min(1),
  role: z.string().trim().min(1).max(160),
  organization: z.string().trim().min(1).max(180),
  startDate: z.string().trim().max(20),
  endDate: z.string().trim().max(20),
  description: z.string().trim().max(1_000),
});

export const professionalLinkSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(80),
  url: webUrlSchema(500),
});

export const publicProfileVisibilitySchema = z.object({
  summary: z.boolean().default(true),
  location: z.boolean().default(true),
  currentRole: z.boolean().default(true),
  industry: z.boolean().default(true),
  skills: z.boolean().default(true),
  experience: z.boolean().default(true),
  education: z.boolean().default(true),
  photo: z.boolean().default(false),
}).default({ summary: true, location: true, currentRole: true, industry: true, skills: true, experience: true, education: true, photo: false });

export const canonicalProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  headline: z.string().trim().min(2).max(180),
  location: z.string().trim().max(120),
  summary: z.string().trim().max(2_000),
  currentRole: z.string().trim().max(120),
  industry: z.string().trim().max(120),
  skills: z.array(z.string().trim().min(1).max(80)).max(100),
  experience: z.array(experienceSchema).max(30),
  education: z.array(educationSchema).max(20),
  projects: z.array(projectSchema).max(30).default([]),
  certifications: z.array(certificationSchema).max(30).default([]),
  awards: z.array(awardSchema).max(30).default([]),
  publications: z.array(publicationSchema).max(30).default([]),
  volunteerExperience: z.array(volunteerExperienceSchema).max(30).default([]),
  languages: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  preferredLanguage: z.string().trim().min(2).max(35).default("en"),
  links: z.array(professionalLinkSchema).max(20).default([]),
  targetRoles: z.array(z.string().trim().min(1).max(120)).max(20),
  openToWork: z.boolean().default(false),
  publicProfileEnabled: z.boolean().default(false),
  publicProfileVisibility: publicProfileVisibilitySchema,
  searchEngineIndexable: z.boolean().default(false),
  // Private profile photograph; public sharing remains opt-in and independent.
  profilePhotoUpdatedAt: z.string().trim().max(40).default(""),
});

export const jobMatchInputSchema = z.object({
  resumeText: z.string().trim().min(80).max(200_000),
  jobDescription: z.string().trim().min(120).max(100_000),
});

export const jobMatchResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  reliability: z.enum(["high", "medium", "low"]),
  matched: z.array(z.string()),
  missing: z.array(z.string()),
  transferable: z.array(z.string()),
  actions: z.array(z.string()),
  disclaimer: z.string(),
});

export type CanonicalProfile = z.infer<typeof canonicalProfileSchema>;
export type JobMatchInput = z.infer<typeof jobMatchInputSchema>;
export type JobMatchResult = z.infer<typeof jobMatchResultSchema>;

export const careerGoalSchema = z.object({
  targetRole: z.string().trim().min(2).max(140),
  targetDate: z.string().trim().max(20),
  motivation: z.string().trim().max(1_000),
  targetSalary: z.number().int().nonnegative().nullable().default(null),
  currency: z.string().trim().length(3).default("INR"),
  targetCompany: z.string().trim().max(160).default(""),
  targetIndustry: z.string().trim().max(120).default(""),
  targetGeography: z.string().trim().max(160).default(""),
  targetSkill: z.string().trim().max(120).default(""),
  tasks: z.array(z.object({ id: z.string().min(1), label: z.string().trim().min(1).max(240), completed: z.boolean(), category: z.enum(["skills", "experience", "portfolio", "credentials", "network", "resume", "role"]).default("role"), targetMonth: z.string().trim().max(20).default("") })).max(30),
});

export const jobPreferencesSchema = z.object({
  roleTitles: z.array(z.string().trim().min(1).max(120)).max(20),
  locations: z.array(z.string().trim().min(1).max(160)).max(5),
  workModes: z.array(z.enum(["remote", "hybrid", "onsite"])).max(3),
  employmentTypes: z.array(z.enum(["full-time", "part-time", "contract", "internship"])).max(4),
  industries: z.array(z.string().trim().min(1).max(120)).max(20),
  keywords: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  experienceYears: z.number().min(0).max(60).nullable().default(null),
  salaryMinimum: z.number().int().nonnegative().nullable(),
  currency: z.string().trim().length(3).default("INR"),
  excludedEmployers: z.array(z.string().trim().min(1).max(160)).max(50),
});

export type CareerGoal = z.infer<typeof careerGoalSchema>;
export type JobPreferences = z.infer<typeof jobPreferencesSchema>;

export const salarySourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(160),
  url: webUrlSchema(500),
  publishedOn: z.string().date(),
  // A web result does not always expose its original publication date. Keep
  // that distinction visible rather than presenting retrieval as publication.
  dateBasis: z.enum(["published", "accessed"]).default("published"),
  low: z.number().int().nonnegative(),
  midpoint: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
}).refine((source) => source.low <= source.midpoint && source.midpoint <= source.high, { message: "Salary values must run from low to midpoint to high." });

export const salaryResearchSchema = z.object({
  role: z.string().trim().min(2).max(140),
  location: z.string().trim().min(2).max(160),
  yearsExperience: z.number().min(0).max(60),
  industry: z.string().trim().max(120),
  companySize: z.enum(["unspecified", "small", "medium", "large", "enterprise"]),
  skills: z.array(z.string().trim().min(1).max(80)).max(30),
  education: z.string().trim().max(180),
  currentCompensation: z.number().int().nonnegative().nullable(),
  targetCompensation: z.number().int().nonnegative().nullable(),
  currency: z.string().trim().length(3),
  sources: z.array(salarySourceSchema).max(12),
  searchSuggestionHtml: z.string().max(20_000).default(""),
});

export type SalarySource = z.infer<typeof salarySourceSchema>;
export type SalaryResearch = z.infer<typeof salaryResearchSchema>;
