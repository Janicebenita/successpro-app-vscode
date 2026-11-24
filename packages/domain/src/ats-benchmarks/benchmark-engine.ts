import type {
  AtsBenchmarkInput,
  AtsExtractedFields,
  AtsVendor,
  AtsVendorBenchmarkResult,
  ComprehensiveAtsReport,
} from "./types";

export function extractCoreAtsFields(input: AtsBenchmarkInput): AtsExtractedFields {
  const text = input.text;
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const emailMatch = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  const phoneMatch = text.match(/(?:\+?\d[\d\s()-]{7,}\d)/);
  const linkedInMatch = text.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  const dateTokens = text.match(/\b(?:19|20)\d{2}\b/g) ?? [];

  const lower = text.toLowerCase();
  const hasExperience = lower.includes("experience") || lower.includes("work history") || lower.includes("employment");
  const hasEducation = lower.includes("education") || lower.includes("academic") || lower.includes("university");
  const hasSkills = lower.includes("skills") || lower.includes("technologies") || lower.includes("competencies");

  // Name heuristic: First non-contact, non-heading line
  let name: string | null = null;
  for (const line of lines.slice(0, 5)) {
    if (line.length > 2 && line.length < 50 && !line.includes("@") && !line.includes("http") && !/summary|objective|resume|curriculum/i.test(line)) {
      name = line;
      break;
    }
  }

  const readingOrderLinear = !input.documentSignals?.multiColumn && !input.documentSignals?.criticalContentInHeaderFooter;

  return {
    name,
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0] : null,
    linkedIn: linkedInMatch ? linkedInMatch[0] : null,
    hasExperienceSection: hasExperience,
    hasEducationSection: hasEducation,
    hasSkillsSection: hasSkills,
    dateCount: dateTokens.length,
    readingOrderLinear,
  };
}

export function evaluateGreenhouseBenchmark(input: AtsBenchmarkInput): AtsVendorBenchmarkResult {
  const fields = extractCoreAtsFields(input);
  const deductions: Array<{ rule: string; penalty: number; description: string }> = [];
  let score = 100;

  if (input.documentSignals?.imageOnly) {
    deductions.push({ rule: "IMAGE_ONLY", penalty: 80, description: "Greenhouse requires digital selectable text." });
    score -= 80;
  }
  if (!fields.email) {
    deductions.push({ rule: "MISSING_EMAIL", penalty: 25, description: "Greenhouse uses email as primary candidate deduplication key." });
    score -= 25;
  }
  if (!fields.hasExperienceSection) {
    deductions.push({ rule: "NO_EXPERIENCE_SECTION", penalty: 20, description: "Could not identify standard Work History section." });
    score -= 20;
  }
  if (input.documentSignals?.tableHeavy) {
    deductions.push({ rule: "TABLE_FORMATTING_RISK", penalty: 15, description: "Complex tables may interleave columns in Greenhouse parser." });
    score -= 15;
  }
  if (fields.dateCount < 2) {
    deductions.push({ rule: "CHRONOLOGY_GAPS", penalty: 15, description: "Insufficient employment date tokens found for timeline construction." });
    score -= 15;
  }

  const finalScore = Math.max(10, Math.min(100, score));
  return {
    vendor: "greenhouse",
    supportedFileTypes: [".pdf", ".docx", ".doc", ".rtf", ".txt"],
    extractionSuccess: !input.documentSignals?.imageOnly && Boolean(fields.name || fields.email),
    parsedFields: fields,
    riskDeductions: deductions,
    complianceScore: finalScore,
    parsingConfidence: fields.readingOrderLinear ? 0.95 : 0.75,
    recommendations: deductions.map((d) => d.description),
  };
}

