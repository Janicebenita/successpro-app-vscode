export type DocumentPagePreflight = {
  pageNumber: number;
  terminal: boolean;
  textCharacterCount: number;
  verticalUtilization: number;
  largestUnexplainedEmptyRegion: number;
  clippedElementCount: number;
  overlappingContentCount: number;
  outOfBoundsElementCount: number;
  isolatedHeadingCount: number;
  missingGlyphCount: number;
  extractionOrderMatches: boolean;
};

export type DocumentPreflightInput = {
  pageSize: "a4" | "letter";
  bodyFontSizes: number[];
  sectionHeadingFontSizes: number[];
  nameFontSize: number;
  fontsEmbedded: boolean;
  requiredFieldsPresent: boolean;
  internalMetadataClean: boolean;
  pages: DocumentPagePreflight[];
};

export type DocumentPreflightFinding = {
  code: string;
  pageNumber?: number;
  message: string;
};

export function evaluateDocumentPreflight(input: DocumentPreflightInput) {
  const findings: DocumentPreflightFinding[] = [];
  if (!input.pages.length) findings.push({ code: "no-pages", message: "The PDF contains no pages." });
  if (!input.fontsEmbedded) findings.push({ code: "fonts-not-embedded", message: "Every PDF font must be embedded." });
  if (!input.requiredFieldsPresent) findings.push({ code: "missing-required-content", message: "Required document content is missing from the exported PDF." });
  if (!input.internalMetadataClean) findings.push({ code: "unsafe-metadata", message: "The PDF contains internal or private processing metadata." });
  if (input.bodyFontSizes.some((size) => size < 8 || size > 9)) findings.push({ code: "body-font-size", message: "Body text must remain between 8 and 9 pt." });
  if (input.sectionHeadingFontSizes.some((size) => size < 9 || size > 10)) findings.push({ code: "heading-font-size", message: "Section headings must remain between 9 and 10 pt." });
  if (input.nameFontSize < 12 || input.nameFontSize > 14) findings.push({ code: "name-font-size", message: "The candidate name must remain between 12 and 14 pt." });

  for (const page of input.pages) {
    const pageNumber = page.pageNumber;
    if (page.textCharacterCount === 0) findings.push({ code: "blank-page", pageNumber, message: `Page ${pageNumber} is blank.` });
    if (!page.terminal && page.verticalUtilization < 0.76) findings.push({ code: "underfilled-page", pageNumber, message: `Page ${pageNumber} uses less than 76% of its usable height.` });
    if (page.largestUnexplainedEmptyRegion > 0.18) findings.push({ code: "excessive-whitespace", pageNumber, message: `Page ${pageNumber} contains an unexplained empty region larger than 18% of the usable area.` });
    if (page.clippedElementCount) findings.push({ code: "clipped-content", pageNumber, message: `Page ${pageNumber} contains clipped content.` });
    if (page.overlappingContentCount) findings.push({ code: "overlapping-content", pageNumber, message: `Page ${pageNumber} contains overlapping content.` });
    if (page.outOfBoundsElementCount) findings.push({ code: "out-of-bounds", pageNumber, message: `Page ${pageNumber} contains content outside the safe page area.` });
    if (page.isolatedHeadingCount) findings.push({ code: "isolated-heading", pageNumber, message: `Page ${pageNumber} contains a heading separated from its content.` });
    if (page.missingGlyphCount) findings.push({ code: "missing-glyph", pageNumber, message: `Page ${pageNumber} contains missing or substituted glyphs.` });
    if (!page.extractionOrderMatches) findings.push({ code: "extraction-order", pageNumber, message: `Page ${pageNumber} does not extract in the intended reading order.` });
  }

  return { passed: findings.length === 0, findings };
}

