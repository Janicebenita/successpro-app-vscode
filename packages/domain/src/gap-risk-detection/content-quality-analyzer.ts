import type { GapRiskFinding } from "./types";

const BROAD_BULLET_OPENING = /^[•*◦▪‣-]\s+(responsible for|tasked with|duties included|helped with|assisted in|assisted with|helped to|worked on|participated in|contributed to|handled|dealt with)\b/iu;

const EMPTY_BUZZWORDS = [
  "hard-working team player",
  "hardworking team player",
  "go-getter",
  "dynamic self-starter",
  "results-driven professional",
  "results oriented professional",
  "proven track record of success",
  "think outside the box",
  "synergy",
  "out-of-the-box thinker",
  "detail-oriented professional",
];

export function analyzeContentQuality(text: string): GapRiskFinding[] {
  const findings: GapRiskFinding[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const unresolved = text.match(/\[(?:to be confirmed|to be verified|to be updated|insert [^\]]+|TBD|TBC|placeholder)\]/i);
  if (unresolved) {
    findings.push({
      id: "content-unresolved-placeholder",
      title: "Unresolved Placeholder in the Resume",
      category: "content_quality",
      severity: "Medium",
      evidenceExcerpt: text.split(/\r?\n/).find(line => line.includes(unresolved[0]))?.trim() ?? unresolved[0],
      explanation: "This note marks information that still needs confirmation.",
      whyItMatters: "A reader may be unable to tell which part of the entry is verified.",
      recommendedCorrection: "Confirm the detail and replace the note with the verified wording, or remove the unresolved detail.",
      confidence: "High",
      isMandatory: false,
    });
  }

  // Suggest clarifying the contribution if the opening is broad. A genuine
  // contribution is valid and should retain its original level of ownership.
  const broadBullet = lines.find((line) => BROAD_BULLET_OPENING.test(line));
  if (broadBullet) {
    findings.push({
      id: "content-weak-action-verbs",
      title: "Clarify Your Contribution in This Bullet",
      category: "content_quality",
      severity: "Low",
      evidenceExcerpt: broadBullet,
      explanation: "This bullet describes participation. A brief detail about the part you personally completed could make the contribution clearer.",
      whyItMatters: "Readers can better distinguish your work from the overall project when you name your specific contribution.",
      recommendedCorrection: "If you can verify it, name the part you personally wrote, edited, researched, or produced. Retain shared credit where appropriate.",
      confidence: "Medium",
      isMandatory: false,
    });
  }

  // 2. Generic Buzzwords & Empty Descriptors
  const foundBuzzwords: string[] = [];
  for (const buzz of EMPTY_BUZZWORDS) {
    const regex = new RegExp(`\\b${buzz}\\b`, "i");
    const matchedLine = lines.find((l) => regex.test(l));
    if (matchedLine) {
      foundBuzzwords.push(matchedLine.slice(0, 140));
    }
    if (foundBuzzwords.length >= 2) break;
  }

  if (foundBuzzwords.length > 0) {
    findings.push({
      id: "content-generic-buzzwords",
      title: "Generic Buzzwords and Vague Subjective Claims",
      category: "content_quality",
      severity: "Low",
      evidenceExcerpt: foundBuzzwords.join("\n"),
      explanation: "Your resume includes subjective clichés (e.g. 'hard-working team player', 'go-getter', or 'results-driven').",
      whyItMatters: "A specific example gives readers more context than a broad self-description.",
      recommendedCorrection: "Replace a broad self-description with a relevant example of work you can verify.",
      confidence: "High",
      isMandatory: false,
    });
  }

  // 3. Repeated / Duplicate Content Across Roles
  const normalizedBullets = lines
    .filter((l) => l.length >= 40 && /^[•*-]\s+/i.test(l))
    .map((l) => l.replace(/^[•*-]\s+/i, "").toLowerCase().trim());

  const duplicates: string[] = [];
  const seen = new Set<string>();
  for (const b of normalizedBullets) {
    if (seen.has(b)) duplicates.push(b);
    else seen.add(b);
  }

  if (duplicates.length > 0) {
    findings.push({
      id: "content-duplicate-bullets",
      title: "Repeated or Duplicate Content Across Roles",
      category: "content_quality",
      severity: "High",
      evidenceExcerpt: duplicates.slice(0, 2).map((d) => `"${d}"`).join("\n"),
      explanation: "Identical or near-verbatim bullet points appear multiple times in different positions on your resume.",
      whyItMatters: "Recruiters perceive verbatim copy-pasting as low-effort or inflated experience, reducing the perceived depth of your distinct achievements.",
      recommendedCorrection: "Tailor each role's bullet points to the specific context, tech stack, and achievements of that specific employer.",
      confidence: "High",
      isMandatory: true,
    });
  }

  // 4. Keyword Stuffing (Comma Dumps)
  const keywordDumps: string[] = [];
  for (const line of lines) {
    const commaCount = (line.match(/,/g) || []).length;
    if (commaCount >= 10 && line.length > 100 && !/\b(?:spearheaded|developed|engineered|designed|led|built)\b/i.test(line)) {
      keywordDumps.push(line.slice(0, 160));
    }
  }

  if (keywordDumps.length > 0) {
    findings.push({
      id: "content-keyword-stuffing",
      title: "Unstructured Keyword Stuffing",
      category: "content_quality",
      severity: "Medium",
      evidenceExcerpt: keywordDumps[0],
      explanation: "A dense list of 10+ comma-separated technologies appears without categorization or context.",
      whyItMatters: "While intended to pass ATS filters, modern semantic parsers flag unnatural keyword lists, and human reviewers find comma dumps hard to parse.",
      recommendedCorrection: "Organize technologies into functional sub-headings (e.g., 'Languages & Frameworks:', 'Cloud & DevOps:', 'Data & AI:').",
      confidence: "High",
      isMandatory: false,
    });
  }

  // 5. Excessively Long Run-On Bullet Points
  const longBullets = lines.filter((l) => /^[•*-]\s+/i.test(l) && (l.split(/\s+/).length > 65 || l.length > 450));
  if (longBullets.length > 0) {
    findings.push({
      id: "content-excessively-long-bullet",
      title: "Excessively Long Bullet Points (>65 words)",
      category: "content_quality",
      severity: "Low",
      evidenceExcerpt: longBullets[0].slice(0, 200) + "…",
      explanation: `Found bullet points with over 65 words without paragraph breaks (${longBullets[0].split(/\s+/).length} words).`,
      whyItMatters: "Recruiters skim bullet points in 2-3 seconds. Long blocks of text cause reviewers to skip reading the achievement entirely.",
      recommendedCorrection: "Split dense descriptions into two concise 1-to-2 line bullets focusing strictly on action and business result.",
      confidence: "High",
      isMandatory: false,
    });
  }

  return findings;
}
