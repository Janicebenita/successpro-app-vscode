import type { EvidencePayload, ParameterId } from "./types";

export interface ValidationIssue {
  parameterId: ParameterId;
  field: string;
  message: string;
}

/**
 * Rule 11: Every assessed rating needs source evidence and a short explanation.
 * For confirmed absence, record where/what was searched.
 */
export function validateParameterEvidence(
  parameterId: ParameterId,
  rating: number | null | undefined,
  evidence?: EvidencePayload
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (rating === null || rating === undefined) {
    return issues; // N/A or Pending does not require assessed excerpt
  }

  if (!evidence) {
    issues.push({
      parameterId,
      field: "evidence",
      message: `Parameter ${parameterId} has rating ${rating} but missing evidence payload.`,
    });
    return issues;
  }

  // Every assessed rating requires an excerpt or a documented absence search.
  const documentedAbsence = rating === 0 && evidence.absenceSearch?.outcome === "not_found"
    && !!evidence.absenceSearch.scope.trim() && !!evidence.absenceSearch.searchedFor.trim() && !!evidence.location?.trim();
  if ((!evidence.excerpt || !evidence.excerpt.trim()) && !documentedAbsence) {
    issues.push({
      parameterId,
      field: "evidence.excerpt",
      message: `Parameter ${parameterId} received rating ${rating} but has empty evidence excerpt or search note.`,
    });
  }

  if (!evidence.rationale || !evidence.rationale.trim()) {
    issues.push({
      parameterId,
      field: "evidence.rationale",
      message: `Parameter ${parameterId} is missing an evidence rationale explanation.`,
    });
  }

  return issues;
}

/**
 * Legacy workbook template-format check, retained for API compatibility only.
 * Phase4A candidate rewrites instead use validateGroundedRewrite and reject placeholders.
 */
export function validateRewriteTemplate(template: string): boolean {
  if (!template || !template.trim()) return false;
  // Checks if template contains balanced brackets [ ... ]
  return /\[.+?\]/.test(template);
}
