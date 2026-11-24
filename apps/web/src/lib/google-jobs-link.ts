export function googleJobsSearchUrl(input: { role: string; location: string; experienceYears?: number | null; keywords?: string[] }) {
  const role = input.role.trim().slice(0, 120);
  const location = input.location.trim().slice(0, 160);
  const keywords = (input.keywords ?? []).map((value) => value.trim()).filter(Boolean).slice(0, 8).join(" ");
  const experience = input.experienceYears === null || input.experienceYears === undefined ? "" : `${Math.max(0, Math.min(60, Math.round(input.experienceYears)))} years experience`;
  const query = ["job opportunities", location && `in ${location}`, role && `for ${role}`, experience, keywords].filter(Boolean).join(" ");
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("udm", "jobs");
  url.searchParams.set("num", "10");
  return url.toString();
}
