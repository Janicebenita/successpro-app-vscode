import type { CanonicalProfile } from "@successpro/contracts";

function yearFromDate(value: string, currentYear: number): number | null {
  const full = value.match(/\b(?:19|20)\d{2}\b/);
  if (full) return Number(full[0]);
  const short = value.match(/[’'\-/ ](\d{2})\b/);
  if (!short) return null;
  const number = Number(short[1]);
  const year = 2000 + number;
  return year <= currentYear ? year : 1900 + number;
}

/** Approximate tenure from the profile's dated roles; overlapping roles count once. */
export function experienceYearsFromProfile(profile: Pick<CanonicalProfile, "experience"> | null | undefined, today = new Date()): number {
  if (!profile) return 0;
  const currentYear = today.getFullYear();
  const spans = profile.experience.flatMap((role) => {
    const start = yearFromDate(role.startDate, currentYear);
    const end = /\b(?:present|current|ongoing|now)\b/i.test(role.endDate) ? currentYear : yearFromDate(role.endDate, currentYear);
    return start !== null && end !== null && start <= end && end <= currentYear ? [{ start, end }] : [];
  }).sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return Math.min(60, merged.reduce((total, span) => total + span.end - span.start, 0));
}
