type CareerDraft = { currentRole?: string; experience?: Array<{ title: string; endDate: string }> };

function roleKey(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function isClearlyPastRoleEnd(value: string, today = new Date()) {
  const normalized = roleKey(value);
  if (!normalized || /\b(?:present|current|ongoing|now)\b/.test(normalized)) return false;
  const year = normalized.match(/\b(?:19|20)\d{2}\b/);
  if (!year) return false;
  const endYear = Number(year[0]);
  if (endYear !== today.getUTCFullYear()) return endYear < today.getUTCFullYear();
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = monthNames.findIndex((name) => new RegExp(`\\b${name}[a-z]*\\b`).test(normalized));
  return month >= 0 && month < today.getUTCMonth();
}

export function statedCurrentRoleWithPastEnd(profile: CareerDraft, today = new Date()) {
  const current = roleKey(profile.currentRole ?? "");
  if (!current) return undefined;
  return profile.experience?.find((role) => roleKey(role.title) === current && isClearlyPastRoleEnd(role.endDate, today));
}
