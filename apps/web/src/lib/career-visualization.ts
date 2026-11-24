import type { CanonicalProfile } from "@successpro/contracts";

export type CareerRegionId = "north-america" | "latin-america" | "europe" | "middle-east" | "africa" | "south-asia" | "east-asia" | "southeast-asia" | "oceania";

export type CareerMilestone = {
  id: string;
  kind: "role" | "education" | "credential" | "recognition" | "achievement";
  label: string;
  detail: string;
  date: string;
  sortYear: number;
  sortRank: number;
};

const regionMatchers: Array<{ id: CareerRegionId; label: string; pattern: RegExp }> = [
  { id: "north-america", label: "North America", pattern: /\b(north america|united states|u\.?s\.?a?|canada|mexico|new york|california|texas|chicago|seattle|toronto|vancouver)\b/i },
  { id: "latin-america", label: "Latin America", pattern: /\b(latin america|latam|brazil|argentina|chile|colombia|peru|costa rica)\b/i },
  { id: "europe", label: "Europe", pattern: /\b(europe|united kingdom|u\.?k\.?|england|france|germany|spain|italy|netherlands|ireland|switzerland|poland|london|paris|berlin)\b/i },
  { id: "middle-east", label: "Middle East", pattern: /\b(middle east|uae|united arab emirates|dubai|abu dhabi|saudi arabia|qatar|oman|bahrain|israel)\b/i },
  { id: "africa", label: "Africa", pattern: /\b(africa|south africa|nigeria|kenya|egypt|morocco|ghana)\b/i },
  { id: "south-asia", label: "South Asia", pattern: /\b(south asia|india|indian|hyderabad|bengaluru|bangalore|mumbai|delhi|gurugram|gurgaon|pune|chennai|kolkata|noida|pakistan|bangladesh|sri lanka|nepal)\b/i },
  { id: "east-asia", label: "East Asia", pattern: /\b(east asia|china|chinese|japan|japanese|south korea|korea|hong kong|taiwan)\b/i },
  { id: "southeast-asia", label: "Southeast Asia", pattern: /\b(southeast asia|singapore|malaysia|indonesia|thailand|vietnam|philippines)\b/i },
  { id: "oceania", label: "Oceania", pattern: /\b(oceania|australia|new zealand|sydney|melbourne|auckland)\b/i },
];

function year(value: string | undefined) {
  const full = value?.match(/(?:19|20)\d{2}/);
  if (full) return Number(full[0]);
  const short = value?.match(/[‘’'](\d{2})\b/);
  if (!short) return 0;
  const number = Number(short[1]);
  return number <= 30 ? 2000 + number : 1900 + number;
}

function chronology(value: string | undefined) {
  if (!value) return 0;
  if (/\b(?:present|current|ongoing|now)\b/i.test(value)) return Number.MAX_SAFE_INTEGER;
  const matchedYear = year(value);
  if (!matchedYear) return 0;
  const month = value.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i)?.[1]?.slice(0, 3).toLowerCase();
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return matchedYear * 100 + Math.max(0, months.indexOf(month ?? "") + 1);
}

function latestYear(start: string, end: string) {
  return chronology(end) || chronology(start);
}

export function detectCareerRegions(profile: CanonicalProfile) {
  const evidence = [
    profile.location,
    profile.summary,
    ...profile.experience.flatMap((item) => [item.employer, item.title, ...item.achievements]),
    ...profile.projects.flatMap((item) => [item.name, item.description]),
    ...profile.awards.flatMap((item) => [item.title, item.issuer, item.description]),
    ...profile.volunteerExperience.flatMap((item) => [item.role, item.organization, item.description]),
  ].filter(Boolean).join(" ");

  const matches = regionMatchers.filter((region) => region.pattern.test(evidence)).map(({ id, label }) => ({ id, label }));
  if (/\b(apac|asia pacific)\b/i.test(evidence)) {
    for (const region of regionMatchers.filter((item) => ["south-asia", "east-asia", "southeast-asia", "oceania"].includes(item.id))) {
      if (!matches.some((item) => item.id === region.id)) matches.push({ id: region.id, label: region.label });
    }
  }
  if (/\bemea\b/i.test(evidence)) {
    for (const region of regionMatchers.filter((item) => ["europe", "middle-east", "africa"].includes(item.id))) {
      if (!matches.some((item) => item.id === region.id)) matches.push({ id: region.id, label: region.label });
    }
  }
  return matches;
}

export function buildCareerMilestones(profile: CanonicalProfile): CareerMilestone[] {
  const items: CareerMilestone[] = [
    // The overview is a career story, not a verbatim achievement ledger. Keep
    // one compact milestone per role, then layer in independently dated study,
    // credentials and recognition. Role bullets remain available in the profile.
    ...profile.experience.map((item) => ({ id: `role-${item.id}`, kind: "role" as const, label: item.title, detail: item.employer, date: [item.startDate, item.endDate].filter(Boolean).join(" – "), sortYear: latestYear(item.startDate, item.endDate), sortRank: 2 })),
    ...profile.education.map((item) => ({ id: `education-${item.id}`, kind: "education" as const, label: item.qualification, detail: item.institution, date: [item.startDate, item.endDate].filter(Boolean).join(" – "), sortYear: latestYear(item.startDate, item.endDate), sortRank: 0 })),
    ...profile.certifications.map((item) => ({ id: `credential-${item.id}`, kind: "credential" as const, label: item.name, detail: item.issuer, date: item.date, sortYear: chronology(item.date), sortRank: 1 })),
    ...profile.awards.map((item) => ({ id: `recognition-${item.id}`, kind: "recognition" as const, label: item.title, detail: item.issuer, date: item.date, sortYear: chronology(item.date), sortRank: 3 })),
  ];
  // A professional portrait leads with the current chapter. The reader can then
  // trace the path backwards through prior roles, study and recognition. Undated
  // entries stay visible at the end rather than being incorrectly placed.
  return items.sort((a, b) => (b.sortYear || -1) - (a.sortYear || -1) || b.sortRank - a.sortRank);
}

export function industryTheme(industry: string) {
  if (/tech|software|saas|cloud|data|digital|telecom/i.test(industry)) return "technology";
  if (/bank|financ|insurance|investment|account/i.test(industry)) return "finance";
  if (/health|medical|pharma|biotech/i.test(industry)) return "healthcare";
  if (/media|design|creative|advert|marketing|fashion/i.test(industry)) return "creative";
  if (/manufact|logistic|supply|industrial|construction|energy/i.test(industry)) return "industry";
  return "professional";
}

export function roleSignature(role: string) {
  if (/\b(?:chief executive|ceo)\b/i.test(role)) return "Executive leadership";
  if (/\b(?:chief operating|coo)\b/i.test(role)) return "Operating leadership";
  if (/\b(?:chief financial|cfo)\b/i.test(role)) return "Financial leadership";
  if (/\b(?:chief technology|cto)\b/i.test(role)) return "Technology leadership";
  if (/\b(?:chief marketing|cmo)\b/i.test(role)) return "Market leadership";
  if (/\b(?:chief people|chief human|chro)\b/i.test(role)) return "People leadership";
  if (/\b(?:vice president|vp|director|head of)\b/i.test(role)) return "Strategic leadership";
  if (/\b(?:manager|lead)\b/i.test(role)) return "Team leadership";
  return "Professional focus";
}
