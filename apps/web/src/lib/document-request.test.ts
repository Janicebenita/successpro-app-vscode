import { describe, expect, it } from "vitest";
import { coverLetterDocumentRequestSchema, resumeDocumentRequestSchema } from "./document-request";

const base = {
  templateId: "clarity" as const,
  pageSize: "a4" as const,
  contact: { email: "candidate@example.com", phone: "", location: "Bengaluru", linkedIn: "", website: "" },
};

describe("document download requests", () => {
  it("accepts a safe resume request", () => {
    expect(resumeDocumentRequestSchema.safeParse(base).success).toBe(true);
  });

  it("rejects unsupported portrait data", () => {
    expect(resumeDocumentRequestSchema.safeParse({ ...base, photoDataUri: "data:image/svg+xml;base64,PHN2Zy8+" }).success).toBe(false);
  });

  it("accepts one intentional section order and rejects duplicate sections", () => {
    expect(resumeDocumentRequestSchema.safeParse({ ...base, sectionOrder: ["experience", "summary", "skills", "education"] }).success).toBe(true);
    expect(resumeDocumentRequestSchema.safeParse({ ...base, sectionOrder: ["experience", "skills", "experience"] }).success).toBe(false);
  });

  it("requires a complete, editable cover letter", () => {
    const result = coverLetterDocumentRequestSchema.safeParse({
      ...base,
      letter: {
        date: "23 September 2026",
        recipientName: "Hiring Manager",
        recipientTitle: "",
        company: "Example Ltd",
        companyAddress: "",
        targetRole: "Product Director",
        greeting: "Dear Hiring Manager,",
        paragraphs: ["A".repeat(50), "B".repeat(50), "C".repeat(50)],
        closing: "Yours sincerely,",
      },
    });
    expect(result.success).toBe(true);
  });
});
