import { z } from "zod";

export const gapRiskSeveritySchema = z.enum(["Critical", "High", "Medium", "Low"]);
export type GapRiskSeverity = z.infer<typeof gapRiskSeveritySchema>;

export const gapRiskCategorySchema = z.enum([
  "timeline_gap",
  "missing_information",
  "content_quality",
  "contradiction",
  "ats_technical",
]);
export type GapRiskCategory = z.infer<typeof gapRiskCategorySchema>;

export const gapRiskFindingSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  category: gapRiskCategorySchema,
  severity: gapRiskSeveritySchema,
  pageNumber: z.number().int().min(1).nullable().optional(),
  pageLocation: z.string().optional().default("Document-wide"),
  evidenceExcerpt: z.string(),
  explanation: z.string(),
  whyItMatters: z.string(),
  recommendedCorrection: z.string(),
  confidence: z.enum(["High", "Medium", "Low"]).default("High"),
  isMandatory: z.boolean().default(false),
});
export type GapRiskFinding = Omit<z.infer<typeof gapRiskFindingSchema>, "pageLocation"> & {
  pageLocation?: string;
};

export const timelineGapDetailSchema = z.object({
  previousRole: z.string(),
  nextRole: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  durationMonths: z.number(),
  durationLabel: z.string(),
  severity: gapRiskSeveritySchema,
  explanationRequired: z.boolean(),
});
export type TimelineGapDetail = z.infer<typeof timelineGapDetailSchema>;

export const gapRiskSummarySchema = z.object({
  totalIssues: z.number().int().min(0),
  criticalCount: z.number().int().min(0),
  highCount: z.number().int().min(0),
  mediumCount: z.number().int().min(0),
  lowCount: z.number().int().min(0),
  categoryCounts: z.object({
    timeline_gap: z.number().int().min(0),
    missing_information: z.number().int().min(0),
    content_quality: z.number().int().min(0),
    contradiction: z.number().int().min(0),
    ats_technical: z.number().int().min(0),
  }),
});
export type GapRiskSummary = z.infer<typeof gapRiskSummarySchema>;

export const gapRiskResultSchema = z.object({
  summary: gapRiskSummarySchema,
  findings: z.array(gapRiskFindingSchema),
  timelineGaps: z.array(timelineGapDetailSchema),
  totalExperienceMonths: z.number().optional(),
  claimedExperienceYears: z.number().optional(),
  evaluatedAt: z.string(),
});
export type GapRiskResult = z.infer<typeof gapRiskResultSchema>;
