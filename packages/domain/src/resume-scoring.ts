import type { FactorResult, ResumeAnalysisInput, ResumeAnalysisResult } from "@successpro/contracts";
import { resumeAnalysisInputSchema } from "@successpro/contracts";
import { calculateOverallScore } from "./scoring-config";
import { analyzeJobMatch } from "./job-match";

const ACTION_VERBS = ["achieved", "built", "created", "delivered", "designed", "developed", "drove", "improved", "increased", "launched", "led", "managed", "optimized", "reduced", "resolved", "scaled", "spearheaded", "streamlined"];
const SECTION_PATTERNS = {
  summary: ["summary", "professional summary", "profile", "career profile", "executive profile"],
  experience: ["experience", "professional experience", "work experience", "career history", "employment history"],
  education: ["education", "academic background", "qualifications"],
  skills: ["skills", "key skills", "core skills", "competencies", "areas of expertise", "technical skills"],
  projects: ["projects", "selected projects", "key projects"],
  certifications: ["certifications", "certificates", "professional development"],
  volunteer: ["volunteer experience", "social experience", "community experience"],
} as const;
const PROFESSIONAL_TERMS = ["strategy", "leadership", "stakeholder", "impact", "results", "expertise", "specialist", "professional", "experience"];

function normalizedWords(text: string) {
  return text.toLowerCase().match(/[a-z0-9+#.-]+/g) ?? [];
}

function clamp(value: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(value)));
}

function factor(input: Omit<FactorResult, "earned"> & { earned: number }): FactorResult {
  return { ...input, earned: clamp(input.earned, input.maximum) };
}

function sectionNames(lines: string[]) {
  return Object.keys(SECTION_PATTERNS).filter((name) => lines.some((line) => headingKey(line) === name));
}

function headingKey(line: string) {
  const trimmed = line.replace(/^[|:•·\-–—\s]+/, "").trim();
  const compact = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  const exact = Object.entries(SECTION_PATTERNS).find(([, aliases]) => aliases.some((alias) => compact === alias.replace(/[^a-z]/g, "")))?.[0];
  if (exact) return exact;
  return Object.entries(SECTION_PATTERNS).find(([, aliases]) => aliases.some((alias) => {
    const prefix = trimmed.slice(0, alias.length);
    const next = trimmed.slice(alias.length, alias.length + 1);
    return prefix.toLowerCase() === alias && prefix === prefix.toUpperCase() && (!next || /[\s:|\-–—]/.test(next) || /[A-Z]/.test(next));
  }))?.[0] ?? null;
}

function quote(text: string) {
  const value = text.replace(/^[•·\-*\s]+/, "").replace(/\s+/g, " ").trim();
  return value.length > 180 ? `${value.slice(0, 177)}…` : value;
}

function examples(lines: string[], predicate: (line: string) => boolean, limit = 2) {
  return lines.filter((line) => predicate(line) && line.length >= 18).slice(0, limit).map((line) => `“${quote(line)}”`);
}

