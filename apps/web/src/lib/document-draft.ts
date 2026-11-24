import { z } from "zod";
import { resumeSectionIdSchema, resumeSectionIds } from "./document-request";

export const documentDraftSchema = z.object({
  templateId: z.enum(["clarity", "signature", "momentum", "editorial"]), pageSize: z.enum(["a4", "letter"]),
  contact: z.object({ email: z.string().email(), phone: z.string().max(40), location: z.string().max(120), linkedIn: z.union([z.literal(""), z.string().url()]), website: z.union([z.literal(""), z.string().url()]) }),
  role: z.string().max(160), company: z.string().max(180), focus: z.string().max(1_000), jobDescription: z.string().max(100_000),
  tone: z.enum(["warm", "direct", "executive"]), recipientName: z.string().max(120), recipientTitle: z.string().max(120), companyAddress: z.string().max(240), letterText: z.string().max(20_000),
  sectionOrder: z.array(resumeSectionIdSchema).min(1).max(resumeSectionIds.length).refine((items) => new Set(items).size === items.length).optional(),
});
