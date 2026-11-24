import { analyzeResume } from "@successpro/domain";

const signals = {
  extractionReliable: true,
  imageOnly: false,
  pageCount: 1,
  fontCount: 5,
  minimumFontSize: 8.8,
  hasVisualEvidence: true,
  multiColumn: false,
  tableHeavy: false,
  crowdedLayout: false,
  excessiveWhitespace: false,
  inconsistentMargins: false,
  excessiveColor: false,
  smallText: true,
  designWarnings: [],
};

const input = {
  text: "Aparna Khatri\n(212) 256-1414\nChicago, Illinois\naparna.khatri@gmail.com\naparnakhatri.com\n\nPROFILE\nSenior Product Designer with 6+ years of experience leading UI/UX systems. Increased customer retention by 32% and led cross-functional teams.\n\nEXPERIENCE\nLead Product Designer at TechCorp (2020 - Present)\n- Spearheaded design system adoption across 14 mobile applications.\n- Designed onboarding flows reducing abandonment rates by 28%.\n\nEDUCATION\nB.S. in Human Computer Interaction, University of Illinois (2018)\n\nSKILLS\nFigma, Design Systems, User Research, Prototyping, Wireframing",
  targetKeywords: ["Product Designer", "Figma", "Design Systems"],
  jobDescription: "",
  documentSignals: signals,
};

const result = analyzeResume(input);
console.log("Visual Design Score:", result.visualDesignScore);
console.log("Visual Design Status:", result.visualDesignStatus);
console.log("Visual Contribution:", result.visualContribution);
console.log("Content Quality Score:", result.contentQualityScore);
console.log("Content Contribution:", result.contentContribution);
console.log("Overall Score:", result.score);
console.log("Score Sources:", result.scoreSources);