export function evaluateLeverBenchmark(input: AtsBenchmarkInput): AtsVendorBenchmarkResult {
  const fields = extractCoreAtsFields(input);
  const deductions: Array<{ rule: string; penalty: number; description: string }> = [];
  let score = 100;

  if (input.documentSignals?.imageOnly) {
    deductions.push({ rule: "UNREADABLE_IMAGE", penalty: 85, description: "Lever text extraction fails on flat image resumes." });
    score -= 85;
  }
  if (!fields.name) {
    deductions.push({ rule: "NAME_UNRESOLVED", penalty: 20, description: "Candidate name could not be parsed at document top." });
    score -= 20;
  }
  if (!fields.email) {
    deductions.push({ rule: "MISSING_EMAIL", penalty: 20, description: "Missing email address for profile ingestion." });
    score -= 20;
  }
  if (input.documentSignals?.multiColumn) {
    deductions.push({ rule: "MULTI_COLUMN_READING_ORDER", penalty: 15, description: "Lever may read multi-column text horizontally across blocks." });
    score -= 15;
  }
  if (!fields.hasSkillsSection) {
    deductions.push({ rule: "SKILLS_SECTION_MISSING", penalty: 10, description: "No explicit skills heading for automated tag extraction." });
    score -= 10;
  }

  const finalScore = Math.max(10, Math.min(100, score));
  return {
    vendor: "lever",
    supportedFileTypes: [".pdf", ".docx", ".doc", ".txt"],
    extractionSuccess: !input.documentSignals?.imageOnly && Boolean(fields.email),
    parsedFields: fields,
    riskDeductions: deductions,
    complianceScore: finalScore,
    parsingConfidence: fields.readingOrderLinear ? 0.92 : 0.72,
    recommendations: deductions.map((d) => d.description),
  };
}

export function evaluateWorkdayBenchmark(input: AtsBenchmarkInput): AtsVendorBenchmarkResult {
  const fields = extractCoreAtsFields(input);
  const deductions: Array<{ rule: string; penalty: number; description: string }> = [];
  let score = 100;

  if (input.documentSignals?.imageOnly) {
    deductions.push({ rule: "OCR_REQUIRED", penalty: 80, description: "Workday standard portal requires selectable text." });
    score -= 80;
  }
  if (!fields.hasExperienceSection || !fields.hasEducationSection) {
    deductions.push({ rule: "CORE_SECTION_BOUNDARY", penalty: 25, description: "Workday autofill requires discrete Experience and Education sections." });
    score -= 25;
  }
  if (fields.dateCount < 2) {
    deductions.push({ rule: "WORKDAY_DATE_GRID", penalty: 20, description: "Start and end dates missing for Workday role autofill grid." });
    score -= 20;
  }
  if (input.documentSignals?.criticalContentInHeaderFooter) {
    deductions.push({ rule: "HEADER_FOOTER_STRIP", penalty: 15, description: "Contact info placed in header/footer area may be stripped by Workday parser." });
    score -= 15;
  }

  const finalScore = Math.max(10, Math.min(100, score));
  return {
    vendor: "workday",
    supportedFileTypes: [".pdf", ".docx", ".doc", ".txt", ".odt"],
    extractionSuccess: !input.documentSignals?.imageOnly && Boolean(fields.hasExperienceSection),
    parsedFields: fields,
    riskDeductions: deductions,
    complianceScore: finalScore,
    parsingConfidence: fields.readingOrderLinear ? 0.90 : 0.68,
    recommendations: deductions.map((d) => d.description),
  };
}

export function runComprehensiveAtsBenchmark(input: AtsBenchmarkInput): ComprehensiveAtsReport {
  const greenhouse = evaluateGreenhouseBenchmark(input);
  const lever = evaluateLeverBenchmark(input);
  const workday = evaluateWorkdayBenchmark(input);

  const averageScore = Math.round((greenhouse.complianceScore + lever.complianceScore + workday.complianceScore) / 3);
  const allDeductions = [...greenhouse.riskDeductions, ...lever.riskDeductions, ...workday.riskDeductions];
  const uniquePitfalls = Array.from(new Set(allDeductions.map((d) => d.description)));

  return {
    overallAtsReadinessScore: averageScore,
    vendorBenchmarks: {
      greenhouse,
      lever,
      workday,
    },
    commonPitfalls: uniquePitfalls,
    unsupportedFormats: input.documentSignals?.imageOnly ? ["Scanned image PDF", "Low-resolution screenshot"] : [],
  };
}
