export interface SourceEvidence {
  excerpt:string; rationale:string; location?:string;
  additionalExcerpts?:Array<{excerpt:string;location?:string;sourceExcerptId?:string}>;
  absenceSearch?:{scope:string;searchedFor:string;outcome:"not_found"};
}
const heading = /^(?:profile|summary|professional\s+(?:experience|summary)|work\s+experience|employment\s+history|experience|education|skills|core\s+(?:skills|competencies)|qualifications|certifications|projects|references)\s*:?$/i;
export function isResumeEvidenceHeading(value: string): boolean {
  const text = value.trim();
  return heading.test(text) || (
    /^[\p{L}\s&/–—-]+:?$/u.test(text) && text === text.toUpperCase()
    && /\b(?:experience|projects|skills|education|portfolio|summary|profile|qualifications|certifications|training|publications|achievements|competencies)\b/i.test(text)
  );
}

export function repeatsVisualAnchor(evidence: string, anchor: string): boolean {
  const normalizeAnchor = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return normalizeAnchor(evidence) === normalizeAnchor(anchor);
}

export function cleanJobRequirementText(value: string): string {
  return value.replace(/^[ \t]*[-*+•][ \t]+/gm, "").replace(/\*\*(?=\S)|(?<=\S)\*\*/g, "").trim();
}

export const DEFAULT_MIN_EVIDENCE_CHARACTERS = 12;
const normalize = (s:string)=>s.toLowerCase().replace(/\s+/g," ").trim();
/** Preserve units: 20% cannot support 20 years, and $20 cannot support $200. */
export function numericalClaims(text:string):string[] {
  const prose=text.replace(/\b[0-5]\s*\/\s*5\b/g,"");
  return [...prose.matchAll(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}\b|(?:[$£€₹]\s*)?\b\d+(?:[,.]\d+)*(?:\s*(?:%|percent\b|years?\b|months?\b|million\b|billion\b|thousand\b|employees?\b|teams?\b|projects?\b|clients?\b|roles?\b|pages?\b))?|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?\s+(?:years?|months?|percent|employees?|teams?|projects?|clients?|roles?|pages?)\b/gi)].map(m=>normalize(m[0]).replace(/\bpercent\b/g,"%").replace(/\s*%/g,"%").replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?=\s+\d{4})/g,"$1"));
}
export function validateSourceEvidence(evidence:SourceEvidence|undefined, source:string, options:{minimumCharacters?:number;rating?:number;rendered?:boolean}={}):string[] {
  if(!evidence)return ["Missing evidence payload."];
  const issues:string[]=[];
  const quotes=[evidence.excerpt,...(evidence.additionalExcerpts ?? []).map(q=>q.excerpt)];
  const documentedAbsence=options.rating===0 && evidence.absenceSearch?.outcome==="not_found" && !!evidence.absenceSearch.scope.trim() && !!evidence.absenceSearch.searchedFor.trim() && !!evidence.location?.trim();
  const normSource = normalize(source);
  const cleanSource = source.replace(/\r\n/g, "\n");
  const quoteMatches = (q: string) => {
    if (!q.trim()) return false;
    if (source.includes(q)) return true;
    if (cleanSource.includes(q.replace(/\r\n/g, "\n"))) return true;
    return normalize(q).length >= 10 && normSource.includes(normalize(q));
  };
  if(!evidence.rationale.trim())issues.push("Missing rationale.");
  if(!documentedAbsence) for(const quote of quotes) {
    if(isResumeEvidenceHeading(quote) || !quote.trim()) issues.push("Excerpt is heading-only or lacks meaningful source content.");
    if(!options.rendered && (!quote.trim() || !quoteMatches(quote)))issues.push("Excerpt must preserve exact source wording.");
  }
  // Short exact identity/contact facts may jointly establish a criterion. Duplicate padding does not count.
  if(!documentedAbsence && [...new Set(quotes)].filter(q=>!isResumeEvidenceHeading(q)).join("").replace(/[^\p{L}\p{N}]/gu,"").length < (options.minimumCharacters ?? DEFAULT_MIN_EVIDENCE_CHARACTERS))issues.push("Linked excerpts lack sufficient meaningful source content.");
  // Rendered evidence is grounded separately by page inspection, not plain text matching.
  if(!options.rendered) {
    const linked=new Set(quotes.filter(quoteMatches).flatMap(numericalClaims));
    for(const claim of numericalClaims(evidence.rationale)) if(!linked.has(claim))issues.push(`Unsupported numerical claim in rationale: ${claim}. Link the source excerpt or remove the claim.`);
  }
  return [...new Set(issues)];
}
