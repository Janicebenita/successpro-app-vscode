import { describe, expect, it } from "vitest";
import { evaluateDocumentPreflight, type DocumentPreflightInput } from "@successpro/domain";

const passingDocument: DocumentPreflightInput = {
  pageSize: "a4",
  bodyFontSizes: [8.5, 9],
  sectionHeadingFontSizes: [9.5, 10],
  nameFontSize: 14,
  fontsEmbedded: true,
  requiredFieldsPresent: true,
  internalMetadataClean: true,
  pages: [
    { pageNumber: 1, terminal: false, textCharacterCount: 2_100, verticalUtilization: 0.9, largestUnexplainedEmptyRegion: 0.08, clippedElementCount: 0, overlappingContentCount: 0, outOfBoundsElementCount: 0, isolatedHeadingCount: 0, missingGlyphCount: 0, extractionOrderMatches: true },
    { pageNumber: 2, terminal: true, textCharacterCount: 1_200, verticalUtilization: 0.68, largestUnexplainedEmptyRegion: 0.14, clippedElementCount: 0, overlappingContentCount: 0, outOfBoundsElementCount: 0, isolatedHeadingCount: 0, missingGlyphCount: 0, extractionOrderMatches: true },
  ],
};

describe("resume and cover-letter PDF preflight", () => {
  it("passes a balanced, readable, extractable document", () => {
    expect(evaluateDocumentPreflight(passingDocument)).toEqual({ passed: true, findings: [] });
  });

  it("blocks blank, scattered, clipped, overlapping, and unreadable output", () => {
    const result = evaluateDocumentPreflight({
      ...passingDocument,
      bodyFontSizes: [7.5],
      pages: [
        { pageNumber: 1, terminal: false, textCharacterCount: 500, verticalUtilization: 0.4, largestUnexplainedEmptyRegion: 0.3, clippedElementCount: 1, overlappingContentCount: 2, outOfBoundsElementCount: 1, isolatedHeadingCount: 1, missingGlyphCount: 1, extractionOrderMatches: false },
        { pageNumber: 2, terminal: true, textCharacterCount: 0, verticalUtilization: 0, largestUnexplainedEmptyRegion: 1, clippedElementCount: 0, overlappingContentCount: 0, outOfBoundsElementCount: 0, isolatedHeadingCount: 0, missingGlyphCount: 0, extractionOrderMatches: true },
      ],
    });
    expect(result.passed).toBe(false);
    expect(result.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(["body-font-size", "underfilled-page", "excessive-whitespace", "clipped-content", "overlapping-content", "out-of-bounds", "isolated-heading", "missing-glyph", "extraction-order", "blank-page"]));
  });
});

