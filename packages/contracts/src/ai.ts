import { z } from "zod";
import { canonicalProfileSchema, careerGoalSchema, documentSignalsSchema, experienceSchema, resumeAnalysisResultSchema, salaryResearchSchema, structuredCriterionFindingSchema } from "./index";
import { v2AssessmentSchema, v2RequirementSchema } from "./successpro-v2";
import { webUrlSchema } from "./url";

// Extraction is an incomplete draft, not a confirmed customer profile.
export const extractedProfileSchema = canonicalProfileSchema.partial().extend({
  fullName: z.string().trim().max(120).optional(),
  headline: z.string().trim().max(1_000).optional(),
  summary: z.string().trim().max(20_000).optional(),
  experience: z.array(experienceSchema.extend({ achievements: z.array(z.string().trim().min(1).max(2_000)).max(100) })).max(50).optional(),
});

const evidenceSuggestionSchema = z.object({
  observed: z.string().trim().min(1).max(1_500),
  inference: z.string().trim().max(1_500),
  suggestion: z.string().trim().min(1).max(1_500),
});

const sourceReferenceSchema = z.object({
  title: z.string().trim().min(1).max(240),
  url: webUrlSchema(1_000),
  publishedOn: z.string().trim().max(20),
  supports: z.string().trim().min(1).max(500),
});

const transformedProfileSchema = canonicalProfileSchema.partial().extend({
  // Publish the writing constraints in JSON Schema as well as runtime checks.
  // Hidden superRefine limits otherwise contradict the provider's schema.
  skills: canonicalProfileSchema.shape.skills.max(24).optional(),
  summary: z.string().trim().max(1_000).optional(),
}).superRefine((profile, context) => {
  const summary = profile.summary?.trim() ?? "";
  if (!profile.headline?.trim()) context.addIssue({ code: "custom", path: ["headline"], message: "A transformed resume requires a focused professional headline." });
  if (!summary) context.addIssue({ code: "custom", path: ["summary"], message: "A transformed resume requires a rewritten professional summary." });
  if (!profile.experience?.length) context.addIssue({ code: "custom", path: ["experience"], message: "A transformed resume must preserve and rewrite the candidate's supported work history." });
  profile.experience?.forEach((role, index) => {
    if (role.achievements.some((bullet) => /can be rephrased|compelling edge|resume writer|insert (?:metric|number)|to be updated/i.test(bullet))) context.addIssue({ code: "custom", path: ["experience", index, "achievements"], message: "Transformed achievements must not contain source-editor notes or instructions." });
  });
  if (/\b(?:CONTACT|SKILLS|COMPELLING EDGE|CAREER HIGHLIGHTS|PROFESSIONAL EXPERIENCE|EDUCATION)\b|(?:^|\n)\s*(?:contact|skills?|compelling edge|career highlights?|professional experience|education)\s*:/m.test(summary)) context.addIssue({ code: "custom", path: ["summary"], message: "Professional summary contains content from another resume section." });
  if (/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:https?:\/\/|www\.)|(?<!\d)(?:\+?\d[\d .()-]{7,}\d)(?!\d)/i.test(summary)) context.addIssue({ code: "custom", path: ["summary"], message: "Professional summary must not contain contact details or links." });
  if ((summary.match(/\b[A-Z][A-Za-z /&-]{2,40}:\s/g) ?? []).length >= 2) context.addIssue({ code: "custom", path: ["summary"], message: "Professional summary appears to contain labelled highlights rather than a focused narrative." });
});

