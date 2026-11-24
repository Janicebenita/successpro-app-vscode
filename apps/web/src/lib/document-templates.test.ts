import { describe, expect, it } from "vitest";
import { documentTemplates, getDocumentTemplate, validateDocumentTypography } from "@successpro/domain";

describe("resume and cover-letter style registry", () => {
  it("offers distinct original style families", () => {
    expect(documentTemplates.map((template) => template.id)).toEqual(["clarity", "signature", "momentum", "editorial"]);
    expect(new Set(documentTemplates.map((template) => template.layout)).size).toBe(4);
  });

  it.each(documentTemplates)("keeps $name within the approved typography contract", (template) => {
    expect(validateDocumentTypography(template.typography)).toEqual({ valid: true, errors: [] });
  });

  it.each(documentTemplates)("locks the $name cover letter to the resume theme", (template) => {
    expect(template.coverLetter).toMatchObject({ usesSameTheme: true, preferredPages: 1, minimumWords: 250, maximumWords: 450 });
  });

  it("provides photo-optional styles without making a photograph mandatory", () => {
    expect(documentTemplates.filter((template) => template.photo === "optional")).toHaveLength(3);
    expect(documentTemplates.every((template) => template.photo !== ("required" as never))).toBe(true);
  });

  it("rejects typography that would create unreadable or oversized output", () => {
    const invalid = validateDocumentTypography({ ...getDocumentTemplate("clarity").typography, bodyPt: 7.5, sectionHeadingPt: 11, namePt: 15 });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toHaveLength(3);
  });
});

