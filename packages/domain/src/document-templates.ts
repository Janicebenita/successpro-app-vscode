export type DocumentTemplateId = "clarity" | "signature" | "momentum" | "editorial";
export type PageSize = "a4" | "letter";
export type LayoutKind = "single-column" | "sidebar" | "timeline" | "modular";

export type DocumentTypography = {
  family: "Inter" | "Source Sans 3" | "Noto Sans";
  bodyPt: number;
  sectionHeadingPt: number;
  namePt: number;
  roleTitlePt: number;
  metadataPt: number;
  lineHeight: number;
};

export type DocumentTemplate = {
  id: DocumentTemplateId;
  name: string;
  summary: string;
  layout: LayoutKind;
  photo: "not-supported" | "optional";
  atsConfidence: "highest" | "high";
  typography: DocumentTypography;
  accent: { primary: string; secondary: string; neutral: string };
  coverLetter: {
    usesSameTheme: true;
    preferredPages: 1;
    minimumWords: 250;
    maximumWords: 450;
  };
};

const sharedCoverLetter = {
  usesSameTheme: true as const,
  preferredPages: 1 as const,
  minimumWords: 250 as const,
  maximumWords: 450 as const,
};

export const documentTemplates: readonly DocumentTemplate[] = [
  {
    id: "clarity",
    name: "Clarity",
    summary: "A clean, single-column design with the strongest parsing reliability.",
    layout: "single-column",
    photo: "not-supported",
    atsConfidence: "highest",
    typography: { family: "Inter", bodyPt: 8.7, sectionHeadingPt: 9.5, namePt: 14, roleTitlePt: 8.9, metadataPt: 8, lineHeight: 1.26 },
    accent: { primary: "#203A5F", secondary: "#64748B", neutral: "#303B4A" },
    coverLetter: sharedCoverLetter,
  },
  {
    id: "signature",
    name: "Signature",
    summary: "An executive composition with an optional portrait and achievement-led main column.",
    layout: "sidebar",
    photo: "optional",
    atsConfidence: "high",
    typography: { family: "Source Sans 3", bodyPt: 8.7, sectionHeadingPt: 9.7, namePt: 14, roleTitlePt: 9, metadataPt: 8, lineHeight: 1.26 },
    accent: { primary: "#222B35", secondary: "#716A63", neutral: "#3F4852" },
    coverLetter: sharedCoverLetter,
  },
  {
    id: "momentum",
    name: "Momentum",
    summary: "A restrained timeline design for clear career progression and project-led histories.",
    layout: "timeline",
    photo: "optional",
    atsConfidence: "high",
    typography: { family: "Inter", bodyPt: 8.7, sectionHeadingPt: 9.5, namePt: 13.5, roleTitlePt: 8.9, metadataPt: 8, lineHeight: 1.26 },
    accent: { primary: "#214B75", secondary: "#607B96", neutral: "#34404D" },
    coverLetter: sharedCoverLetter,
  },
  {
    id: "editorial",
    name: "Editorial",
    summary: "A text-rich modular design for experts, researchers, academics, and technical careers.",
    layout: "modular",
    photo: "optional",
    atsConfidence: "high",
    typography: { family: "Noto Sans", bodyPt: 8.7, sectionHeadingPt: 9.5, namePt: 13.5, roleTitlePt: 8.9, metadataPt: 8, lineHeight: 1.26 },
    accent: { primary: "#242B33", secondary: "#66727F", neutral: "#363F49" },
    coverLetter: sharedCoverLetter,
  },
] as const;

export function validateDocumentTypography(typography: DocumentTypography) {
  const errors: string[] = [];
  if (typography.bodyPt < 8 || typography.bodyPt > 9) errors.push("Body text must be between 8 and 9 pt.");
  if (typography.sectionHeadingPt < 9 || typography.sectionHeadingPt > 10) errors.push("Section headings must be between 9 and 10 pt.");
  if (typography.namePt < 12 || typography.namePt > 14) errors.push("The candidate name must be between 12 and 14 pt.");
  if (typography.metadataPt < 8 || typography.metadataPt > 9) errors.push("Metadata must be between 8 and 9 pt.");
  if (typography.lineHeight < 1.16 || typography.lineHeight > 1.28) errors.push("Line height must be between 1.16 and 1.28.");
  return { valid: errors.length === 0, errors };
}

export function getDocumentTemplate(id: DocumentTemplateId) {
  const template = documentTemplates.find((candidate) => candidate.id === id);
  if (!template) throw new Error(`Unknown document template: ${id}`);
  return template;
}
