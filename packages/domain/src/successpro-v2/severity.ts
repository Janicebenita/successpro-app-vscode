import type {IssuePayload} from "./types";
/** User-approved Phase4A policy, 2026-11-16. Labels never change earned points. */
export function severityForRating(rating:number, confirmedBlocker=false):IssuePayload["severity"]|null {
  if(!Number.isInteger(rating)||rating<0||rating>5)throw new Error("Severity requires integer rating 0–5");
  if(rating===5)return null;
  return confirmedBlocker ? "Critical" : rating===4 ? "Minor" : "Major";
}
export function severityConflict(rating:number, issues:IssuePayload[]):string|undefined {
  const positive=/\b(?:no (?:material )?(?:issues?|shortfalls?|deficiencies)|fully meets|no improvement needed)\b/i;
  const serious=/\b(?:material contradiction|unreadable|illegible|cannot (?:contact|read)|no usable contact|severe deficiency)\b/i;
  if(rating<4 && issues.some(i=>positive.test(i.message)))return "Low rating contradicts positive finding; reassess evidence and rating.";
  if(rating>=4 && issues.some(i=>serious.test(i.message)||i.confirmedBlocker))return "High rating contradicts serious deficiency or confirmed blocker; reassess evidence and rating.";
  if(rating===5 && issues.length)return "Full rating cannot carry a negative issue; reassess or remove unsupported issue.";
  return undefined;
}
export function consistentSeverity(rating:number, issues:IssuePayload[]):IssuePayload[] {
  if(rating===5)return [];
  return issues.map(issue=>({...issue,severity:severityForRating(rating,issue.confirmedBlocker===true)!}));
}
