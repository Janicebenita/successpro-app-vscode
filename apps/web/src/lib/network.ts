export type NetworkProfile = { id: string; ownerId: string; fullName: string; headline: string; currentRole: string; employer: string; industry: string; location: string; skills: string[]; published: boolean };

export function normalizedNetworkText(value: unknown) { return String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }

export function networkSearchMatches(profile: NetworkProfile, query: string) {
  const terms = normalizedNetworkText(query).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalizedNetworkText([profile.fullName, profile.headline, profile.currentRole, profile.employer, profile.industry, profile.location].join(" "));
  return terms.every((term) => haystack.includes(term));
}

export function networkSuggestion(profile: NetworkProfile, viewer: { currentRole?: string; industry?: string; location?: string; skills?: string[] }) {
  const reasons: string[] = []; let score = 0;
  if (profile.industry && normalizedNetworkText(profile.industry) === normalizedNetworkText(viewer.industry)) { score += 4; reasons.push(`Both work in ${profile.industry}`); }
  if (profile.location && normalizedNetworkText(profile.location) === normalizedNetworkText(viewer.location)) { score += 3; reasons.push(`Both list ${profile.location}`); }
  const sharedSkills = profile.skills.filter((skill) => (viewer.skills ?? []).some((candidate) => normalizedNetworkText(candidate) === normalizedNetworkText(skill))).slice(0, 3);
  if (sharedSkills.length) { score += sharedSkills.length * 2; reasons.push(`Shared skills: ${sharedSkills.join(", ")}`); }
  if (profile.currentRole && viewer.currentRole && normalizedNetworkText(profile.currentRole).includes(normalizedNetworkText(viewer.currentRole))) { score += 2; reasons.push("Similar current roles"); }
  return { score, reason: reasons[0] ?? "Explore this member's public professional profile" };
}
