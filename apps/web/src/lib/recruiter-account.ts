import { z } from "zod";

export const recruiterApplicationSchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  organizationWebsite: z.string().url().max(500).refine((value) => value.startsWith("https://"), "Use a secure HTTPS organization website."),
  workEmail: z.string().email().max(254),
  recruiterTitle: z.string().trim().min(2).max(120),
  registrationJurisdiction: z.string().trim().min(2).max(120),
  registrationNumber: z.string().trim().min(3).max(100),
  hiringPurpose: z.string().trim().min(30).max(1_000),
  authorityConfirmed: z.literal(true),
});

export const recruiterDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(20).max(1_000),
});
