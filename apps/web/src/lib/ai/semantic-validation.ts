import type { AiTaskInput, AiTaskName, AiTaskOutput } from "@successpro/contracts/ai";
import { statedCurrentRoleWithPastEnd } from "../career-date-status";
import { reviewEvidence } from "./review-evidence";
import { chronologyRatingConflict } from "@successpro/domain";
import { cleanJobRequirementText, isResumeEvidenceHeading, validateSourceEvidence } from "@successpro/domain";
import { severityConflict } from "@successpro/domain";
import { validateGroundedRewrite } from "@successpro/domain";
import { getRatingAnchor } from "@successpro/domain";
import { numericalClaims } from "@successpro/domain";

export type SemanticIssue = { path: string; code: string; message: string };

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function supported(value: unknown, source: string) {
  if (typeof value !== "string" || !value.trim()) return true;
  const fact = normalize(value);
  return Boolean(fact) && source.includes(fact);
}

function cleanPrintedDate(value: string) {
  // PDF glyph positioning can split a printed short year into "’ 1 2".
  // Join only those already-evidenced digits; never infer a century or day.
  return value.replace(/([‘’'])\s*(\d)\s+(\d)(?=\b)/g, "$1$2$3")
    .replace(/([‘’'])\s+(?=\d{2}\b)/g, "$1")
    .replace(/\s+([‘’'])(?=\d{2}\b)/g, "$1")
    .trim();
}

function restoreSharedMonthRangeYear(role: { title: string; startDate: string; endDate: string }, resumeText: string) {
  const end = role.endDate.trim().match(/^([A-Za-z]+),?\s+((?:19|20)\d{2})$/);
  if (!end || /\b(?:19|20)\d{2}\b/.test(role.startDate)) return false;
  const monthIndex = (month: string) => ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(month.slice(0, 3).toLowerCase());
  if (monthIndex(end[1]) < 0) return false;
  const lines = resumeText.split(/\r?\n/).map((line) => line.trim());
  const title = normalize(role.title);
  if (!title) return false;
  for (const [index, line] of lines.entries()) {
    const range = line.match(/^([A-Za-z]+)\s*[-–—]\s*([A-Za-z]+),?\s+((?:19|20)\d{2})$/);
    if (!range || monthIndex(range[1]) < 0 || monthIndex(range[1]) > monthIndex(range[2])
      || range[2].slice(0, 3).toLowerCase() !== end[1].slice(0, 3).toLowerCase() || range[3] !== end[2]) continue;
    if (role.startDate && range[1].slice(0, 3).toLowerCase() !== role.startDate.slice(0, 3).toLowerCase()) continue;
    if (!lines.slice(Math.max(0, index - 3), index).some((preceding) => normalize(preceding).includes(title))) continue;
    role.startDate = `${range[1]} ${range[3]}`;
    return true;
  }
  return false;
}

function claimStrings(profile: Record<string, unknown>) {
  const values: string[] = [];
  const visit = (value: unknown, key = "") => {
    if (typeof value === "string") {
      if (!/^(?:id|url|credentialUrl|link)$/i.test(key)) values.push(value);
      return;
    }
    if (Array.isArray(value)) { value.forEach((item) => visit(item, key)); return; }
    if (value && typeof value === "object") Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
  };
  visit(profile);
  return values;
}

function numericClaims(values: string[]) {
  // PDF extraction can fuse words and figures ("saved60%"). The figure is
  // still source evidence and must not be rejected because spacing was lost.
  return [...new Set(values.flatMap((value) => value.replace(/(\d)\s*([.,])\s*(?=\d)/g, "$1$2").replace(/(\d)\s+%/g, "$1%").match(/\d+(?:[.,]\d+)?%?/gi) ?? []).map((value) => value.replace(/,/g, "").toLowerCase()))];
}

function datedAwardBullets(resumeText: string) {
  const bullets: { years: string[]; anchor: string }[] = [];
  let inAwards = false;
  let years: string[] = [];
  for (const rawLine of resumeText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^awards?\s*(?:&|and)\s*achievements?\b/i.test(line)) { inAwards = true; years = []; continue; }
    if (!inAwards) continue;
    if (/^(?:work experience|professional experience|education|strengths|skills|certifications|how i spend my day)/i.test(line)
      || /^[A-Za-z][^\n]{0,100}\s+\|\s+(?:[A-Za-z]+\s+)?(?:19|20)\d{2}\b/.test(line)) { inAwards = false; continue; }
    const heading = line.match(/^((?:19|20)\d{2})(?:\s*[-–—]\s*(\d{2,4}))?(?:\s*[-–—]\s*.+)?$/);
    if (heading) {
      years = [heading[1]];
      if (heading[2]) years.push(heading[2].length === 2 ? `${heading[1].slice(0, 2)}${heading[2]}` : heading[2]);
      continue;
    }
    const bullet = line.match(/^[▪•●■]\s*(.+)$/);
    if (bullet && years.length) {
      const words = normalize(bullet[1]).split(" ");
      if (words.length >= 5) bullets.push({ years, anchor: words.slice(0, Math.min(8, words.length)).join(" ") });
    }
  }
  return bullets;
}

function nestedUndatedRoles(resumeText: string) {
  const lines = resumeText.split(/\r?\n/).map((line) => line.trim());
  const roles: string[] = [];
  let collecting = false;
  for (const line of lines) {
    if (/^(?:other(?:\s+key)?|earlier|previous)\s+roles\s+at\s+.{2,80}:?$/i.test(line)) { collecting = true; continue; }
    if (!collecting) continue;
    if (/^(?:outside\b.*experience|(?:other\s+)?professional\s+experience|education|core\s+competenc|skills|certifications|awards|personal\s+details)\b/i.test(line)) { collecting = false; continue; }
    if (!line) continue;
    // These are separately printed titles without their own dates. A dated
    // employer heading above the list is not tenure evidence for each title.
    if (line.length <= 110 && !/\b(?:19|20)\d{2}\b/.test(line)) roles.push(line.replace(/^[•▪●*-]\s*/, ""));
  }
  return roles.slice(0, 30);
}

/** Restore the source spelling after Gemini normalizes whitespace or smart punctuation. */
export function restoreSourceQuote(quote: string, source: string): string {
  if (source.includes(quote) || !quote.trim()) return quote;

  const pattern = quote.trim().split(/(\s+|['‘’"“”\-‐‑–—])/u).map((part) => {
    if (/^\s+$/u.test(part)) return "\\s+";
    if (/^['‘’]$/u.test(part)) return "['‘’]";
    if (/^["“”]$/u.test(part)) return '["“”]';
    if (/^[-‐‑–—]$/u.test(part)) return "[-‐‑–—]";
    return part.replace(/[.*+?^$\u007b\u007d()|[\]\\]/g, "\\$&");
  }).join("");

  const matches = source.matchAll(new RegExp(pattern, "giu"));
  const first = matches.next();
  return !first.done && matches.next().done ? first.value[0] : quote;
}

export function sanitizeAiOutput<T extends AiTaskName>(task: T, input: AiTaskInput<T>, output: AiTaskOutput<T>): AiTaskOutput<T> {
  if (task === "extractResumeProfile") {
    const source = normalize((input as AiTaskInput<"extractResumeProfile">).resumeText);
    const result = structuredClone(output as AiTaskOutput<"extractResumeProfile">);
    let removedDate = false;
    for (const field of ["experience", "education", "certifications", "awards", "publications", "volunteerExperience"] as const) {
      for (const item of result.profileDraft[field] ?? []) {
        const record = item as unknown as Record<string, unknown>;
        for (const key of ["startDate", "endDate", "date"]) {
          if (typeof record[key] === "string" && record[key] && !supported(record[key], source)) {
            // Do not turn year/month evidence or 'present' into invented ISO days.
            // Keep the career record and ask for confirmation instead.
            record[key] = "";
            removedDate = true;
          } else if (typeof record[key] === "string" && record[key]) {
            record[key] = cleanPrintedDate(record[key]);
          }
        }
      }
    }
    const restoredSharedRangeRoles = (result.profileDraft.experience ?? []).filter((role) => restoreSharedMonthRangeYear(role, (input as AiTaskInput<"extractResumeProfile">).resumeText));
    if (restoredSharedRangeRoles.length) result.warnings = result.warnings.filter((warning) => !restoredSharedRangeRoles.some((role) => {
      const employerAnchor = normalize(role.employer).split(" ").find((word) => word.length >= 5);
      const sameEmployerRoles = (result.profileDraft.experience ?? []).filter((candidate) => employerAnchor && normalize(candidate.employer).includes(employerAnchor));
      return employerAnchor && sameEmployerRoles.length === 1 && normalize(warning).includes(employerAnchor)
        && /\b(?:start date|year)\b/i.test(warning) && /\b(?:lack|miss|omit|unknown)\w*\b/i.test(warning);
    }));
    for (const item of result.profileDraft.education ?? []) {
      if (item.endDate) continue;
      const institution = normalize(item.institution);
      if (!institution) continue;
      const sourceLine = (input as AiTaskInput<"extractResumeProfile">).resumeText.split(/\r?\n/)
        .find((line) => normalize(line).includes(institution) && /\b(?:19|20)\d{2}\s*[-–—]\s*\d{2}\b/.test(line));
      const range = sourceLine?.match(/\b((?:19|20)\d{2})\s*[-–—]\s*(\d{2})\b/);
      if (range && (!item.startDate || item.startDate === range[1])) {
        item.startDate = range[1];
        item.endDate = range[2];
      }
    }
    if (removedDate) result.warnings = ["Some dates could not be matched exactly to the uploaded resume and were left blank. Confirm them against your original document before saving.", ...result.warnings].slice(0, 20);
    const statedCurrentRecord = statedCurrentRoleWithPastEnd(result.profileDraft);
    if (statedCurrentRecord
      && !result.warnings.some((warning) => /\b(?:current(?:ly)?|present|most recent)\b/i.test(warning) && /\b(?:role|position|job|employment)\b/i.test(warning))) {
      result.warnings = [...result.warnings, `Your resume identifies “${statedCurrentRecord.title}” as your current role, but lists its end date as ${statedCurrentRecord.endDate}. Confirm whether this is still your present position and update your summary if it has ended.`].slice(0, 20);
    }
    const institutionLabels = [
      ...(result.profileDraft.education ?? []).map((item) => item.institution),
      ...(result.profileDraft.certifications ?? []).map((item) => item.issuer),
    ];
    for (const label of institutionLabels) {
      const institution = label.trim();
      // A school named inside a second, parenthetical institution reference may
      // be an affiliation or an error in the source. Preserve it, but never
      // quietly present the combined wording as an independently verified fact.
      if (/^.{3,}\([^)]*\b(?:school|university|college|institute)\b/i.test(institution)) {
        const warning = `Confirm the exact awarding institution for “${institution}” before publishing; the source wording may combine more than one institution.`;
        const institutionKey = normalize(institution).slice(0, 18);
        if (!result.warnings.some((existing) => normalize(existing).includes(institutionKey) && /\b(?:confirm|clarif|ambigu|two|more than one)\b/i.test(existing))) {
          result.warnings = [...result.warnings, warning].slice(0, 20);
        }
      }
    }
    // A degree completion year is usually enough for a resume. Do not turn
    // absent education start years into an apparent extraction defect.
    result.improvements = result.improvements.filter((item) => !(/education/i.test(item.field) && /(?:add|include|missing|provide|consider|complete)[^.!?]{0,80}\bstart\s+(?:date|year)/i.test(`${item.inference} ${item.suggestion}`)));
    return result as AiTaskOutput<T>;
  }
  if (task === "generateCoverLetter" || task === "generateLinkedInMakeover") {
    const source = input as AiTaskInput<"generateCoverLetter"> | AiTaskInput<"generateLinkedInMakeover">;
    const restoreName = (value: unknown): unknown => {
      if (typeof value === "string") return value.replace(/\[redacted fullName\]/gi, () => source.profile.fullName);
      if (Array.isArray(value)) return value.map(restoreName);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, restoreName(child)]));
      return value;
    };
    const result = restoreName(output) as AiTaskOutput<T>;
    if (task === "generateLinkedInMakeover") {
      const aliases = new Map(source.profile.experience.map((role, index) => [`career_record_${index + 1}`, role.id]));
      (result as AiTaskOutput<"generateLinkedInMakeover">).experience.forEach((role) => {
        role.roleId = aliases.get(role.roleId) ?? role.roleId;
      });
    }
    if (task === "generateCoverLetter") {
      const letter = result as AiTaskOutput<"generateCoverLetter">;
      const seen = new Set<string>();
      letter.paragraphs = letter.paragraphs.filter((paragraph) => {
        const key = normalize(paragraph);
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
      // The export renderer prints the confirmed name separately.
      letter.closing = letter.closing.match(/^(?:sincerely|yours sincerely|yours faithfully|kind regards|best regards)\b/i)?.[0] ?? "Yours sincerely";
    }
    return result;
  }
  if (task === "analyzeResume") {
    const source = (input as AiTaskInput<"analyzeResume">).resumeText;
    const result = structuredClone(output as AiTaskOutput<"analyzeResume">);
    const jobDescription = (input as AiTaskInput<"analyzeResume">).jobDescription;
    if (jobDescription) {
      for (const requirement of result.jdRequirements ?? []) {
        requirement.sourceText = restoreSourceQuote(cleanJobRequirementText(requirement.sourceText), cleanJobRequirementText(jobDescription));
      }
    }
    for (const row of [...(result.workbookAssessments ?? []), ...(result.jdRequirements ?? [])]) {
      const id = row.evidence?.sourceExcerptId;
      const span = id ? reviewEvidence(source).find((item) => item.id === id) : undefined;
      if (row.evidence && span) {
        if (!row.evidence.excerpt || !span.text.includes(row.evidence.excerpt)) row.evidence.excerpt = span.text;
        const start=source.indexOf(row.evidence.excerpt, source.indexOf(span.text));const page=(input as AiTaskInput<"analyzeResume">).sourcePageRanges?.find(p=>start>=p.start && start<p.end)?.page;
        row.evidence.location=(page ? "Page "+page+"; " : "")+"resume characters "+start+"-"+(start+row.evidence.excerpt.length);
      }
      for(const linked of row.evidence?.additionalExcerpts ?? []) {
        if(!linked.sourceExcerptId)continue;
        const quote=reviewEvidence(source).find(item=>item.id===linked.sourceExcerptId);
        if(quote){if(!linked.excerpt || !quote.text.includes(linked.excerpt))linked.excerpt=quote.text;const offset=source.indexOf(linked.excerpt, source.indexOf(quote.text));linked.location=`resume characters ${offset}-${offset+quote.text.length}`;}
      }
    }
    // Redaction markers in explanatory prose are not facts or evidence.
    const prose=(value:string)=>value.replace(/\[redacted (?:email|phone|fullName|address)\]/gi,"the contact detail");
    result.summary=prose(result.summary);
    for(const row of [...(result.workbookAssessments ?? []),...(result.jdRequirements ?? [])]){
      if(row.evidence)row.evidence.rationale=prose(row.evidence.rationale);
      if("naOrPendingReason" in row && row.naOrPendingReason)row.naOrPendingReason=prose(row.naOrPendingReason);
      if("issues" in row)row.issues?.forEach(issue=>{issue.message=prose(issue.message);});
    }
    result.topActions.forEach(action=>{action.observed=prose(action.observed);action.inference=prose(action.inference);action.suggestion=prose(action.suggestion);});
    // Provider caveats may echo privacy markers from the redacted prompt.
    // They add no review value and can be dropped without altering evidence.
    result.limitations = result.limitations.filter((item) => !/\[redacted\s+[^\]]+\]/i.test(item));
    const supportedNumbers = new Set(numericClaims([source]));
    for (const action of result.topActions) {
      if (action.sourceExcerptId) {
        const evidence = reviewEvidence(source).find((item) => item.id === action.sourceExcerptId);
        if (evidence) action.originalExcerpt = evidence.text;
      }
      if (/\[redacted (?:email|phone)\]/.test(action.originalExcerpt)) {
        const pattern = action.originalExcerpt.split(/(\[redacted (?:email|phone)\])/).map((part) => {
          if (part === "[redacted email]") return "[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}";
          if (part === "[redacted phone]") return "\\+?\\d[\\d .()-]{7,}\\d";
          return part.split(/\s+/).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
        }).join("");
        // Restore only an exact source span. Never fill placeholders from another
        // customer, profile, or fabricated value; normal grounding still follows.
        const match = source.match(new RegExp(pattern));
        if (match) action.originalExcerpt = match[0];
      }
      if (isResumeEvidenceHeading(action.originalExcerpt)) {
        action.originalExcerpt = "";
        action.improvedExample = "";
        delete action.sourceExcerptId;
      }
      if (action.improvedExample) {
        if (/\[redacted (?:email|phone)\]/.test(action.improvedExample) && action.originalExcerpt) {
          const pattern = action.improvedExample.split(/(\[redacted (?:email|phone)\])/).map((part) => {
            if (part === "[redacted email]") return "[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}";
            if (part === "[redacted phone]") return "\\+?\\d[\\d .()-]{7,}\\d";
            return part.split(/\s+/).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
          }).join("");
          const match = source.match(new RegExp(pattern));
          if (match) action.improvedExample = match[0];
        }
        if (action.improvedExample.trim().toLowerCase() === action.originalExcerpt.trim().toLowerCase()
          || /\[redacted\s+[^\]]+\]/i.test(action.improvedExample)
          || validateGroundedRewrite(action.improvedExample, action.originalExcerpt, action.originalExcerpt).length > 0
          || numericClaims([action.improvedExample]).some((number) => !supportedNumbers.has(number))) {
          action.improvedExample = "";
        }
      }
    }
    return result as AiTaskOutput<T>;
  }
  if (task !== "transformResumeProfile") return output;
  const source = input as AiTaskInput<"transformResumeProfile">;
  const result = structuredClone(output as AiTaskOutput<"transformResumeProfile">);
  const draft = result.profileDraft;
  const baseline = normalize(`${source.resumeText}\n${JSON.stringify(source.deterministicDraft)}`);

  // A factual paragraph should not fail merely because the model prefaced its
  // evidence with stock self-praise. Remove only that phrase; leave every claim
  // and number intact for the normal source-grounding checks below.
  if (draft.summary) draft.summary = draft.summary.replace(/\bproven track record\s+(?:in|of)\s+/gi, "Notable work includes ");

  // Identity and profile-state fields are not writing decisions. Keep the
  // extracted/customer-owned values even when provider prompts redact them.
  (["fullName", "location", "currentRole", "industry", "preferredLanguage", "targetRoles"] as const).forEach((field) => {
    const value = source.deterministicDraft[field];
    if (value !== undefined) Object.assign(draft, { [field]: value });
    else delete draft[field];
  });
  draft.openToWork = false;
  draft.publicProfileEnabled = false;
  draft.searchEngineIndexable = false;

  // Rewriting changes prose, not factual identity or chronology. A provider
  // may improve a role's bullets, but cannot shorten a confirmed degree,
  // employer, credential or date even when the shortened text still occurs
  // as a substring in the source.
  for (const field of ["experience", "education", "certifications", "awards", "publications", "volunteerExperience"] as const) {
    const baselineRecords = source.deterministicDraft[field] ?? [];
    for (const item of draft[field] ?? []) {
      const record = item as unknown as Record<string, unknown>;
      const original = baselineRecords.find((candidate) => candidate.id === item.id) as unknown as Record<string, unknown> | undefined;
      if (!original) continue;
      if (field === "awards" && typeof original.kind === "string") record.kind = original.kind;
      const identityKeys = field === "experience" ? ["employer", "title"] : field === "education" ? ["institution", "qualification"] : field === "volunteerExperience" ? ["organization", "role"] : field === "publications" ? ["title", "publisher"] : field === "awards" ? ["title", "issuer"] : ["name", "issuer"];
      for (const key of identityKeys) if (typeof original[key] === "string") record[key] = original[key];
      for (const key of ["startDate", "endDate", "date"]) if (typeof original[key] === "string") record[key] = original[key];
    }
  }

  // The confirmed skill list belongs to the customer. A writing pass may
  // reorganize its presentation, but it must not silently discard competencies
  // identified in the extraction or added by the customer.
  if (source.deterministicDraft.skills?.length) draft.skills = [...source.deterministicDraft.skills];
  else if (draft.skills) draft.skills = draft.skills.filter((value) => supported(value, baseline));
  if (draft.languages) draft.languages = draft.languages.filter((value) => supported(value, baseline));
  return result as AiTaskOutput<T>;
}

function validateTransform(input: AiTaskInput<"transformResumeProfile">, output: AiTaskOutput<"transformResumeProfile">) {
  const issues: SemanticIssue[] = [];
  if (/\b(?:results[- ](?:driven|focused|oriented)|proven track record|dynamic professional|seasoned professional|expert at)\b/i.test(output.profileDraft.summary ?? "")) {
    issues.push({ path: "profileDraft.summary", code: "generic_professional_summary", message: "Replace stock self-praise with the candidate's specific professional identity, functional strengths, scope and source-backed contributions. Do not merely substitute another adjective. Preserve facts and write a differentiated professional summary." });
  }
  if (/\[redacted\s+[^\]]+\]/i.test(JSON.stringify(output))) issues.push({ path: "output", code: "unresolved_placeholder", message: "Privacy placeholders must not appear in the profile, explanations, or warnings. For contact-related explanations describe the issue without quoting redacted contact values. Never invent replacement contact information." });
  const baseline = normalize(`${input.resumeText}\n${JSON.stringify(input.deterministicDraft)}`);
  const profile = output.profileDraft as Record<string, unknown>;
  for (const field of ["experience", "education", "projects", "certifications", "awards", "publications", "volunteerExperience"] as const) {
    const records = output.profileDraft[field] ?? [];
    const seen = new Set<string>();
    records.forEach((record, index) => {
      if (/\[redacted\s/i.test(record.id) || seen.has(record.id)) issues.push({ path: `profileDraft.${field}.${index}.id`, code: "invalid_record_reference", message: "Preserve the exact unique record ID. Never redact or duplicate it." });
      seen.add(record.id);
    });
    for (const original of input.deterministicDraft[field] ?? []) {
      if (!seen.has(original.id)) issues.push({ path: `profileDraft.${field}`, code: "missing_record_reference", message: "Retain every supplied record with its original ID while rewriting its content." });
    }
  }

  const requireSource = (path: string, value: unknown, label: string) => {
    if (!supported(value, baseline)) issues.push({ path, code: "unsupported_claim", message: `${label} is not present in the uploaded resume or its extracted profile.` });
  };

  (["fullName", "location", "currentRole", "industry"] as const).forEach((field) => requireSource(`profileDraft.${field}`, profile[field], field));
  (output.profileDraft.skills ?? []).forEach((value, index) => requireSource(`profileDraft.skills.${index}`, value, "Skill"));
  (output.profileDraft.experience ?? []).forEach((role, index) => {
    requireSource(`profileDraft.experience.${index}.employer`, role.employer, "Employer");
    requireSource(`profileDraft.experience.${index}.title`, role.title, "Role title");
    requireSource(`profileDraft.experience.${index}.startDate`, role.startDate, "Role start date");
    requireSource(`profileDraft.experience.${index}.endDate`, role.endDate, "Role end date");
    const original = (input.deterministicDraft.experience ?? []).find((item) => item.id === role.id);
    if (original) {
      const substantiveSource = original.achievements.filter((item) => normalize(item).split(" ").length >= 7);
      const minimumBullets = substantiveSource.length >= 3 ? 2 : substantiveSource.length ? 1 : 0;
      const meaningfulBullets = role.achievements.filter((item) => normalize(item).split(" ").length >= 7);
      if (meaningfulBullets.length < minimumBullets) {
        issues.push({ path: `profileDraft.experience.${index}.achievements`, code: "substantive_role_underwritten", message: `This role has ${substantiveSource.length} substantive source achievements but only ${meaningfulBullets.length} usable rewritten bullets. Preserve its distinct verified work in ${minimumBullets} or more concise, specific bullets; do not replace it with a generic role description or invent outcomes.` });
      }
    }
  });
  (output.profileDraft.education ?? []).forEach((item, index) => {
    requireSource(`profileDraft.education.${index}.institution`, item.institution, "Education institution");
    requireSource(`profileDraft.education.${index}.qualification`, item.qualification, "Qualification");
    requireSource(`profileDraft.education.${index}.startDate`, item.startDate, "Education start date");
    requireSource(`profileDraft.education.${index}.endDate`, item.endDate, "Education end date");
  });
  (output.profileDraft.certifications ?? []).forEach((item, index) => {
    requireSource(`profileDraft.certifications.${index}.name`, item.name, "Certification");
    requireSource(`profileDraft.certifications.${index}.issuer`, item.issuer, "Certification issuer");
    requireSource(`profileDraft.certifications.${index}.date`, item.date, "Certification date");
  });
  (output.profileDraft.projects ?? []).forEach((item, index) => requireSource(`profileDraft.projects.${index}.name`, item.name, "Project"));
  (output.profileDraft.awards ?? []).forEach((item, index) => {
    requireSource(`profileDraft.awards.${index}.title`, item.title, "Award");
    requireSource(`profileDraft.awards.${index}.issuer`, item.issuer, "Award issuer");
    requireSource(`profileDraft.awards.${index}.date`, item.date, "Award date");
  });
  (output.profileDraft.publications ?? []).forEach((item, index) => {
    requireSource(`profileDraft.publications.${index}.title`, item.title, "Publication");
    requireSource(`profileDraft.publications.${index}.publisher`, item.publisher, "Publisher");
    requireSource(`profileDraft.publications.${index}.date`, item.date, "Publication date");
  });
  (output.profileDraft.volunteerExperience ?? []).forEach((item, index) => {
    requireSource(`profileDraft.volunteerExperience.${index}.role`, item.role, "Volunteer role");
    requireSource(`profileDraft.volunteerExperience.${index}.organization`, item.organization, "Volunteer organization");
    requireSource(`profileDraft.volunteerExperience.${index}.startDate`, item.startDate, "Volunteer start date");
    requireSource(`profileDraft.volunteerExperience.${index}.endDate`, item.endDate, "Volunteer end date");
  });
  (output.profileDraft.languages ?? []).forEach((value, index) => requireSource(`profileDraft.languages.${index}`, value, "Language"));

  const supportedNumbers = new Set(numericClaims([input.resumeText, ...claimStrings(input.deterministicDraft as Record<string, unknown>)]));
  const sourceProse = `${input.resumeText}\n${claimStrings(input.deterministicDraft as Record<string, unknown>).join("\n")}`;
  for (const text of claimStrings(profile)) {
    for (const match of text.matchAll(/\b(?:over|more than|exceeding)\s+(\d+(?:[,.]\d+)*)\b/gi)) {
      const literal = match[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const qualified = new RegExp(`(?:\\b(?:over|more than|exceeding)\\s+${literal}(?![\\d,.])|\\b${literal}\\s*\\+)`, "i");
      if (!qualified.test(sourceProse)) issues.push({ path: "profileDraft", code: "unsupported_metric_qualifier", message: `Do not strengthen the source quantity ${match[1]} into '${match[0]}'. Preserve exact quantities and their original qualifiers; an exact count is not a lower bound.` });
    }
  }
  numericClaims(claimStrings(profile)).forEach((number) => {
    if (!supportedNumbers.has(number)) issues.push({ path: "profileDraft", code: "unsupported_numeric_claim", message: `Numeric claim ${number} is not supported by the uploaded resume. Copy the source number exactly, including abbreviated years in achievement text (for example Sep’19 must not become September 2019). Do not expand dates or invent a replacement metric.` });
  });

  return issues.slice(0, 20);
}

function validateResumeReview(input: AiTaskInput<"analyzeResume">, output: AiTaskOutput<"analyzeResume">) {
  const issues: SemanticIssue[] = [];
  const unfinishedDegrees = [
    { source: /\b(?:bachelor(?:['’]s)?|B\.?\s*Tech|B\.?\s*Sc|B\.?\s*A)\b/i, claim: /(?:\b(?:holds?|earned|obtained|completed|has(?:\s+(?:a|an))?)\s+(?:a\s+|an\s+|the\s+)?|\bgraduated with\s+(?:a\s+|an\s+)?)(?:bachelor|B\.?\s*Tech|B\.?\s*Sc|B\.?\s*A)\b/i },
    { source: /\b(?:master(?:['’]s)?|M\.?\s*Tech|MBA|M\.?\s*Sc)\b/i, claim: /\b(?:holds?|earned|obtained|completed|has|graduated with)\s+(?:a\s+|an\s+|the\s+)?(?:master|M\.?\s*Tech|MBA|M\.?\s*Sc)\b/i },
  ];
  const lines = input.resumeText.split(/\r?\n/);
  for (const degree of unfinishedDegrees) {
    const entries = lines.flatMap((line, index) => degree.source.test(line) ? [lines.slice(index, index + 3).join(" ")] : []);
    if (!entries.length || !entries.every((entry) => /\b(?:expected\s+(?:completion|graduation)|in progress|currently pursuing|pursuing)\b/i.test(entry))) continue;
    const claims = [output.summary, ...(output.workbookAssessments ?? []).map(row => row.evidence?.rationale ?? ""), ...(output.jdRequirements ?? []).map(row => row.evidence.rationale)];
    if (claims.some((claim) => degree.claim.test(claim))) {
      issues.push({ path: "workbookAssessments.C05", code: "degree_completion_not_supported", message: "The cited degree is in progress. State the documented expected completion and reassess any completed-degree requirement using the exact evidence." });
    }
  }
  const chronology = output.workbookAssessments?.find(row=>row.id === "C08" && row.status === "Assessed");
  const conflict = chronology?.rating != null ? chronologyRatingConflict(input.resumeText,chronology.rating) : undefined;
  if(conflict) issues.push({path:"workbookAssessments.C08",code:"chronology_rating_conflict",message:conflict});
  for (const row of output.workbookAssessments ?? []) {
    if (row.status === "N/A" && row.id.startsWith("C") && row.id !== "C05" && row.id !== "C08") {
      issues.push({ path: "workbookAssessments." + row.id, code: "content_applicability", message: "This content criterion always applies. Use Pending only when the evidence cannot be interpreted." });
    }
    if (row.status !== "Assessed" && (!row.naOrPendingReason?.trim() || row.rating != null)) {
      issues.push({ path: "workbookAssessments." + row.id, code: "criterion_status", message: "Pending and N/A rows require a reason and no rating." });
    }
  }
  for(const row of [...(output.workbookAssessments ?? []), ...(output.jdRequirements ?? [])]){
    if(row.status !== "Assessed")continue;
    if (row.rating == null) {
      issues.push({ path: "workbookAssessments." + row.id, code: "missing_rating", message: "Assessed rows require an integer rating." });
      continue;
    }
    const evidence=row.evidence;
    if("issues" in row)for(const issue of row.issues ?? [])if(issue.rootCause && (!input.resumeText.includes(issue.rootCause.sourceExcerpt) || ![evidence?.excerpt,...(evidence?.additionalExcerpts ?? []).map(e=>e.excerpt)].some(q=>q?.includes(issue.rootCause!.sourceExcerpt))))issues.push({path:"workbookAssessments",code:"unsupported_root_cause",message:"Root-cause grouping requires the same exact source excerpt linked to each affected criterion."});
    if("id" in row && /^C0[1-9]$/.test(row.id) && row.rating != null) {
      const assessed=row as NonNullable<AiTaskOutput<"analyzeResume">["workbookAssessments"]>[number];
      if(!assessed.anchorComparison || assessed.anchorComparison.anchor!==getRatingAnchor(assessed.id,row.rating) || assessed.anchorComparison.informationState==="uncertain")issues.push({path:`workbookAssessments.${row.id}.anchorComparison`,code:"anchor_comparison_required",message:"For this C row, provide anchorComparison {anchor, justification, nextAnchorGap, informationState}. The anchor must be the verbatim WORKBOOK ANCHORS entry for the row ID and selected rating. Justify the rating using linked evidence and explain the next-anchor gap. informationState describes certainty of interpreting the source, not whether it has deficiencies: legible dates showing an overlap are present evidence of ambiguity. If the source interpretation itself is uncertain, use status Pending with null rating."});
    }
    if("issues" in row && row.rating != null){const conflict=severityConflict(row.rating,row.issues ?? []);if(conflict)issues.push({path:"workbookAssessments",code:"severity_conflict",message:conflict});}
    for(const message of validateSourceEvidence(evidence,input.resumeText,{rating:row.rating ?? undefined}))issues.push({path:`${"owner" in row ? "jdRequirements" : "workbookAssessments"}.${row.id}.evidence`,code:"invalid_source_evidence",message:message+" Check the primary excerpt AND every additionalExcerpts item for this row. Remove heading-only supplementary quotes; preserve substantive exact source evidence. Use linked substantive quotes totaling at least twelve alphanumeric characters, not padding."});
    const documentedAbsence = row.rating === 0 && evidence?.absenceSearch?.outcome === "not_found" && evidence.location?.trim();
    if(!evidence || (!evidence.excerpt.trim() && !documentedAbsence) || !evidence.rationale.trim())issues.push({path:"workbookAssessments",code:"missing_workbook_evidence",message:"Every assessed parameter/requirement needs source evidence and rationale."});
    else if(!documentedAbsence && !input.resumeText.includes(evidence.excerpt))issues.push({path:"workbookAssessments",code:"unsupported_workbook_evidence",message:"Choose a supplied sourceExcerptId; positive evidence must quote the exact resume."});
    if(row.rating === 0 && !evidence?.location?.trim())issues.push({path:"workbookAssessments",code:"missing_absence_search",message:"Document where the resume was searched before assigning absence rating 0."});
  }
  const requirements = output.jdRequirements ?? [];
  if (new Set(requirements.map((row) => row.id)).size !== requirements.length
    || new Set(requirements.map((row) => row.sourceText.trim().replace(/\s+/g, " ").toLowerCase())).size !== requirements.length) {
    issues.push({ path: "jdRequirements", code: "duplicate_jd_requirement", message: "Assign each distinct atomic requirement one ID and one primary owner." });
  }
  requirements.forEach((requirement,index)=>{
    if(!cleanJobRequirementText(input.jobDescription ?? "").includes(requirement.sourceText))issues.push({path:"jdRequirements."+index+".sourceText",code:"jd_requirement_not_in_source",message:"Copy an exact contiguous substring of the supplied job description, preserving punctuation. Do not rewrite the requirement."});
  });
  if((output.jdRequirements?.length ?? 0)>0 && output.meaningfulJd !== true)issues.push({path:"meaningfulJd",code:"inconsistent_jd_gate",message:"An identified set of actual role requirements must have meaningfulJd=true. A QA-authored description is usable when it states real functions/requirements; employer branding is not required."});
  if(output.workbookAssessments){
    const ids=output.workbookAssessments.map(p=>p.id);
    for(const id of ["C01","C02","C03","C04","C05","C06","C07","C08","C09"])if(!ids.includes(id as typeof ids[number]))issues.push({path:"workbookAssessments",code:"missing_content_criterion",message:`Return ${id} with evidence or an explicit Pending/N/A reason.`});
    if(!input.jobDescription?.trim() && ((output.jdRequirements?.length ?? 0)>0 || output.workbookAssessments.some(row=>row.id.startsWith("J") && row.status!=="N/A")))issues.push({path:"jdRequirements",code:"job_match_without_jd",message:"No-JD mode excludes J01–J05. Do not invent job requirements."});
    if(new Set(ids).size !== ids.length)issues.push({path:"workbookAssessments",code:"duplicate_workbook_parameter",message:"Return each C01-C09 and J01-J05 exactly once."});
    for(const row of output.workbookAssessments.filter(p=>p.id.startsWith("J"))){
      const owned=(output.jdRequirements ?? []).filter(r=>r.owner===row.id);
      if(!owned.length && row.status !== "N/A")issues.push({path:"workbookAssessments."+row.id,code:"unowned_jd_assessment",message:"This J owner has no atomic requirements. Either identify the explicit distinct JD requirement and assess it under this owner, or mark this parameter N/A with the absent-set reason. Do not infer years or seniority from title."});
      if(owned.length && row.status === "N/A")issues.push({path:"workbookAssessments."+row.id,code:"owned_jd_marked_na",message:"A J owner with actual requirements cannot be N/A."});
    }
  }
  const layoutFactor = input.deterministicReview?.factors?.find((factor) => factor.id === "formatting");
  const layoutConcernConfirmed = !layoutFactor || layoutFactor.issues.length > 0;
  const layoutClaim = /\b(?:columns?|side.by.side|horizontal(?:ly)?|single.column)\b/i;
  const parsingClaim = /\b(?:ats|applicant tracking|parsing|parser|text extractor|scrambl\w*|merged? records?)\b/i;
  if (!layoutConcernConfirmed && layoutClaim.test(output.summary) && parsingClaim.test(output.summary)) {
    issues.push({ path: "summary", code: "unsupported_layout_priority", message: "The document-layout check found no confirmed visual issue. Do not call side-by-side content the main parsing weakness without supporting layout evidence. Prioritize a substantive, source-backed writing or relevance issue instead." });
  }
  if (/\[redacted\s+[^\]]+\]/i.test(JSON.stringify(output))) issues.push({ path: "output", code: "unresolved_placeholder", message: "Do not put privacy placeholders in customer-facing feedback or rewrite examples. Choose another useful example grounded in the resume rather than inventing contact details." });
  if (input.resumeText.length >= 3_000 && output.topActions.length < 3) issues.push({ path: "topActions", code: "insufficient_review_depth", message: "A substantial resume needs at least three distinct, evidence-led improvement actions spanning different material issues." });
  if (input.resumeText.length >= 3_000 && !/\b(?:resume|cv|document|strengths?|weakness(?:es)?|improv\w*|however|needs?\s+to|recommend\w*|priority|opportunit\w*|unclear)\b/i.test(output.summary)) {
    issues.push({ path: "summary", code: "summary_is_candidate_bio", message: "Assess the resume itself, naming a documented strength and priority weakness; do not write a candidate biography." });
  }
  const hasSkillLikeSection = /^\s*(?:key impact areas|soft skills|(?:core|key|professional|technical)?\s*skills|(?:core|key)?\s*competencies|areas of expertise)\s*$/im.test(input.resumeText);
  if (hasSkillLikeSection && output.topActions.some((action) => /\b(?:no|lacks?|missing|absent|without)\b[^.!?]{0,90}\bskills?\s+section\b/i.test(`${action.observed} ${action.inference}`))) {
    issues.push({ path: "topActions", code: "misread_skills_section", message: "The resume already includes a skills or competency area. Acknowledge that content and recommend a clearer grouping or evidence, rather than saying the section is absent." });
  }
  const source = normalize(input.resumeText);
  const supportedNumbers = new Set(numericClaims([input.resumeText]));
  output.topActions.forEach((action, index) => {
    if(action.improvedExample) for(const message of validateGroundedRewrite(action.improvedExample,action.originalExcerpt,action.originalExcerpt))issues.push({path:`topActions.${index}.improvedExample`,code:"ungrounded_rewrite",message});
    const actionText = `${action.observed} ${action.inference} ${action.suggestion} ${action.improvedExample}`;
    if(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(input.resumeText) && /(?:\b(?:mandatory|required|must)\b[^.!?]{0,60}\blinkedin\b|\blinkedin\b[^.!?]{0,60}\b(?:mandatory|required|must)\b)/i.test(actionText))issues.push({path:`topActions.${index}`,code:"optional_link_required",message:"LinkedIn is optional when a usable contact exists; do not present it as mandatory."});
    if (!layoutConcernConfirmed && layoutClaim.test(actionText) && parsingClaim.test(actionText)) {
      issues.push({ path: `topActions.${index}`, code: "unsupported_layout_risk", message: "The authoritative layout check did not confirm a column or reading-order problem. Do not claim ATS parsing risk or rank a speculative column redesign as an expert finding; choose a source-backed content improvement." });
    }
    if (action.sourceExcerptId && !reviewEvidence(input.resumeText).some((item) => item.id === action.sourceExcerptId)) issues.push({ path: `topActions.${index}.sourceExcerptId`, code: "unknown_evidence", message: "Choose a supplied evidence ID; do not invent one." });
    if (action.originalExcerpt && !source.includes(normalize(action.originalExcerpt))) issues.push({ path: `topActions.${index}.originalExcerpt`, code: "excerpt_not_in_source", message: "The quoted excerpt is not present in the uploaded resume." });
    if (action.improvedExample && !action.originalExcerpt) issues.push({ path: `topActions.${index}.improvedExample`, code: "example_without_source", message: "An improved example requires an exact source excerpt." });
    if (/\b(?:typo|typograph\w*|misspell\w*|spacing error|split word)\b/i.test(`${action.observed} ${action.inference} ${action.suggestion}`)
      && /\b[\p{L}]{3,}\s+(?:ing|ed|ly|tion|ment)\b/iu.test(action.originalExcerpt)) {
      issues.push({ path: `topActions.${index}`, code: "possible_extraction_artifact", message: "An apparent split word in extracted text may be a PDF-reading artefact, not a typo in the customer's actual resume. Do not criticize it as an original-document error without visual confirmation; choose another substantive issue." });
    }
    numericClaims([action.improvedExample]).forEach((number) => {
      if (!supportedNumbers.has(number)) issues.push({ path: `topActions.${index}.improvedExample`, code: "unsupported_numeric_claim", message: `Numeric claim ${number} is not supported by the uploaded resume.` });
    });
  });
  return issues.slice(0, 20);
}

export function validateAiSemantics<T extends AiTaskName>(task: T, input: AiTaskInput<T>, output: AiTaskOutput<T>): SemanticIssue[] {
  if (task === "extractResumeProfile") {
    const source = (input as AiTaskInput<"extractResumeProfile">).resumeText;
    const profile = (output as AiTaskOutput<"extractResumeProfile">).profileDraft;
    const issues: SemanticIssue[] = [];
    if (/\[redacted\s+[^\]]+\]/i.test(JSON.stringify(output))) {
      issues.push({ path: "output", code: "unresolved_placeholder", message: "Do not show privacy placeholders in extracted fields, improvement notes, or warnings. Describe contact issues without quoting contact values; never guess a redacted date or other fact." });
    }
    if ((profile.skills ?? []).length > 40) {
      issues.push({ path: "profileDraft.skills", code: "too_many_extracted_skills", message: "Keep at most 40 distinct, concise source-supported competencies. Remove near-duplicates and responsibility phrases before returning the profile." });
    }
    const normalizedSource = normalize(source);
    for (const [index, item] of (profile.education ?? []).entries()) {
      const qualification = item.qualification.trim();
      // A missing leading degree initial can otherwise pass the broad
      // source-substring check: "E., Computer Science" occurs inside
      // "B.E., Computer Science" after normalization.
      if (/^[A-Za-z]\s*\./.test(qualification)) {
        const escaped = normalize(qualification).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`(?:^| )(?:b|m|d) ${escaped}(?: |$)`, "i").test(normalizedSource)) {
          issues.push({ path: `profileDraft.education.${index}.qualification`, code: "truncated_qualification", message: "The uploaded resume prints a longer degree abbreviation. Copy the full qualification exactly, including its leading initial, instead of accepting a substring." });
        }
      }
    }
    for (const [index, activity] of (profile.volunteerExperience ?? []).entries()) {
      if (!supported(activity.organization, normalizedSource)) {
        issues.push({ path: `profileDraft.volunteerExperience.${index}.organization`, code: "activity_organization_not_in_source", message: "Use only an organization name actually printed in the resume. If the source merely says Placement Cell in college, keep Placement Cell rather than inventing a named College Placement Cell." });
      }
    }
    if (/extracurricular achievements/i.test(source) && /\b(?:gold|silver|bronze)\s+medal\b/i.test(source)
      && !(profile.awards ?? []).some((award) => /\b(?:gold|silver|bronze)\s+medal\b/i.test(`${award.title} ${award.description ?? ""}`))) {
      issues.push({ path: "profileDraft.awards", code: "explicit_medal_omitted", message: "The Extracurricular Achievements section explicitly contains a medal. Preserve it as an award record with only source-supported details." });
    }
    if ((profile.awards ?? []).some((award) => /\b(?:founder\s+member|member\s+of|placement\s+cell)\b/i.test(award.title))) {
      issues.push({ path: "profileDraft.awards", code: "membership_is_not_award", message: "Membership or participation is not an award. Move this source-backed record to volunteerExperience or another activity field." });
    }
    for (const [index, award] of (profile.awards ?? []).entries()) {
      if (!award.kind) issues.push({ path: `profileDraft.awards.${index}.kind`, code: "achievement_type_missing", message: "Classify this record as an award only if the source describes a prize, formal recognition, or honour. Otherwise classify a source-backed non-prize milestone as achievement. Do not leave the type blank." });
      if (award.kind === "award" && /\b(?:completed|participated|took part|attended|finished)\b/i.test(`${award.title} ${award.description}`)
        && !/\b(?:won|winner|medal|prize|award|honou?r|recognized|recognised|first place|podium)\b/i.test(`${award.title} ${award.description}`)) {
        issues.push({ path: `profileDraft.awards.${index}.kind`, code: "participation_is_not_award", message: "Completion or participation without a documented prize is an achievement, not an award. Keep the source fact and classify it accurately." });
      }
      const awardText = normalize(`${award.title} ${award.description ?? ""}`);
      for (const bullet of datedAwardBullets(source)) {
        if (awardText.includes(bullet.anchor) && !bullet.years.some((year) => award.date.includes(year))) {
          issues.push({ path: `profileDraft.awards.${index}.date`, code: "dated_achievement_misattributed", message: `This award or achievement includes source wording from the ${bullet.years.join("-")} heading. Keep its printed date and separate items from different dated groups rather than merging them.` });
          break;
        }
      }
    }
    if (/\bFounder Member of\b/i.test(source) && !(profile.volunteerExperience ?? []).some((activity) => /\bFounder Member\b/i.test(activity.role))) {
      issues.push({ path: "profileDraft.volunteerExperience", code: "founder_membership_omitted", message: "Preserve the explicit Founder Member activity in volunteerExperience without inventing dates or responsibilities." });
    }
    if (/(?:^|\n)\s*(?:summer|winter)?\s*internship\s*[-:–]/i.test(source)
      && !(profile.experience ?? []).some((role) => /\bintern(?:ship)?\b/i.test(`${role.title} ${role.employer}`))) {
      issues.push({ path: "profileDraft.experience", code: "explicit_internship_omitted", message: "The resume contains a separately headed internship. Preserve it as a distinct experience record with its source-backed employer, project or responsibilities, and only dates that are actually printed." });
    }
    for (const title of nestedUndatedRoles(source)) {
      const matches = (profile.experience ?? []).filter((role) => normalize(role.title) === normalize(title));
      if (!matches.length) issues.push({ path: "profileDraft.experience", code: "nested_role_omitted", message: `The source separately lists the role “${title}” under earlier roles at one employer. Preserve it as its own experience record; do not fold it into a paragraph or another role.` });
      else if (matches.some((role) => role.startDate || role.endDate)) issues.push({ path: "profileDraft.experience", code: "nested_role_dates_inferred", message: `The source lists “${title}” without role-specific tenure dates. Leave its start and end dates blank for customer confirmation; the employer's overall tenure does not establish this role's tenure.` });
    }
    return issues;
  }
  if (task === "generateCoverLetter" || task === "generateLinkedInMakeover") {
    const issues: SemanticIssue[] = [];
    if (/\[redacted\s+[^\]]+\]/i.test(JSON.stringify(output))) issues.push({ path: "output", code: "unresolved_placeholder", message: "Remove redaction placeholders; do not invent missing contact details." });
    if (task === "generateLinkedInMakeover") {
      const source = input as AiTaskInput<"generateLinkedInMakeover">;
      const result = output as AiTaskOutput<"generateLinkedInMakeover">;
      const knownRoles = new Set(source.profile.experience.map((role) => role.id));
      const seenRoles = new Set<string>();
      result.experience.forEach((role, index) => {
        if (!knownRoles.has(role.roleId)) issues.push({ path: `experience.${index}.roleId`, code: "unknown_role", message: "Use only the exact roleId from a supplied career record." });
        if (seenRoles.has(role.roleId)) issues.push({ path: `experience.${index}.roleId`, code: "duplicate_role", message: "Return each supplied career record exactly once." });
        seenRoles.add(role.roleId);
      });
      if ([...knownRoles].some((id) => !seenRoles.has(id))) issues.push({ path: "experience", code: "missing_role", message: "Include every supplied career record using its exact roleId. Do not silently omit roles." });
      const numbers = new Set(numericClaims(claimStrings(source.profile as unknown as Record<string, unknown>)));
      numericClaims([...result.headlines, result.about, ...result.experience.map((role) => role.text)]).forEach((number) => {
        if (!numbers.has(number)) issues.push({ path: "output", code: "unsupported_numeric_claim", message: `Numeric claim ${number} is absent from the confirmed profile. Do not invent achievements or dates.` });
      });
    }
    if (task === "generateCoverLetter") {
      const letter = output as AiTaskOutput<"generateCoverLetter">;
      const source = input as AiTaskInput<"generateCoverLetter">;
      // Keep the model's validated output compatible with the PDF/DOCX export
      // contract. A 250-word body can still fail export if it contains one
      // very short paragraph or an overly long greeting.
      if (letter.paragraphs.length < 3 || letter.paragraphs.length > 6) issues.push({ path: "paragraphs", code: "letter_paragraph_count", message: "Use three to six distinct body paragraphs, ideally four." });
      letter.paragraphs.forEach((paragraph, index) => {
        if (paragraph.trim().length < 40 || paragraph.trim().length > 1_500) issues.push({ path: `paragraphs.${index}`, code: "letter_paragraph_size", message: "Keep every body paragraph between 40 and 1,500 characters so it can be exported." });
      });
      if (typeof letter.greeting === "string" && (letter.greeting.trim().length < 2 || letter.greeting.trim().length > 120)) issues.push({ path: "greeting", code: "letter_greeting_size", message: "Use a short professional greeting, such as Dear Hiring Manager." });
      if (typeof letter.closing === "string" && (letter.closing.trim().length < 2 || letter.closing.trim().length > 80)) issues.push({ path: "closing", code: "letter_closing_size", message: "Use a short professional signoff." });
      const supportedNumbers = new Set(numericClaims(claimStrings(source.profile as unknown as Record<string, unknown>)));
      numericClaims(letter.paragraphs).forEach((number) => {
        if (!supportedNumbers.has(number)) issues.push({ path: "paragraphs", code: "unsupported_numeric_claim", message: `Numeric claim ${number} is absent from the confirmed profile. Remove it; job requirements are not candidate achievements.` });
      });
      const words = letter.paragraphs.join(" ").trim().split(/\s+/).length;
      if (words < 250 || words > 450) issues.push({ path: "paragraphs", code: "letter_length", message: `The body contains ${words} words after removing duplicate paragraphs. Rewrite into four distinct paragraphs of 70-90 words each (280-360 words total). Preserve only supplied facts; include a specific introduction, two evidence-based paragraphs and a concise statement of fit. Do not pad by repetition.` });
    }
    return issues;
  }
  if (task === "transformResumeProfile") return validateTransform(input as AiTaskInput<"transformResumeProfile">, output as AiTaskOutput<"transformResumeProfile">);
  if (task === "analyzeResume") return validateResumeReview(input as AiTaskInput<"analyzeResume">, output as AiTaskOutput<"analyzeResume">);
  if (task === "rewriteResumeSection") {
    const data=input as AiTaskInput<"rewriteResumeSection">, result=output as AiTaskOutput<"rewriteResumeSection">;
    const source=[data.originalText,...data.verifiedFacts].join("\n");
    return [...[result.rewrite,...result.alternatives].flatMap((text,index)=>validateGroundedRewrite(text,source,data.originalText).map(message=>({path:`rewrite.${index}`,code:"ungrounded_rewrite",message}))),...result.factsUsed.flatMap((fact,index)=>validateGroundedRewrite(fact,source).map(message=>({path:`factsUsed.${index}`,code:"ungrounded_rewrite",message})))];
  }
  if(task === "explainResumeIssue") {
    const data=input as AiTaskInput<"explainResumeIssue">, result=output as AiTaskOutput<"explainResumeIssue">;
    const guidance=/^(?:Use|Describe|Confirm|Where accurate|Add|State|Include|Explain|Verify|Ask|List|Keep|Check|Do not|Only|Avoid)\b/i.test(result.example);
    return result.example ? validateGroundedRewrite(result.example,data.evidence.join("\n"),"",{guidance}).map(message=>({path:"example",code:"ungrounded_rewrite",message})) : [];
  }
  if (task === "recommendUpskilling") {
    const source = input as AiTaskInput<"recommendUpskilling">;
    const result = output as AiTaskOutput<"recommendUpskilling">;
    const approvedIds = new Set(source.availableCourses.map((course) => course.id));
    return result.priorities.flatMap((priority, index) => priority.courseIds.filter((id) => !approvedIds.has(id)).map(() => ({ path: `priorities.${index}.courseIds`, code: "unknown_course", message: "Recommend only a course ID supplied in the verified catalog; never invent a training program." })));
  }
  if (task === "researchJobs") {
    const source = input as AiTaskInput<"researchJobs">;
    const result = output as AiTaskOutput<"researchJobs">;
    const approvedIds = new Set(source.approvedJobs.map((job) => job.id));
    const seen = new Set<string>();
    return result.matches.flatMap((match, index) => {
      const problems: SemanticIssue[] = [];
      if (!approvedIds.has(match.jobId)) problems.push({ path: `matches.${index}.jobId`, code: "unknown_job", message: "Select only an approved, current listing ID supplied in this request." });
      if (seen.has(match.jobId)) problems.push({ path: `matches.${index}.jobId`, code: "duplicate_job", message: "Return each approved listing at most once." });
      seen.add(match.jobId);
      return problems;
    });
  }
  return [];
}
