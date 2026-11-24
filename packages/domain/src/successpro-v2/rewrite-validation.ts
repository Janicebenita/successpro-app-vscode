import {numericalClaims} from "./source-evidence";
const placeholder=/\b(?:the contact detail|placeholder|redacted|lorem ipsum|todo|tbd|your name|your email|your phone)\b|\[(?:[^\]]*)\]|<\s*(?:insert|add|your)[^>]*>/i;
const urls=(s:string)=>s.match(/(?:https?:\/\/|www\.)[^\s<>]+|\b(?:linkedin\.com|[a-z0-9-]+\.(?:com|org|net|io|dev))\/[^\s<>]*/gi) ?? [];
const emails=(s:string)=>s.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) ?? [];
const phones=(s:string)=>(s.match(/(?<!\d)\+?\d[\d ().-]{7,}\d(?!\d)/g) ?? []).filter(v=>!/^\d{4}\s*[-–—]\s*\d{4}$/.test(v));
const normalized=(s:string)=>s.normalize("NFKC").toLowerCase().replace(/\s+/g," ").trim();
const tokens=(s:string)=>normalized(s).match(/[\p{L}\p{N}]+/gu) ?? [];
// Only grammatical glue is allowed without a source token. New factual/action words require evidence.
const glue=new Set("a an the and or of to for in on at by with from as is are was were be been being that this these those it its their they them i my our we which who while through into across within using used use including include includes".split(" "));
export function validateGroundedRewrite(rewrite:string, source:string, originalSection="", options:{guidance?:boolean}={}):string[] {
  const issues:string[]=[];
  if(placeholder.test(rewrite))issues.push("Rewrite contains placeholder, redaction or template text. Ask for missing facts separately.");
  for(const [label,extract] of [["URL",urls],["email",emails],["phone",phones]] as const) {
    const known=new Set(extract(source).map(normalized));
    for(const value of extract(rewrite))if(!known.has(normalized(value)))issues.push(`Unsupported ${label}: ${value}`);
    const present=new Set(extract(rewrite).map(normalized));
    for(const value of extract(originalSection))if(!present.has(normalized(value)))issues.push(`Existing ${label} was removed or changed: ${value}`);
  }
  const knownNumbers=new Set(numericalClaims(source));
  for(const claim of numericalClaims(rewrite))if(!knownNumbers.has(claim))issues.push(`Unsupported numerical fact: ${claim}`);
  const knownTokens=new Set(tokens(source));
  const novel=[...new Set(tokens(rewrite).filter(token=>!glue.has(token)&&!knownTokens.has(token)))];
  if(novel.length && !options.guidance)issues.push(`Unverified factual wording (confirm rather than invent): ${novel.slice(0,15).join(", ")}`);
  // Capitalized multi-word entities must stay together, not be recombined into a new employer/credential.
  for(const entity of rewrite.match(/\b(?:[A-Z][\p{L}\d]+(?:\s+|$)){2,}/gu) ?? []) {
    if(!normalized(source).includes(normalized(entity)))issues.push(`Unverified named entity: ${entity.trim()}`);
  }
  return [...new Set(issues)];
}
