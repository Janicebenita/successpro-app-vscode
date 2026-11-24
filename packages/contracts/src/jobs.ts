import { z } from "zod";
import { webUrlSchema } from "./url";

export const jobSourceSchema = z.object({ id: z.string().min(1), type: z.enum(["greenhouse", "lever", "usajobs", "adzuna", "brightdata_google_jobs", "jobicy", "jooble"]), name: z.string().min(1), employer: z.string().default(""), token: z.string().default(""), region: z.enum(["global", "eu"]).default("global"), countryCode: z.string().regex(/^[a-z]{2}$/).default("in"), location: z.string().max(160).default(""), enabled: z.boolean(), termsReviewedOn: z.string().date(), termsUrl: webUrlSchema(), lastIngestedAt: z.string().optional() });
export const jobRecordSchema = z.object({ id: z.string().min(1), fingerprint: z.string().min(1), sourceId: z.string().min(1), sourceName: z.string().min(1), sourceJobId: z.string().min(1), canonicalUrl: webUrlSchema(), firstSeenOn: z.string().date(), lastSeenOn: z.string().date(), postedOn: z.string(), dateBasis: z.enum(["posted", "updated"]).optional(), employer: z.string().min(1), title: z.string().min(1), location: z.string(), employmentType: z.string(), salaryText: z.string(), description: z.string(), normalizedSkills: z.array(z.string()), freshness: z.enum(["current", "uncertain", "closed"]), workMode: z.enum(["remote", "hybrid", "onsite", "unknown"]) });
export type JobSource = z.infer<typeof jobSourceSchema>;
export type JobRecord = z.infer<typeof jobRecordSchema>;
