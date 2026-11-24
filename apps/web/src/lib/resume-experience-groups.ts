import type { CanonicalProfile } from "@successpro/contracts";

type Role = CanonicalProfile["experience"][number];
export type ResumeExperienceGroup = { kind: "role"; role: Role } | { kind: "earlier-roles"; employer: string; roles: Role[] };

export function groupResumeExperience(roles: Role[]): ResumeExperienceGroup[] {
  const groups: ResumeExperienceGroup[] = [];
  for (let index = 0; index < roles.length;) {
    const first = roles[index];
    const undated = !first.startDate.trim() && !first.endDate.trim() && !first.achievements.length;
    if (!undated) { groups.push({ kind: "role", role: first }); index += 1; continue; }
    let end = index + 1;
    while (end < roles.length && roles[end].employer.trim().toLowerCase() === first.employer.trim().toLowerCase()
      && !roles[end].startDate.trim() && !roles[end].endDate.trim() && !roles[end].achievements.length) end += 1;
    if (end - index >= 2) groups.push({ kind: "earlier-roles", employer: first.employer, roles: roles.slice(index, end) });
    else groups.push({ kind: "role", role: first });
    index = end;
  }
  return groups;
}
