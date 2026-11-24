import { z } from "zod";
import { webUrlSchema } from "./url";

export const courseCatalogEntrySchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,79}$/),
  provider: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(240),
  skills: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
  level: z.enum(["beginner", "intermediate", "advanced", "all-levels"]),
  duration: z.string().trim().min(1).max(160),
  priceLabel: z.string().trim().min(1).max(240),
  free: z.boolean(),
  url: webUrlSchema(),
  geography: z.array(z.string().trim().min(1).max(120)).max(30),
  languages: z.array(z.string().trim().min(1).max(120)).max(30),
  certificationType: z.string().trim().min(1).max(240),
  lastVerifiedOn: z.string().date(),
  availabilityNote: z.string().trim().min(1).max(1_000),
  affiliate: z.boolean().default(false),
  affiliateDisclosure: z.string().trim().max(500).default(""),
}).superRefine((value, context) => {
  if (value.affiliate && !value.affiliateDisclosure) context.addIssue({ code: "custom", path: ["affiliateDisclosure"], message: "Affiliate courses require a clear disclosure." });
});

export type CourseCatalogEntry = z.infer<typeof courseCatalogEntrySchema>;
