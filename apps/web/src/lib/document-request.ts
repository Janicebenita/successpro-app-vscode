import { z } from "zod";

const templateIdSchema = z.enum(["clarity", "signature", "momentum", "editorial"]);
const pageSizeSchema = z.enum(["a4", "letter"]);
const optionalUrlSchema = z.union([z.literal(""), z.string().url().max(500)]).default("");
const photoSchema = z.string().regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/).max(3_000_000).optional();
export const resumeSectionIds = ["summary", "skills", "experience", "projects", "education", "certifications", "awards", "languages", "links", "publications", "volunteer"] as const;
export const resumeSectionIdSchema = z.enum(resumeSectionIds);

export const documentContactSchema = z.object({
  email: z.string().email().max(254),
  phone: z.string().trim().max(40).default(""),
  location: z.string().trim().max(120).default(""),
  linkedIn: optionalUrlSchema,
  website: optionalUrlSchema,
});

export const resumeDocumentRequestSchema = z.object({
  templateId: templateIdSchema,
  pageSize: pageSizeSchema.default("a4"),
  photoDataUri: photoSchema,
  contact: documentContactSchema,
  // Omitted preserves the professionally balanced default layout. A supplied
  // order is explicit customer intent and is applied consistently to PDF/DOCX.
  sectionOrder: z.array(resumeSectionIdSchema).min(1).max(resumeSectionIds.length).refine((items) => new Set(items).size === items.length, "Each resume section can appear only once.").optional(),
});

export const coverLetterDocumentRequestSchema = resumeDocumentRequestSchema.extend({
  letter: z.object({
    date: z.string().trim().min(3).max(80),
    recipientName: z.string().trim().max(120).default(""),
    recipientTitle: z.string().trim().max(120).default(""),
    company: z.string().trim().min(2).max(180),
    companyAddress: z.string().trim().max(240).default(""),
    targetRole: z.string().trim().min(2).max(160),
    greeting: z.string().trim().min(2).max(120),
    paragraphs: z.array(z.string().trim().min(40).max(1_500)).min(3).max(6),
    closing: z.string().trim().min(2).max(80),
  }),
});

export type ResumeDocumentRequest = z.infer<typeof resumeDocumentRequestSchema>;
export type CoverLetterDocumentRequest = z.infer<typeof coverLetterDocumentRequestSchema>;
export type ResumeSectionId = z.infer<typeof resumeSectionIdSchema>;
