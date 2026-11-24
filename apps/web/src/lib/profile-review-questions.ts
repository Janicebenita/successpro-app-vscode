import type { CanonicalProfile } from "@successpro/contracts";
import { statedCurrentRoleWithPastEnd } from "./career-date-status";

type Draft = Partial<CanonicalProfile>;
export type ProfileReviewQuestion = { id: string; prompt: string; field?: keyof CanonicalProfile; answerLabel: string; requiresEdit?: boolean };

const missingSections: Array<{ id: string; field: keyof CanonicalProfile; prompt: string; answerLabel: string }> = [
  { id: "missing-summary", field: "summary", prompt: "We could not find a professional summary. Add one below, or confirm that you want the writer to prepare it from your verified experience.", answerLabel: "Prepare my summary from the confirmed details" },
  { id: "missing-skills", field: "skills", prompt: "We could not identify a reliable skills list. Add the skills you want represented below, or confirm that none can be added yet.", answerLabel: "I have no other skills to add right now" },
  { id: "missing-experience", field: "experience", prompt: "We could not identify a work-experience record. Add your roles below, or confirm that you do not have work experience to add.", answerLabel: "I have no work experience to add" },
  { id: "missing-education", field: "education", prompt: "We could not identify an education record. Add your qualifications below, or confirm that you do not want to add one.", answerLabel: "I do not have an education record to add" },
];

function hasValue(value: unknown) {
  return Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim().length > 0;
}

export function profileReviewQuestions(profile: Draft, warnings: string[]): ProfileReviewQuestion[] {
  const questions: ProfileReviewQuestion[] = missingSections.filter(({ field }) => !hasValue(profile[field])).map(({ id, field, prompt, answerLabel }) => ({ id, field, prompt, answerLabel }));
  const endedCurrentRole = statedCurrentRoleWithPastEnd(profile);
  if (endedCurrentRole) questions.push({ id: "current-role-ended", field: "experience", prompt: `Your current role is shown as “${endedCurrentRole.title}”, but its end date is ${endedCurrentRole.endDate}. Update the role end date if you still hold it, or change your current role before continuing.`, answerLabel: "Update the role date or current position to continue", requiresEdit: true });
  const uniqueWarnings = [...new Set(warnings.map((value) => value.trim()).filter(Boolean))]
    .filter((warning) => !/\b(?:current(?:ly)?|present|most recent)\b/i.test(warning) || !/\b(?:role|position|job|employment)\b/i.test(warning) || !/\bend date\b/i.test(warning));
  for (const [index, warning] of uniqueWarnings.entries()) {
    questions.push({ id: `source-${index}`, prompt: warning, answerLabel: "I checked this against my original document and corrected the fields below where needed" });
  }
  return questions;
}

export function unansweredProfileQuestions(profile: Draft, warnings: string[], answers: string[]) {
  const acknowledged = new Set(answers);
  return profileReviewQuestions(profile, warnings).filter((question) => question.requiresEdit || !acknowledged.has(question.id));
}
