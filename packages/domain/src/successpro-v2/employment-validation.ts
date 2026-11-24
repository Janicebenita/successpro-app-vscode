/** Source-only chronology diagnostics. Month indices are inclusive; no FTE inference. */
export interface EmploymentEntry {
  role: string;
  source: string;
  range?: string;
  concurrent?: boolean;
  conflictingRange?: string;
}
interface DateBound { earliest: number; latest: number; precision: "month" | "year"; }
export interface EmploymentFinding {
  kind: "overlap" | "reversed" | "gap" | "future" | "missing" | "invalid" | "ambiguous" | "claim_mismatch";
  roles: string[]; sources: string[]; certainty: "verified" | "uncertain";
  months?: [number, number]; message: string;
}
const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const endpoint = "(?:[A-Za-z]+\\.?(?:\\s*['’`]?\\s*\\d{2,4})|\\d{1,2}/\\d{2,4}|['’`]?\\d{2,4}|present|current|now)";
const rangePattern = new RegExp(`(${endpoint})\\s*(?:[–—-]|\\bto\\b)\\s*(${endpoint})`, "i");
function dateBound(raw: string, now: Date): DateBound | null {
  const value = raw.trim().toLowerCase().replace(/[’`]/g, "'");
  if (/^(present|current|now)$/.test(value)) {
    const month = now.getUTCFullYear() * 12 + now.getUTCMonth();
    return { earliest: month, latest: month, precision: "month" };
  }
  const yearOnly = /^'?(\d{2}|\d{4})$/.exec(value);
  if (yearOnly) {
    const y = Number(yearOnly[1]);
    const year = y < 100 ? (y >= 50 ? 1900 + y : 2000 + y) : y;
    return { earliest: year * 12, latest: year * 12 + 11, precision: "year" };
  }
  const numeric = /^(\d{1,2})\/(\d{2}|\d{4})$/.exec(value);
  const named = /^([a-z]+)\.?\s*'?\s*(\d{2}|\d{4})$/.exec(value);
  const month = numeric ? Number(numeric[1]) : named ? monthNames.indexOf(named[1].slice(0, 3)) + 1 : 0;
  if (month < 1 || month > 12 || (!numeric && !named)) return null;
  const rawYear = Number((numeric ?? named)![2]);
  const year = rawYear < 100 ? (rawYear >= 50 ? 1900 + rawYear : 2000 + rawYear) : rawYear;
  return { earliest: year * 12 + month - 1, latest: year * 12 + month - 1, precision: "month" };
}
function unionMonths(intervals: Array<[number, number]>): number {
  const sorted = intervals.filter(([a,b]) => b >= a).sort((a,b) => a[0]-b[0]);
  let total = 0, end = -Infinity;
  for (const [a,b] of sorted) { total += Math.max(0, b - Math.max(a, end + 1) + 1); end = Math.max(end,b); }
  return total;
}

/** Only recognized experience sections are parsed. Unknown section boundaries are not guessed. */
export function extractEmploymentEntries(text: string): EmploymentEntry[] {
  const rawEntries: EmploymentEntry[] = [];
  let inExperience = false, previous = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^(?:(?:professional|work|employment|career)\s+(?:experience|history|details|record)|experience|employment(?:\s+details)?)\s*:?$/i.test(line)) { inExperience = true; previous = ""; continue; }
    if (/^(?:education|qualifications|certifications|skills|projects|publications|awards|interests|languages|references|summary|profile|academic(?:\s+details)?)\s*:?$/i.test(line)) { inExperience = false; previous = ""; continue; }
    if (!inExperience || !line) continue;
    const sinceMatch = line.match(new RegExp(`\\bsince\\s+(${endpoint})`, "i"));
    const range = line.match(rangePattern)?.[0] ?? (sinceMatch ? `${sinceMatch[1]} – Present` : undefined);
    if (range) {
      const label = line.replace(range, "").replace(/^[\s|,:–—-]+|[\s|,:–—-]+$/g, "");
      const source = label ? raw : `${previous}\n${raw}`;
      rawEntries.push({ role: label || previous || "Unidentified experience entry", source, range, concurrent: /\b(part.time|concurrent|alongside|freelance)\b/i.test(source) });
    } else if (/\b(?:present|current|\d{4})\b/i.test(line)) {
      rawEntries.push({role:previous || line,source:raw,range:line});
    } else if (line.length < 80 && /(?:\b(?:at|\|)\s*\S+|\s+[-–—]\s+[A-Za-z])/i.test(line) && !/^[•*-]/.test(line)
      && !/\bat\s+(?:(?:a|any|the same)\s+(?:given\s+)?time|least|most)\b/i.test(line)
      && !/:(?:\s+[a-z]|\s+started|\s+took|\s+built|\s+hired|\s+managed)/i.test(line)
      && /\b(officer|director|president|manager|lead|head|vp|avp|engineer|consultant|specialist|executive|administrator|analyst|developer|architect|designer)\b/i.test(line)) {
      rawEntries.push({role:line,source:raw});
    }
    previous = line;
  }

  // Merge company headers with immediate designation sub-rows (e.g. table header company + title row)
  const isCompanyIndicator = (str: string) => /\b(limited|ltd|pjsc|group|inc|corp|llc|pvt|co|company|telecom|australia|india)\b/i.test(str) || /^:\s*/.test(str);
  const isTitleIndicator = (str: string) => !/^[•*-]/.test(str.trim()) && str.length < 60 && /\b(officer|director|president|manager|lead|head|vp|avp|engineer|consultant|specialist|executive|administrator)\b/i.test(str);

  const merged: EmploymentEntry[] = [];
  for (let i = 0; i < rawEntries.length; i++) {
    const cur = rawEntries[i];
    const next = rawEntries[i + 1];
    // A pipe-delimited label already identifies a complete role entry.
    if (next && !cur.role.includes("|") && !next.role.includes("|")
      && isCompanyIndicator(cur.role) && !isTitleIndicator(cur.role) && isTitleIndicator(next.role)) {
      const cleanCompany = cur.role.replace(/^:\s*/, "").trim();
      const cleanTitle = next.role.replace(/^:\s*/, "").trim();
      const combinedRole = `${cleanTitle} – ${cleanCompany}`;
      const combinedSource = `${cur.source}\n${next.source}`;
      const conflicting = next.range && cur.range && next.range.toLowerCase() !== cur.range.toLowerCase();
      merged.push({
        role: combinedRole,
        source: combinedSource,
        range: cur.range || next.range,
        conflictingRange: conflicting ? next.range : undefined,
        concurrent: cur.concurrent || next.concurrent
      });
      i++;
    } else {
      merged.push(cur);
    }
  }

  return merged.filter((entry,index) => entry.range || !merged.slice(index+1,index+2).some(next => next.role === entry.role));
}

export function validateEmploymentDates(entries: EmploymentEntry[], claimedYears?: number, now = new Date()) {
  const findings: EmploymentFinding[] = [];
  const valid: Array<{entry:EmploymentEntry; start:DateBound; end:DateBound}> = [];
  const current = now.getUTCFullYear()*12 + now.getUTCMonth();
  const add = (entry:EmploymentEntry, kind:EmploymentFinding["kind"], certainty:EmploymentFinding["certainty"], message:string) => findings.push({kind,roles:[entry.role],sources:[entry.source],certainty,message});
  for (const entry of entries) {
    if (!entry.range) { add(entry,"missing","uncertain","Employment date range not supplied; request confirmation."); continue; }
    const parts = entry.range.match(rangePattern);
    if (!parts) { add(entry,"ambiguous","uncertain","Cannot reliably parse employment range."); continue; }
    const start = dateBound(parts[1],now), end = dateBound(parts[2],now);
    if (!start || !end || /^(present|current|now)$/i.test(parts[1])) { add(entry,"invalid","uncertain","Invalid or ambiguous date token; confirm against original document."); continue; }
    if (start.earliest > end.latest) { add(entry,"reversed","verified","Printed start is later than printed end; C08 material contradiction anchor requires review."); continue; }
    if (start.earliest > current || end.earliest > current) { add(entry,"future","verified","Printed employment date is in the future; confirm whether this describes planned employment."); continue; }
    if (start.precision === "year" || end.precision === "year") add(entry,"ambiguous","uncertain","Year-only dates give duration bounds, not exact months.");
    if (entry.conflictingRange) {
      add(entry, "claim_mismatch", "verified", `Conflicting employment dates for "${entry.role}": header indicates "${entry.range}" but role entry indicates "${entry.conflictingRange}".`);
    }
    valid.push({entry,start,end});
  }
  for (let i=0;i<valid.length;i++) for (let j=i+1;j<valid.length;j++) {
    const a=valid[i], b=valid[j];
    const min = Math.max(0, Math.min(a.end.earliest,b.end.earliest)-Math.max(a.start.latest,b.start.latest)+1);
    const max = Math.max(0, Math.min(a.end.latest,b.end.latest)-Math.max(a.start.earliest,b.start.earliest)+1);
    if (max <= 1) continue; // Same-month transition is not a contradictory overlap.
    const concurrent = a.entry.concurrent || b.entry.concurrent;
    findings.push({kind:"overlap",roles:[a.entry.role,b.entry.role],sources:[a.entry.source,b.entry.source],certainty:min>1 ? "verified" : "uncertain",months:[min,max],message:concurrent ? "Source labels concurrent work; union duration without double counting. No contradiction inferred." : "Overlapping ranges; concurrent work is possible. Ask for clarification, never infer deception."});
  }
  const chronological = [...valid].sort((a,b)=>a.start.earliest-b.start.earliest);
  let coveredEnd = chronological[0]?.end.latest;
  for (let i=1;i<chronological.length;i++) {
    const b=chronological[i];
    if (b.start.earliest > coveredEnd+1) {
      const gapMonths = b.start.earliest - coveredEnd - 1;
      const dur = gapMonths >= 12 ? `${Math.floor(gapMonths / 12)} year${Math.floor(gapMonths / 12) > 1 ? "s" : ""}${gapMonths % 12 ? " " + (gapMonths % 12) + " mo" : ""}` : `${gapMonths} months`;
      findings.push({kind:"gap",roles:[chronological[i-1].entry.role,b.entry.role],sources:[chronological[i-1].entry.source,b.entry.source],certainty:"verified",months:[gapMonths,b.start.latest-coveredEnd-1],message:`Unexplained employment gap of ${dur} between "${chronological[i-1].entry.role}" and "${b.entry.role}".`});
    }
    coveredEnd = Math.max(coveredEnd,b.end.latest);
  }
  const durationMonths: [number,number] = [unionMonths(valid.map(v=>[v.start.latest,v.end.earliest])),unionMonths(valid.map(v=>[v.start.earliest,v.end.latest]))];
  if (claimedYears !== undefined && valid.length && (claimedYears*12 < durationMonths[0] || claimedYears*12 > durationMonths[1])) findings.push({kind:"claim_mismatch",roles:valid.map(v=>v.entry.role),sources:valid.map(v=>v.entry.source),certainty:"uncertain",message:"Claim differs from supplied calendar-duration bounds; partial history, relevance or rounding may explain it. Request confirmation, no automatic penalty."});
  return {entries,findings,durationMonths,claimedYears,asOf:now.toISOString().slice(0,10),method:"Inclusive calendar-month interval union; year-only endpoints bounded January–December; no FTE inference. Gaps never penalized."};
}

export function employmentDiagnostics(text:string, now = new Date()) {
  const claimed = text.match(/\b(\d+(?:\.\d+)?)\+?\s*years?(?:\s+of)?\s+(?:professional\s+|total\s+|work\s+)?experience\b/i);
  return {...validateEmploymentDates(extractEmploymentEntries(text),claimed ? Number(claimed[1]) : undefined,now),claimedSource:claimed?.[0]};
}

/** Reject a contradicted rating for reassessment; do not replace it or alter arithmetic. */
export function chronologyRatingConflict(text:string, rating:number, now = new Date()):string | undefined {
  const audit = employmentDiagnostics(text,now);
  if(rating>=4 && audit.findings.some(f=>["missing","invalid"].includes(f.kind) || (f.kind==="ambiguous" && !f.message.startsWith("Year-only"))))return "C08 high rating requires date clarification; uncertain extraction is Pending, not an automatic lower rating.";
  if (rating > 0 && audit.findings.some(f=>f.kind === "reversed" && f.certainty === "verified")) return "C08 rating conflicts with material contradiction anchor D13: reversed source dates. Reassess or clarify.";
  if (rating >= 4 && audit.findings.some(f=>f.kind === "overlap" && f.certainty === "verified" && !f.message.startsWith("Source labels"))) return "C08 high rating requires clarification of verified overlapping ranges against E13/F13; concurrent work may be legitimate.";
  if (rating >= 4 && audit.findings.some(f=>f.kind === "future")) return "C08 high rating requires clarification of future employment dates against E13/F13.";
  return undefined;
}
