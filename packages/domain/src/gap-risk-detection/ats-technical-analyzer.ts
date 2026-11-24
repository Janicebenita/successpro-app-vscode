import type { GapRiskFinding } from "./types";
import type { DocumentSignals } from "@successpro/contracts";

export function analyzeAtsTechnical(
  text: string,
  signals: Partial<DocumentSignals> = {}
): GapRiskFinding[] {
  const findings: GapRiskFinding[] = [];

  // 1. Scanned Image / OCR Unreliable
  if (signals.imageOnly || /\[(?:Vision OCR error|Scanned.*Image Resume)/i.test(text)) {
    findings.push({
      id: "ats-image-based-resume",
      title: "Scanned or Image-Based PDF File",
      category: "ats_technical",
      severity: "Critical",
      evidenceExcerpt: "Document is composed of flattened images or scanned graphics without selectable text layers.",
      explanation: "Standard corporate ATS parsers (Taleo, Workday, iCIMS) cannot extract selectable text from image-only PDFs.",
      whyItMatters: "Image-only resumes fail automated screening completely, resulting in immediate 0% match rejection.",
      recommendedCorrection: "Re-export your resume directly from Microsoft Word, Google Docs, or LaTeX using standard 'Save as PDF' with selectable text.",
      confidence: "High",
      isMandatory: true,
    });
  }

  // 2. Multi-column Reading Order Risk
  if (signals.multiColumn || /reading_order|column_order/i.test(signals.designWarnings?.join(" ") ?? "")) {
    findings.push({
      id: "ats-multi-column-reading-order",
      title: "Multi-Column Layout Reading Order Risk",
      category: "ats_technical",
      severity: "High",
      evidenceExcerpt: "Two-column or multi-column structural layout detected.",
      explanation: "Many traditional ATS parsers read across the entire width of the page from left to right, combining words from column 1 and column 2 into jumbled sentences.",
      whyItMatters: "When an ATS reads across columns, job titles get concatenated with unrelated dates or skill names, breaking skill extraction.",
      recommendedCorrection: "Use a clean, single-column reverse-chronological layout for maximum ATS compatibility across all job portals.",
      confidence: "High",
      isMandatory: false,
    });
  }

  // 3. Unreadable Symbols / Character Encoding Corruptions
  const encodingGlitches = text.match(/[\uFFFD]|â€™|â€œ|â€|Ã©|Â/g);
  if (encodingGlitches && encodingGlitches.length >= 2) {
    findings.push({
      id: "ats-unreadable-symbols",
      title: "Character Encoding Artifacts / Unreadable Symbols",
      category: "ats_technical",
      severity: "High",
      evidenceExcerpt: `Detected corrupted characters: ${[...new Set(encodingGlitches)].join(" ")}`,
      explanation: "Your resume contains non-standard ligature symbols or font encoding errors (e.g. broken apostrophes, quotes, or bullets).",
      whyItMatters: "Encoding corruptions cause ATS text parsers to drop surrounding words or fail keyword matching.",
      recommendedCorrection: "Stick to standard UTF-8 characters and standard system fonts (Arial, Calibri, Helvetica, Times New Roman).",
      confidence: "High",
      isMandatory: false,
    });
  }

  // 4. Missing Standard ATS Section Headings
  const standardSections = [
    { name: "Experience / Work History", pattern: /\b(?:professional\s+experience|work\s+experience|employment\s+(?:history|details)|career\s+history|experience)\b/i },
    { name: "Education", pattern: /\b(?:education|academic\s+(?:background|details|qualifications))\b/i },
    { name: "Skills / Technical Proficiencies", pattern: /\b(?:skills|technical\s+skills|core\s+competencies|technologies)\b/i },
  ];

  for (const sec of standardSections) {
    if (!sec.pattern.test(text)) {
      findings.push({
        id: `ats-missing-heading-${sec.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        title: `Missing Standard Section Heading: ${sec.name}`,
        category: "ats_technical",
        severity: "High",
        evidenceExcerpt: `No recognized "${sec.name}" heading found in resume body.`,
        explanation: `Standard ATS parsers search for recognized headings like "${sec.name}" to segment candidate profiles.`,
        whyItMatters: "Non-standard or creative headings (e.g. 'Where I have been' or 'My Journey') confuse automated parsers.",
        recommendedCorrection: `Use conventional industry-standard headings like 'Experience', 'Education', and 'Skills'.`,
        confidence: "High",
        isMandatory: true,
      });
    }
  }

  // 5. Visual Text Collision / Element Overlap
  const collisionWarning = signals.designWarnings?.find((w) => /collision|overlap/i.test(w));
  if ((signals as any).textCollision || collisionWarning) {
    findings.push({
      id: "ats-text-collision-overlap",
      title: "Visual Text Collision / Header Element Overlap",
      category: "ats_technical",
      severity: "High",
      evidenceExcerpt: collisionWarning ?? "Direct bounding-box vertical collision detected between text lines.",
      explanation: "Two or more text elements (such as the candidate name and contact information header) collide or overlap vertically on the page.",
      whyItMatters: "Colliding text boxes create character-merging OCR parsing errors in ATS systems and present an immediately visible formatting defect to recruiters.",
      recommendedCorrection: "Increase vertical padding and line-height between the header elements to maintain at least 8–12 pt clearance (Scoring Rule V03).",
      confidence: "High",
      isMandatory: true,
    });
  }

  // 6. Excessive Whitespace / Trailing Page Break
  if (signals.excessiveWhitespace || signals.crowdedLayout) {
    findings.push({
      id: "ats-excessive-whitespace",
      title: "Unbalanced Spacing or Trailing Page Artifacts",
      category: "ats_technical",
      severity: "Medium",
      evidenceExcerpt: signals.excessiveWhitespace ? "Excessive trailing whitespace detected." : "Crowded vertical line density detected.",
      explanation: "Document has uneven spacing, trailing page overflows, or crowded margins.",
      whyItMatters: "Accidental trailing pages with only 2-3 lines of text look unpolished to human recruiters.",
      recommendedCorrection: "Adjust line spacing and margins so content fills full pages cleanly (e.g. exactly 1 or 2 full pages).",
      confidence: "Medium",
      isMandatory: false,
    });
  }

  return findings;
}
