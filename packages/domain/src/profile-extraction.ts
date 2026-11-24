import type { CanonicalProfile } from "@successpro/contracts";

export type ProfileExtraction = { draft: Partial<CanonicalProfile>; confidence: "high" | "medium" | "low"; warnings: string[] };
const extractedListFields = ["experience", "education", "projects", "certifications", "awards", "publications", "volunteerExperience", "links"] as const;
const headings = { summary: ["professional summary", "summary", "profile", "career profile", "executive profile"], contact: ["contact", "contact details"], skills: ["skill", "skills", "key skills", "core skills", "core competencies", "functional competencies", "competencies", "soft skills", "key strengths", "professional strengths", "areas of expertise", "technical skills"], experience: ["experience", "professional experience", "work experience", "employment", "employment history", "career history"], pastExperience: ["past work experience", "earlier experience"], education: ["education", "academic background", "qualifications"], projects: ["project", "projects", "selected projects", "key projects"], certifications: ["certification", "certifications", "certificates", "professional development"], awards: ["award", "awards", "recognition"], languages: ["language", "languages"], volunteer: ["volunteer experience", "social experience", "community experience"], other: ["compelling edge", "career highlights", "professional highlights"] } as const;
type SectionKey = keyof typeof headings;
function clean(value: string) { return value.replace(/^[•●▪◦*\-–—\d.)\s]+/, "").replace(/[-–—\s]+$/, "").replace(/\s+/g, " ").trim(); }
function compact(value: string) { return clean(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""); }
function sectionKey(line: string): SectionKey | null { const value = compact(line); const exact = Object.entries(headings).find(([, aliases]) => aliases.some((alias) => value === compact(alias)))?.[0] as SectionKey | undefined; if (exact) return exact; const trimmed = clean(line); return (Object.entries(headings).find(([, aliases]) => aliases.some((alias) => { const prefix = trimmed.slice(0, alias.length); const next = trimmed.slice(alias.length, alias.length + 1); return prefix.toLowerCase() === alias && prefix === prefix.toUpperCase() && (!next || /[\s:|\-–—]/.test(next) || /[A-Z]/.test(next)); }))?.[0] as SectionKey | undefined) ?? null; }
function sectionBodyRaw(lines: string[], key: SectionKey) { const start = lines.findIndex((line) => sectionKey(line) === key); if (start < 0) return []; const end = lines.findIndex((line, index) => index > start && sectionKey(line) !== null); return lines.slice(start + 1, end > start ? end : undefined).filter(Boolean); }
function sectionBody(lines: string[], key: SectionKey) { return sectionBodyRaw(lines, key).map(clean).filter(Boolean); }
function splitDates(value: string) {
  const dates = value.match(/(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?\b(?:19|20)\d{2}\b|\b(?:present|current|ongoing)\b/gi) ?? [];
  return { startDate: dates[0] ?? "", endDate: dates[1] ?? "" };
}
function splitRole(line: string) { const parts = line.split(/\s*[|]\s*/).map(clean).filter(Boolean); if (parts.length < 2) return null; const dateIndex = parts.findIndex((part) => /\b(?:19|20)\d{2}\b|present|current/i.test(part)); if (dateIndex < 0) return null; const dates = splitDates(parts[dateIndex]); if (dateIndex === 1 && parts.length >= 3) return { employer: parts[0], title: parts.slice(2).join(" · "), ...dates }; if (dateIndex >= 2) return { title: parts[0], employer: parts[1], ...dates }; return null; }
function unique(values: string[], maximum = 100) { return [...new Set(values.map(clean).filter(Boolean))].slice(0, maximum); }
function looksLikeName(line: string) { const value = clean(line); const words = value.split(/\s+/); return words.length >= 2 && words.length <= 5 && value.length <= 80 && !sectionKey(value) && !/@|https?|\d|service|management|professional|experience|certified/i.test(value) && value === value.toUpperCase(); }

export function extractCanonicalProfile(text: string): ProfileExtraction {
  const lines = text.replace(/\r/g, "").split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const fullName = lines.find(looksLikeName) ?? lines.find((line) => line.length >= 2 && line.length <= 80 && !sectionKey(line) && !/@|http|\d{4}/i.test(line)) ?? "";
  const summaryLines = sectionBody(lines, "summary").filter((line) => line !== fullName); const summary = summaryLines.join(" ").slice(0, 2_000);
  const skillLines = sectionBodyRaw(lines, "skills"); const inlineSkill = lines.find((line) => /^skills?\s*[:|-]/i.test(line))?.replace(/^skills?\s*[:|-]\s*/i, "") ?? ""; const bulletSkillLines = skillLines.filter((line) => /^[•●▪◦*-]\s*/.test(line)); const boundedSkillLines = bulletSkillLines.length ? bulletSkillLines : skillLines.filter((line) => /[,;|•]/.test(line) || line.split(/\s+/).length <= 10);
  const skills = unique([inlineSkill, ...boundedSkillLines].flatMap((line) => line.split(/[,;|•]/)).map(clean).filter((value) => value.length > 1 && value.length <= 80 && /[\p{L}]/u.test(value) && !/@|\b(?:19|20)\d{2}\b/.test(value) && !/^[-–—\s]*(?:page\s*)?\d+\s*(?:of|\/)\s*\d+[-–—\s]*$/i.test(value) && !/^[-–—\s]*(?:page\s*\d+|\d+)[-–—\s]*$/i.test(value) && !/^(?:curriculum vitae|resume|profile|summary|contact|experience|education|skills|page|references)$/i.test(value) && !sectionKey(value)));
  const experienceLines = sectionBody(lines, "experience"); const experience: CanonicalProfile["experience"] = [];
  for (let index = 0; index < experienceLines.length; index += 1) { const parsed = splitRole(experienceLines[index]); if (!parsed) continue; const achievements: string[] = []; for (let cursor = index + 1; cursor < experienceLines.length && !splitRole(experienceLines[cursor]); cursor += 1) { const item = clean(experienceLines[cursor]); if (item.length >= 12 && item.length <= 500 && !/^environment\s*:/i.test(item)) achievements.push(item); } experience.push({ id: `extracted-experience-${experience.length + 1}`, ...parsed, achievements: unique(achievements, 20) }); }
  const past = sectionBody(lines, "pastExperience").filter((line) => line.includes("|")).map((line) => line.split("|").map(clean)).filter((parts) => parts.length >= 2);
  for (const parts of past) experience.push({ id: `extracted-experience-${experience.length + 1}`, employer: parts[0], title: parts.slice(1).join(" · "), startDate: "", endDate: "", achievements: [] });
  const educationLines = sectionBody(lines, "education"); const certificationLines = [...sectionBody(lines, "certifications"), ...educationLines.filter((line) => /certif|prince\s*2|six\s+sigma|programming language/i.test(line))]; const academicLines = educationLines.filter((line) => !certificationLines.includes(line)); const education: CanonicalProfile["education"] = [];
  for (let index = 0; index < academicLines.length; index += 1) { const line = academicLines[index]; const parts = line.split(/\s*[|]\s*/).map(clean).filter(Boolean); if (parts.length >= 2) { const dateIndex = parts.findIndex((part) => /\b(?:19|20)\d{2}\b/.test(part)); const dates = dateIndex >= 0 ? splitDates(parts[dateIndex]) : { startDate: "", endDate: "" }; education.push({ id: `extracted-education-${education.length + 1}`, qualification: parts[0], institution: parts[1], ...dates }); } else if (index + 1 < academicLines.length && /university|institute|college|school|jntu/i.test(academicLines[index + 1])) { const institutionLine = academicLines[++index]; const year = institutionLine.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? ""; education.push({ id: `extracted-education-${education.length + 1}`, qualification: line, institution: institutionLine.replace(/\b(?:19|20)\d{2}\b/, "").trim(), startDate: "", endDate: year }); } }
  const certifications = unique(certificationLines, 30).map((name, index) => ({ id: `extracted-certification-${index + 1}`, name, issuer: "", date: "", credentialUrl: "" }));
  const contact = sectionBody(lines, "contact"); const location = contact.find((line) => /^[\p{L}\s,.-]{2,120}$/u.test(line) && !/@|linkedin/i.test(line)) ?? "";
  const volunteerLines = sectionBody(lines, "volunteer"); const volunteerExperience = volunteerLines.length ? [{ id: "extracted-volunteer-1", role: "Community and international experience", organization: volunteerLines.find((line) => /AIESEC|association|foundation|community/i.test(line)) ?? "Professional community", startDate: "", endDate: "", description: volunteerLines.join(" ").slice(0, 1_000) }] : [];
  const languages = unique(sectionBody(lines, "languages").flatMap((line) => line.split(/[,;|•]/)).filter((line) => line.length <= 80), 30); const current = experience[0]; const headline = current ? `${current.title}${current.employer ? ` · ${current.employer}` : ""}`.slice(0, 180) : summary.match(/^.{2,180}?(?=[.!?]|$)/)?.[0] ?? "";
  const warnings: string[] = []; if (!fullName) warnings.push("Name could not be extracted confidently."); if (!headline) warnings.push("Professional headline needs confirmation."); if (!skills.length) warnings.push("The skills section could not be separated confidently; add or confirm skills."); if (!experience.length) warnings.push("Experience entries need manual confirmation."); if (!education.length) warnings.push("Education entries need manual confirmation.");
  const populated = [fullName, headline, summary.length, skills.length, experience.length, education.length, certifications.length, location].filter(Boolean).length;
  return { draft: { fullName, headline, location, summary, currentRole: current?.title ?? "", industry: "", skills, experience, education, projects: [], certifications, awards: [], publications: [], volunteerExperience, languages, preferredLanguage: "en", links: [], targetRoles: [], openToWork: false, publicProfileEnabled: false }, confidence: populated >= 6 ? "high" : populated >= 3 ? "medium" : "low", warnings };
}

/**
 * Reconcile the deterministic whole-document extraction with the assisted
 * extraction. Empty provider sections retain the recovery draft. A populated
 * assisted section takes precedence: heuristic line counts are not evidence
 * that a section is more complete (two-column text can create false records).
 */
export function reconcileExtractedProfile(deterministic: Partial<CanonicalProfile>, assisted: Partial<CanonicalProfile>): Partial<CanonicalProfile> {
  const merged: Partial<CanonicalProfile> = { ...deterministic };
  for (const [key, value] of Object.entries(assisted)) {
    if (typeof value === "string") {
      if (value.trim()) Object.assign(merged, { [key]: value });
      continue;
    }
    if (value !== undefined && !Array.isArray(value)) Object.assign(merged, { [key]: value });
  }
  const uniqueText = (values: unknown[]) => [...new Map(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => [compact(value), clean(value)])).values()];
  merged.skills = uniqueText(assisted.skills?.length ? assisted.skills : deterministic.skills ?? []);
  merged.languages = uniqueText(assisted.languages?.length ? assisted.languages : deterministic.languages ?? []);
  merged.targetRoles = uniqueText([...(deterministic.targetRoles ?? []), ...(assisted.targetRoles ?? [])]);
  for (const field of extractedListFields) {
    const baseline = deterministic[field] ?? [];
    const candidate = assisted[field] ?? [];
    Object.assign(merged, { [field]: candidate.length ? candidate : baseline });
  }
  return merged;
}
