import { z } from "zod";

export const recruiterJobInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  department: z.string().trim().min(2).max(100),
  location: z.string().trim().min(2).max(160),
  workMode: z.enum(["remote", "hybrid", "onsite"]),
  employmentType: z.enum(["full-time", "part-time", "contract", "internship"]),
  experienceMinimum: z.number().int().min(0).max(60),
  experienceMaximum: z.number().int().min(0).max(60),
  ctcMinimum: z.number().nonnegative().max(1_000_000_000),
  ctcMaximum: z.number().nonnegative().max(1_000_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  description: z.string().trim().min(100).max(20_000),
  skills: z.array(z.string().trim().min(1).max(80)).max(40),
}).refine((value) => value.experienceMinimum <= value.experienceMaximum, { message: "Maximum experience must be at least the minimum." }).refine((value) => value.ctcMinimum <= value.ctcMaximum, { message: "Maximum compensation must be at least the minimum." });

export function matchesRecruiterJob(job: Record<string, unknown>, filters: URLSearchParams) {
  const contains = (field: string, query: string | null) => !query || String(job[field] ?? "").toLowerCase().includes(query.toLowerCase());
  const experience = Number(filters.get("experience")); const ctc = Number(filters.get("ctc"));
  return contains("title", filters.get("role")) && contains("department", filters.get("department")) && contains("location", filters.get("location"))
    && (!Number.isFinite(experience) || (experience >= Number(job.experienceMinimum) && experience <= Number(job.experienceMaximum)))
    && (!Number.isFinite(ctc) || ctc >= Number(job.ctcMinimum));
}