export const aiTaskSchemas = {
  extractResumeProfile: {
    input: z.object({ resumeText: z.string().trim().min(80).max(200_000), deterministicDraft: extractedProfileSchema, sourceLanguage: z.string().trim().min(2).max(12).optional(), transform: z.boolean().default(false), targetRoles: z.array(z.string().trim().min(1).max(120)).max(10).default([]) }),
    output: z.object({ profileDraft: extractedProfileSchema, improvements: z.array(evidenceSuggestionSchema.extend({ field: z.string().trim().min(1).max(120) })).max(30), warnings: z.array(z.string().trim().min(1).max(500)).max(20) }),
  },
  transformResumeProfile: {
    input: z.object({ resumeText: z.string().trim().min(80).max(200_000), deterministicDraft: extractedProfileSchema, sourceLanguage: z.string().trim().min(2).max(12).optional(), targetRoles: z.array(z.string().trim().min(1).max(120)).max(10).default([]), jobDescription: z.string().trim().max(100_000).default(""), refinementNotes: z.string().trim().max(2_000).default(""), preserveStructure: z.boolean().default(false) }),
    output: z.object({ profileDraft: transformedProfileSchema, improvements: z.array(evidenceSuggestionSchema.extend({ field: z.string().trim().min(1).max(120) })).min(1).max(30), warnings: z.array(z.string().trim().min(1).max(500)).max(20) }),
  },
  analyzeResume: {
    input: z.object({
      resumeText: z.string().trim().min(80).max(200_000),
      deterministicReview: resumeAnalysisResultSchema,
      profileContext: canonicalProfileSchema.pick({ headline: true, currentRole: true, industry: true, skills: true, targetRoles: true }).partial().optional(),
      targetRole: z.string().trim().max(2_000).default(""),
      jobDescription: z.string().trim().max(100_000).optional(),
      documentSignals: documentSignalsSchema.optional(),
      sourcePageRanges:z.array(z.object({page:z.number().int().positive(),start:z.number().int().nonnegative(),end:z.number().int().nonnegative()})).optional(),
    }),
    output: z.object({
      workbookAssessments: z.array(v2AssessmentSchema).max(20).optional(),
      jdRequirements: z.array(v2RequirementSchema).max(200).optional(),
      meaningfulJd: z.boolean().optional(),
      analysisVersion: z.string().default("ats-ai-hybrid-v1").optional(),
      summary: z.string().trim().min(1).max(2_000),
      criteria: z.array(structuredCriterionFindingSchema).default([]).optional(),
      topActions: z.array(evidenceSuggestionSchema.extend({ sourceExcerptId: z.string().trim().max(12).optional(), originalExcerpt: z.string().trim().max(700).default(""), improvedExample: z.string().trim().max(1_500).default("") })).min(1).max(10),
      warnings: z.array(z.string().trim().max(500)).default([]).optional(),
      insufficientEvidence: z.array(z.string().trim().max(500)).default([]).optional(),
      limitations: z.array(z.string().trim().min(1).max(500)).max(8),
    }),
  },
  explainResumeIssue: {
    input: z.object({ factor: z.string().trim().min(1).max(120), evidence: z.array(z.string().trim().min(1).max(1_000)).max(20), issue: z.string().trim().min(1).max(1_000), targetRole: z.string().trim().max(1_000).default("") }),
    output: evidenceSuggestionSchema.extend({ whyItMatters: z.string().trim().min(1).max(1_500), example: z.string().trim().max(2_000) }),
  },
  rewriteResumeSection: {
    input: z.object({ sectionName: z.string().trim().min(1).max(120), originalText: z.string().trim().min(1).max(20_000), targetRole: z.string().trim().max(1_000), verifiedFacts: z.array(z.string().trim().min(1).max(1_000)).max(50) }),
    output: z.object({ rewrite: z.string().trim().min(1).max(8_000), alternatives: z.array(z.string().trim().min(1).max(8_000)).max(3), factsUsed: z.array(z.string().trim().min(1).max(1_000)).max(50), userChecks: z.array(z.string().trim().min(1).max(500)).max(10) }),
  },
  generateCoverLetter: {
    input: z.object({ profile: canonicalProfileSchema, targetRole: z.string().trim().min(2).max(1_000), company: z.string().trim().min(1).max(180), jobDescription: z.string().trim().max(100_000), tone: z.enum(["warm", "direct", "executive"]).default("direct") }),
    output: z.object({ subject: z.string().trim().min(1).max(240), greeting: z.string().trim().min(1).max(240), paragraphs: z.array(z.string().trim().min(1).max(2_000)).min(3).max(5), closing: z.string().trim().min(1).max(240), evidenceUsed: z.array(z.string().trim().min(1).max(1_000)).max(20), userChecks: z.array(z.string().trim().min(1).max(500)).max(10) }),
  },
  generateLinkedInMakeover: {
    input: z.object({ profile: canonicalProfileSchema, currentProfileText: z.string().trim().max(100_000).default(""), targetRole: z.string().trim().max(1_000).default("") }),
    output: z.object({ headlines: z.array(z.string().trim().min(1).max(220)).min(2).max(5), about: z.string().trim().min(1).max(3_000), experience: z.array(z.object({ roleId: z.string(), text: z.string().trim().min(1).max(2_500) })).max(30), skills: z.array(z.string().trim().min(1).max(80)).max(50), featured: z.array(z.string().trim().min(1).max(500)).max(12), recommendationPrompts: z.array(z.string().trim().min(1).max(1_000)).max(8), visibilityChecks: z.array(z.string().trim().min(1).max(500)).max(10), userChecks: z.array(z.string().trim().min(1).max(500)).max(10) }),
  },
  careerGapPlan: {
    input: z.object({ profile: canonicalProfileSchema, goal: careerGoalSchema }),
    output: z.object({ summary: z.string().trim().min(1).max(2_000), gaps: z.array(evidenceSuggestionSchema.extend({ category: z.enum(["skills", "experience", "portfolio", "credentials", "network", "resume", "role"]) })).max(15), milestones: z.array(z.object({ month: z.string().trim().min(1).max(20), action: z.string().trim().min(1).max(500), evidenceOfCompletion: z.string().trim().min(1).max(500) })).max(24), intermediateRoles: z.array(z.string().trim().min(1).max(160)).max(8) }),
  },
  recommendUpskilling: {
    input: z.object({ profile: canonicalProfileSchema, targetRole: z.string().trim().min(2).max(1_000), gaps: z.array(z.string().trim().min(1).max(500)).max(30), availableCourses: z.array(z.object({ id: z.string(), title: z.string(), provider: z.string(), skills: z.array(z.string()), free: z.boolean(), url: webUrlSchema(), lastVerifiedOn: z.string() })).max(200) }),
    output: z.object({ priorities: z.array(z.object({ skill: z.string().trim().min(1).max(120), reason: z.string().trim().min(1).max(1_000), practiceProject: z.string().trim().min(1).max(1_000), courseIds: z.array(z.string()).max(8) })).max(12), caveats: z.array(z.string().trim().min(1).max(500)).max(8) }),
  },
  salaryNarrative: {
    input: z.object({ research: salaryResearchSchema, calculatedRange: z.object({ low: z.number().nonnegative(), midpoint: z.number().nonnegative(), high: z.number().nonnegative() }).nullable(), confidence: z.enum(["not available", "low", "medium", "high"]) }),
    output: z.object({ narrative: z.string().trim().min(1).max(3_000), drivers: z.array(evidenceSuggestionSchema).max(12), adjacentRoles: z.array(z.object({ role: z.string().trim().min(1).max(160), rationale: z.string().trim().min(1).max(1_000) })).max(8), sources: z.array(sourceReferenceSchema).max(20), limitations: z.array(z.string().trim().min(1).max(500)).max(10) }),
  },
  researchJobs: {
    input: z.object({ roleTitles: z.array(z.string().trim().min(1).max(160)).min(1).max(10), locations: z.array(z.string().trim().min(1).max(160)).max(10), skills: z.array(z.string().trim().min(1).max(80)).max(30), workModes: z.array(z.enum(["remote", "hybrid", "onsite"])).max(3), profileContext: z.object({ headline: z.string().trim().max(180), summary: z.string().trim().max(1_000), currentRole: z.string().trim().max(120), industry: z.string().trim().max(120), achievements: z.array(z.string().trim().max(300)).max(12) }).optional(), approvedJobs: z.array(z.object({ id: z.string(), title: z.string(), employer: z.string(), location: z.string(), description: z.string(), canonicalUrl: webUrlSchema(), sourceName: z.string(), postedOn: z.string(), lastSeenOn: z.string(), salaryText: z.string() })).max(200) }),
    output: z.object({ matches: z.array(z.object({ jobId: z.string(), reason: z.string().trim().min(1).max(1_000), gaps: z.array(z.string().trim().min(1).max(500)).max(12), caution: z.string().trim().max(500) })).max(30), searchSuggestions: z.array(z.string().trim().min(1).max(240)).max(12) }),
  },
  supportResponse: {
    input: z.object({ question: z.string().trim().min(3).max(10_000), helpArticles: z.array(z.object({ title: z.string(), content: z.string(), url: webUrlSchema() })).max(30), accountContext: z.array(z.string().trim().min(1).max(500)).max(20) }),
    output: z.object({ answer: z.string().trim().min(1).max(5_000), articleUrls: z.array(webUrlSchema()).max(10), needsHuman: z.boolean(), escalationReason: z.string().trim().max(1_000) }),
  },
} as const;

export type AiTaskName = keyof typeof aiTaskSchemas;
export const aiTaskNameSchema = z.enum(Object.keys(aiTaskSchemas) as [AiTaskName, ...AiTaskName[]]);
export type AiTaskInput<T extends AiTaskName> = z.infer<(typeof aiTaskSchemas)[T]["input"]>;
export type AiTaskOutput<T extends AiTaskName> = z.infer<(typeof aiTaskSchemas)[T]["output"]>;

export const aiRunMetaSchema = z.object({
  generatedAt:z.string().optional(),
  generationParameters:z.record(z.string(),z.unknown()).optional(),
  task: aiTaskNameSchema,
  provider: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  policyVersion: z.string(),
  fallbackDepth: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  cached: z.boolean(),
  validation: z.enum(["passed", "failed", "fallback"]),
  repairAttempts: z.number().int().min(0).max(1).optional(),
  inputTokens: z.number().int().nonnegative().max(10_000_000).optional(),
  outputTokens: z.number().int().nonnegative().max(10_000_000).optional(),
  requestId:z.string().optional(),
});

export type AiRunMeta = z.infer<typeof aiRunMetaSchema>;
