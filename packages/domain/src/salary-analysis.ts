import type { SalaryResearch } from "@successpro/contracts";

export type SalaryAnalysis = {
  available: boolean;
  range: { low: number; midpoint: number; high: number } | null;
  confidence: "not available" | "low" | "medium" | "high";
  explanation: string;
  currentGap: number | null;
  targetPosition: "below range" | "within range" | "above range" | null;
  drivers: string[];
  nextChecks: string[];
};

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
}

export function analyseSalaryResearch(input: SalaryResearch, asOf = new Date()): SalaryAnalysis {
  const seenDomains = new Set<string>();
  const valid = input.sources.filter((source) => {
    const published = new Date(`${source.publishedOn}T00:00:00Z`);
    if (Number.isNaN(published.valueOf()) || published > asOf || source.low > source.midpoint || source.midpoint > source.high) return false;
    let domain: string;
    try {
      domain = new URL(source.url).hostname.toLowerCase().replace(/^www\./, "");
      if (domain === "vertexaisearch.cloud.google.com") domain = source.name.trim().toLowerCase().match(/^([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:\b|\/)/)?.[1] ?? domain;
    } catch { return false; }
    if (seenDomains.has(domain)) return false;
    seenDomains.add(domain);
    return true;
  });
  const drivers = [
    `${input.yearsExperience} years of relevant experience`,
    input.industry ? `Industry: ${input.industry}` : "Industry not yet specified",
    input.companySize === "unspecified" ? "Employer size not yet specified" : `Employer size: ${input.companySize}`,
    input.skills.length ? `Priority skills: ${input.skills.slice(0, 5).join(", ")}` : "Priority skills not yet specified",
    input.education ? `Education or credentials: ${input.education}` : "Education or credentials not yet specified",
  ];
  if (!valid.length) return { available: false, range: null, confidence: "not available", explanation: "We have not found a reliable market comparison yet. SuccessPro researches this for you; you do not need to supply sources or estimates.", currentGap: null, targetPosition: null, drivers, nextChecks: ["Check that your role and job location are up to date.", "Refresh the market search to try again."] };

  const range = { low: median(valid.map((source) => source.low)), midpoint: median(valid.map((source) => source.midpoint)), high: median(valid.map((source) => source.high)) };
  const dated = valid.filter((source) => source.dateBasis === "published" && source.low < source.high);
  const publishedWithin = (months: number) => dated.filter((source) => (asOf.valueOf() - new Date(`${source.publishedOn}T00:00:00Z`).valueOf()) / 2_629_746_000 <= months).length;
  const confidence = publishedWithin(18) >= 3 ? "high" : valid.length >= 3 || publishedWithin(24) >= 2 ? "medium" : "low";
  const target = input.targetCompensation;
  return {
    available: true,
    range,
    confidence,
    explanation: `This range is the median of ${valid.length} independent market source${valid.length === 1 ? "" : "s"}. ${dated.length < valid.length ? "Some publication dates could not be verified. " : ""}It is planning evidence, not a salary guarantee.`,
    currentGap: input.currentCompensation === null ? null : range.midpoint - input.currentCompensation,
    targetPosition: target === null ? null : target < range.low ? "below range" : target > range.high ? "above range" : "within range",
    drivers,
    nextChecks: ["Compare responsibilities and seniority across the sources.", "Check whether bonuses, equity, benefits, and statutory contributions are included.", "Revisit the evidence when a source is older than 12–18 months or the location changes."],
  };
}