function applyStrictCalibration(factors: FactorResult[], reductionPercent = 20) {
  const multiplier = (100 - reductionPercent) / 100;
  const rawScore = factors.reduce((total, item) => total + item.earned, 0);
  const targetScore = Math.round(rawScore * multiplier);
  const scaled = factors.map((item, index) => {
    const exact = item.earned * multiplier;
    return { item, index, earned: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let pointsToDistribute = targetScore - scaled.reduce((total, item) => total + item.earned, 0);
  for (const candidate of scaled.slice().sort((a, b) => b.remainder - a.remainder || a.index - b.index)) {
    if (pointsToDistribute <= 0) break;
    if (candidate.earned < candidate.item.earned) {
      candidate.earned += 1;
      pointsToDistribute -= 1;
    }
  }
  return {
    rawScore,
    factors: scaled.sort((a, b) => a.index - b.index).map(({ item, earned }) => ({ ...item, earned })),
  };
}

export function analyzeResume(input: ResumeAnalysisInput): Omit<ResumeAnalysisResult, "score" | "rawScore"> & { score: number; rawScore: number; overallScore: number } {
  const parsed = resumeAnalysisInputSchema.parse(input);
  const text = parsed.text.replace(/\r/g, "");
  const lower = text.toLowerCase();
  const words = normalizedWords(text);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const wordCount = words.length;
  const sections = sectionNames(lines);
  const actionCount = ACTION_VERBS.filter((verb) => lower.includes(verb)).length;
  const quantifiedCount = (text.match(/\b(?:\d+(?:\.\d+)?%?|₹\s?\d+|\$\s?\d+|\d+x)\b/gi) ?? []).length;
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text);
  const phone = /(?:\+?\d[\d\s()-]{7,}\d)/.test(text);
  const linkedIn = /linkedin\.com\/in\//i.test(text);
  const averageLineWords = lines.length ? wordCount / lines.length : wordCount;
  const skillIndex = lines.findIndex((line) => headingKey(line) === "skills");
  const skillBody = skillIndex < 0 ? [] : lines.slice(skillIndex + 1, lines.findIndex((line, index) => index > skillIndex && headingKey(line) !== null) > skillIndex ? lines.findIndex((line, index) => index > skillIndex && headingKey(line) !== null) : undefined);
  const inlineSkill = lines.find((line) => /^skills?\s*[:|-]/i.test(line))?.replace(/^skills?\s*[:|-]\s*/i, "") ?? "";
  const bulletSkillLines = skillBody.filter((line) => /^[•·▪◦*-]\s*/.test(line));
  const experienceIndex = lines.findIndex((line) => headingKey(line) === "experience");
  const earlyExperience = experienceIndex < 0 ? [] : lines.slice(experienceIndex + 1, experienceIndex + 18);
  const firstDatedLine = earlyExperience.findIndex((line) => /\b(?:19|20)\d{2}\b|\bpresent\b/i.test(line));
  const skillSpillover = skillIndex >= 0 && experienceIndex > skillIndex && firstDatedLine >= 0
    ? earlyExperience.slice(0, firstDatedLine).filter((line) => /^[•·▪◦*-]\s*\p{L}/u.test(line) && line.replace(/^[•·▪◦*-]\s*/, "").split(/\s+/).length <= 4)
    : [];
  const skillCandidates = [inlineSkill, ...(bulletSkillLines.length ? bulletSkillLines : skillBody.filter((line) => /[,|•]/.test(line) || line.split(/\s+/).length <= 6)), ...skillSpillover].filter(Boolean);
  const skillCount = [...new Set(skillCandidates.flatMap((line) => line.split(/(?:\s{2,}-\s+)|[,|•]/)).map((value) => value.replace(/^[•·▪◦*-]\s*/, "").trim()).filter((value) => value.length > 1 && value.length <= 80 && headingKey(value) === null))].length;
  const keywordSet = new Set(words);
  const matchedKeywords = parsed.targetKeywords.filter((keyword) => keywordSet.has(keyword.toLowerCase()));
  const firstHeading = lines.findIndex((line) => headingKey(line) !== null);
  const introduction = lines.slice(0, firstHeading >= 0 ? firstHeading : 12);
  const unlabelledSummary = introduction.filter((line) => line.length >= 80 && !/@|https?:|www\./i.test(line) && /[.!?]$/.test(line));
  const summaryPresent = sections.includes("summary") || unlabelledSummary.length > 0;
  const dateTokens = text.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  const pageCount = parsed.documentSignals.pageCount;
  const lengthScore = pageCount && pageCount > 3 ? 3 : wordCount >= 250 && wordCount <= 1_100 ? 8 : wordCount >= 150 && wordCount <= 1_400 ? 6 : 3;
  const visualProblems = [parsed.documentSignals.multiColumn, parsed.documentSignals.tableHeavy, parsed.documentSignals.crowdedLayout, parsed.documentSignals.excessiveWhitespace, parsed.documentSignals.inconsistentMargins, parsed.documentSignals.excessiveColor, parsed.documentSignals.smallText].filter(Boolean).length;
  const quantifiedExamples = examples(lines, (line) => /(?:\b\d+(?:\.\d+)?%|₹\s?\d+|\$\s?\d+|\b\d+x\b)/i.test(line));
  const actionExamples = examples(lines, (line) => ACTION_VERBS.some((verb) => new RegExp(`\\b${verb}\\b`, "i").test(line)));
  const skillExamples = skillCandidates.filter(Boolean).slice(0, 3).map((line) => `Resume example: “${quote(line)}”`);
  const summaryIndex = lines.findIndex((line) => headingKey(line) === "summary");
  const summaryExample = summaryIndex >= 0 ? examples(lines.slice(summaryIndex + 1, summaryIndex + 5), () => true, 1) : examples(unlabelledSummary, () => true, 1);

  const factors: FactorResult[] = [
    factor({ id: "parseability", label: "Readable by hiring software", maximum: 12, earned: parsed.documentSignals.imageOnly ? 1 : parsed.documentSignals.extractionReliable ? 12 : 6, evidence: [parsed.documentSignals.imageOnly ? "The file appears to contain only an image." : "The resume text could be read successfully."], issues: parsed.documentSignals.extractionReliable && !parsed.documentSignals.imageOnly ? [] : [{ severity: "Critical", message: "Some hiring systems may not be able to read this resume correctly." }], action: "Use a PDF with selectable text or a DOCX file, then check that the content appears in the right order." }),
    factor({
      id: "formatting",
      label: "Layout and visual presentation",
      maximum: 10,
      earned: Math.max(0, Math.min(10, 10 - (parsed.documentSignals.multiColumn ? 3 : 0) - (parsed.documentSignals.tableHeavy ? 3 : 0) - (parsed.documentSignals.criticalContentInHeaderFooter ? 2 : 0) - (parsed.documentSignals.crowdedLayout ? 2 : 0) - (parsed.documentSignals.excessiveWhitespace ? 1 : 0) - (parsed.documentSignals.inconsistentMargins ? 1 : 0) - (parsed.documentSignals.excessiveColor ? 1 : 0) - (parsed.documentSignals.smallText ? 2 : 0))),
      evidence: [`Checked ${pageCount ? `${pageCount} page${pageCount === 1 ? "" : "s"}` : "the supplied content"} for columns, tables, text size, spacing, margins, density, and visual balance.`, visualProblems ? `Found ${visualProblems} visual or layout concern${visualProblems === 1 ? "" : "s"}.` : "No obvious visual-layout concern was detected."],
      issues: visualProblems ? [{ severity: visualProblems >= 3 ? "High" : "Medium", message: "The page design may be harder to scan or may distract from the content." }] : [],
      action: visualProblems ? "Use readable type, consistent margins, balanced spacing, restrained colour, and a clear reading order." : "Keep the visual hierarchy consistent and make every design choice support quick reading.",
    }),
    factor({ id: "structure", label: "Resume structure", maximum: 8, earned: Math.min(8, sections.length * 1.5 + (sections.includes("experience") ? 1 : 0)), evidence: [`Recognised section headings: ${sections.join(", ") || "none"}.`], issues: sections.length >= 4 ? [] : [{ severity: "High", message: "Some core sections could not be identified clearly." }], action: "Use clear, conventional headings for Summary, Experience, Education, and Skills so readers can find them immediately." }),
    factor({ id: "contact", label: "Contact details", maximum: 4, earned: (email ? 2 : 0) + (phone ? 1 : 0) + (linkedIn ? 1 : 0), evidence: [`Email ${email ? "found" : "not found"}; phone ${phone ? "found" : "not found"}; LinkedIn ${linkedIn ? "found" : "not found"}.`], issues: email ? [] : [{ severity: "Critical", message: "A professional email address was not found." }], action: "Place your name, email, phone, location, and profile link near the top of the resume." }),
    factor({ id: "language", label: "Length and writing quality", maximum: 8, earned: lengthScore, evidence: [`${wordCount} words${pageCount ? ` across ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""} were available for review.`], issues: lengthScore >= 6 ? [] : [{ severity: "Medium", message: pageCount && pageCount > 3 ? "The resume may be longer than most recruiters can review quickly." : "The resume may be too short or too long for its content." }], action: "Aim for concise, role-relevant detail, then proofread every bullet and keep tense consistent." }),
    factor({ id: "readability", label: "Easy to scan", maximum: 8, earned: averageLineWords <= 22 ? 8 : averageLineWords <= 30 ? 6 : 4, evidence: [`Each non-empty line contains an average of ${averageLineWords.toFixed(1)} words.`], issues: averageLineWords <= 22 ? [] : [{ severity: "Medium", message: "Some lines may be too long to scan quickly." }], action: "Turn long paragraphs into short, clear bullet points." }),
    factor({ id: "action-writing", label: "Achievement-led writing", maximum: 7, earned: Math.min(7, 2 + actionCount), evidence: [`Found ${actionCount} different action verbs.`, ...actionExamples.map((value) => `Resume example: ${value}`)], issues: actionCount >= 4 ? [] : [{ severity: "High", message: "Too few experience statements begin with clear ownership or action." }], action: "Rewrite responsibility-led bullets as action + scope + outcome, using only results you can verify." }),
    factor({ id: "impact", label: "Evidence of impact", maximum: 10, earned: Math.min(10, quantifiedCount * 2), evidence: [`Found ${quantifiedCount} uses of numbers or percentages.`, ...quantifiedExamples.map((value) => `Resume example: ${value}`)], issues: quantifiedCount >= 4 ? [] : [{ severity: "High", message: "The resume shows few measurable results." }], action: "Add truthful evidence such as time saved, revenue, growth, quality, reach, scale, or performance improvement." }),
    factor({ id: "skills", label: "Relevant skills and keywords", maximum: 10, earned: parsed.targetKeywords.length ? Math.round((matchedKeywords.length / parsed.targetKeywords.length) * 10) : Math.min(10, 4 + Math.floor(skillCount / 2)), evidence: [parsed.targetKeywords.length ? `Found ${matchedKeywords.length} of ${parsed.targetKeywords.length} target keywords.` : `Found about ${skillCount} skills in the skills section.`, ...skillExamples], issues: parsed.targetKeywords.length && matchedKeywords.length / parsed.targetKeywords.length < 0.5 ? [{ severity: "High", message: "Fewer than half of the target-role keywords were found." }] : [], action: parsed.targetKeywords.length ? "Keep only target-role skills that are supported by experience evidence, and add genuinely held missing terms in the appropriate section." : "Group the strongest skills by relevance and support the priority ones with evidence in the experience section." }),
    factor({ id: "coherence", label: "Career relevance and progression", maximum: 8, earned: sections.includes("experience") ? (dateTokens.length >= 2 ? 7 : 5) : 2, evidence: [`Experience section ${sections.includes("experience") ? "found" : "not found"}; ${dateTokens.length} year references found.`], issues: sections.includes("experience") ? [] : [{ severity: "Critical", message: "A clearly named experience section was not found." }], action: "Show how your responsibilities and achievements developed from one role to the next." }),
    factor({
      id: "chronology",
      label: "Dates and consistency",
      maximum: 7,
      earned: parsed.documentSignals.inconsistentChronology
        ? 2
        : dateTokens.length >= 2
        ? 7
        : dateTokens.length === 1
        ? 3
        : 0,
      evidence: [
        parsed.documentSignals.inconsistentChronology
          ? "Some dates may be inconsistent."
          : dateTokens.length === 0
          ? "No employment dates or year references were found on the resume."
          : `${dateTokens.length} year reference${dateTokens.length === 1 ? "" : "s"} were found and no date problem was reported.`,
      ],
      issues: parsed.documentSignals.inconsistentChronology
        ? [{ severity: "High", message: "Some role dates may overlap or appear inconsistent." }]
        : dateTokens.length === 0
        ? [{ severity: "Critical", message: "No employment dates found; hiring systems require dates to construct a timeline." }]
        : dateTokens.length === 1
        ? [{ severity: "Medium", message: "Only one date reference was found; consider adding start and end dates for each role." }]
        : [],
      action: "Use one date format and briefly explain genuine overlaps or career breaks.",
    }),
    factor({ id: "positioning", label: "Professional positioning", maximum: 8, earned: (summaryPresent ? 5 : 1) + Math.min(3, PROFESSIONAL_TERMS.filter((term) => lower.includes(term)).length), evidence: [summaryPresent ? "A professional summary was found." : "A professional summary was not found.", ...summaryExample.map((value) => `Resume example: ${value}`)], issues: summaryPresent ? [] : [{ severity: "Medium", message: "The resume does not have a short professional summary." }], action: "Use two to four lines to state your level, field, strongest evidence, and the value you bring, without unsupported claims." }),
  ];

  // Calculate separate score categories without arbitrary penalty
  const atsFactorIds = ["parseability", "contact", "structure", "chronology", "language"];
  const contentFactorIds = ["action-writing", "impact", "coherence", "positioning", "skills", "readability"];
  const visualFactorIds = ["formatting"];

  const sumEarned = (ids: string[]) => factors.filter((f) => ids.includes(f.id)).reduce((acc, f) => acc + f.earned, 0);
  const sumMax = (ids: string[]) => factors.filter((f) => ids.includes(f.id)).reduce((acc, f) => acc + f.maximum, 0);

  const atsEarned = sumEarned(atsFactorIds);
  const atsMax = sumMax(atsFactorIds);
  const atsReadinessScore = atsMax > 0 ? Math.round((atsEarned / atsMax) * 100) : 0;

  const contentEarned = sumEarned(contentFactorIds);
  const contentMax = sumMax(contentFactorIds);
  const contentQualityScore = contentMax > 0 ? Math.round((contentEarned / contentMax) * 100) : 0;

  // Strict visual evidence: ONLY evaluate visual design if real PyMuPDF/OpenCV or multimodal evidence exists
  const hasVisualEvidence = Boolean(parsed.documentSignals.hasVisualEvidence);

  // Calibrate Visual Design Score (0-100) from real PyMuPDF/OpenCV measurements
  let calculatedVisualScore = 80;

  // 1. Typography & Font count (ideal: 1-2 fonts; 3: acceptable; 4+: inconsistent)
  if (parsed.documentSignals.fontCount != null) {
    if (parsed.documentSignals.fontCount <= 2) calculatedVisualScore += 10;
    else if (parsed.documentSignals.fontCount === 3) calculatedVisualScore += 0;
    else if (parsed.documentSignals.fontCount === 4) calculatedVisualScore -= 10;
    else calculatedVisualScore -= 20; // 5+ fonts
  }

  // 2. Minimum Font Size (ideal: >= 10pt; 9.0-9.9pt: ok; < 9.0pt: unreadable)
  if (parsed.documentSignals.minimumFontSize != null) {
    if (parsed.documentSignals.minimumFontSize >= 10.0) calculatedVisualScore += 10;
    else if (parsed.documentSignals.minimumFontSize >= 9.0) calculatedVisualScore += 5;
    else if (parsed.documentSignals.minimumFontSize >= 8.0) calculatedVisualScore -= 15;
    else calculatedVisualScore -= 25; // < 8pt (like 7.92pt)
  } else if (parsed.documentSignals.smallText) {
    calculatedVisualScore -= 20;
  }

  // 3. Spacing & Whitespace Distribution
  if (parsed.documentSignals.excessiveWhitespace || parsed.documentSignals.designWarnings?.includes("excessive_whitespace")) {
    calculatedVisualScore -= 25;
  }
  if (parsed.documentSignals.crowdedLayout || parsed.documentSignals.designWarnings?.includes("crowded_layout")) {
    calculatedVisualScore -= 25;
  }
  if (parsed.documentSignals.inconsistentMargins || parsed.documentSignals.designWarnings?.includes("wide_side_margin")) {
    calculatedVisualScore -= 15;
  }
  if (parsed.documentSignals.designWarnings?.includes("unbalanced_page")) {
    calculatedVisualScore -= 15;
  }

  // 4. Columns & Tables
  if (parsed.documentSignals.multiColumn || parsed.documentSignals.designWarnings?.includes("complex_columns")) {
    calculatedVisualScore -= 15;
  }
  if (parsed.documentSignals.tableHeavy || parsed.documentSignals.designWarnings?.includes("table_heavy")) {
    calculatedVisualScore -= 20;
  }

  // 5. Contrast & Color
  if (parsed.documentSignals.excessiveColor || parsed.documentSignals.designWarnings?.includes("low_colour_contrast")) {
    calculatedVisualScore -= 15;
  }

  const openCvPhysicalScore = Math.max(10, Math.min(100, calculatedVisualScore));
  const geminiScore = parsed.documentSignals.geminiVisualScore;

  const visualDesignScore = hasVisualEvidence
    ? (typeof geminiScore === "number"
        ? Math.round((0.5 * openCvPhysicalScore + 0.5 * geminiScore) * 100) / 100
        : openCvPhysicalScore)
    : null;
  const visualDesignStatus = hasVisualEvidence ? ("evaluated" as const) : ("not_evaluated" as const);

  // If visual evidence was evaluated, sync the formatting factor earned score
  if (hasVisualEvidence && visualDesignScore !== null) {
    const formattingFactor = factors.find((f) => f.id === "formatting");
    if (formattingFactor) {
      formattingFactor.earned = Math.min(formattingFactor.earned, Math.round((visualDesignScore / 100) * formattingFactor.maximum));
      if (parsed.documentSignals.geminiVisualCritique) {
        formattingFactor.evidence.push(`Visual AI assessment: ${parsed.documentSignals.geminiVisualCritique}`);
      }
      if (parsed.documentSignals.geminiPageFindings?.length) {
        for (const pageFinding of parsed.documentSignals.geminiPageFindings) {
          for (const obs of pageFinding.observations) {
            formattingFactor.evidence.push(`Page ${pageFinding.page}: ${obs}`);
          }
          for (const warn of pageFinding.warnings) {
            formattingFactor.issues.push({ severity: "Medium", message: `Page ${pageFinding.page}: ${warn}` });
          }
        }
      }
    }
  }

  const hasJobDescription = parsed.jobDescription.trim().length >= 120;
  const fallbackJobMatchCandidate = hasJobDescription
    ? analyzeJobMatch({ resumeText: parsed.text, jobDescription: parsed.jobDescription })
    : null;
  const fallbackJobMatch = fallbackJobMatchCandidate && (fallbackJobMatchCandidate.matched.length + fallbackJobMatchCandidate.missing.length > 0)
    ? fallbackJobMatchCandidate
    : null;
  const jobMatchScore = fallbackJobMatch?.score ?? (parsed.targetKeywords.length > 0
    ? Math.round((matchedKeywords.length / parsed.targetKeywords.length) * 100)
    : null);
  const hasJobEvaluationInput = Boolean(fallbackJobMatch) || parsed.targetKeywords.length > 0;

  const overall = calculateOverallScore({
    contentQualityScore,
    visualQualityScore: visualDesignScore,
    jobMatchScore,
    hasJobDescription: hasJobEvaluationInput,
    visualStatus: visualDesignStatus,
    jobMatchStatus: hasJobEvaluationInput ? "completed" : "job_description_required",
  });

  const scoreSources = {
    atsReadiness: "Deterministic rules (file structure, headings, contact, dates)",
    contentQuality: "Deterministic baseline (action verbs, impact metrics, keywords)",
    visualDesign: hasVisualEvidence
      ? (typeof geminiScore === "number" ? "OpenCV + Gemini Vision" : "OpenCV")
      : "Not evaluated",
    jobMatch: hasJobEvaluationInput ? "Keyword-Based Fallback" : "Not evaluated",
  };

  return {
    rubricVersion: "ats-ai-hybrid-v1",
    score: overall.score,
    rawScore: overall.score,
    atsReadinessScore,
    contentQualityScore,
    visualDesignScore,
    visualDesignStatus: overall.visualDesignStatus,
    jobMatchScore,
    jobMatchStatus: hasJobEvaluationInput ? "completed" : "job_description_required",
    jobMatchMethod: hasJobEvaluationInput ? "deterministic_fallback" : "not_evaluated",
    evaluationCoverage: overall.evaluationCoverage,
    provisional: overall.provisional,
    contentContribution: overall.contentContribution,
    visualContribution: overall.visualContribution,
    jobMatchContribution: overall.jobMatchContribution,
    overallScore: overall.score,
    scoreSources,
    factors: factors.map((item) => {
      if (item.id === "formatting" && !hasVisualEvidence) {
        return {
          ...item,
          evidence: ["Visual layout inspection was not evaluated because rendered page images were not available."],
          action: "Upload a PDF document to run OpenCV and visual design inspection.",
        };
      }
      return item;
    }),
    criteriaFindings: factors.map((item) => ({
      criterionCode: item.id,
      category: atsFactorIds.includes(item.id)
        ? "ats_readiness"
        : visualFactorIds.includes(item.id)
          ? "visual_design"
          : "content_quality",
      rating: Math.round((item.earned / item.maximum) * 5),
      maximumRating: 5,
      confidence: 1.0,
      evidence: item.evidence.join("; "),
      reason: item.issues[0]?.message || item.evidence[0] || "Criteria verified deterministically.",
      recommendation: item.action,
      source: "deterministic" as const,
      pointEffect: item.earned,
    })),
    completed: true,
    disclaimer: "This ATS Readiness Score is an educational and analytical guide based on measurable signals and contextual evaluation. Different employers and commercial ATS products use different parsing and ranking systems.",
  };
}
