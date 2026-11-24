export type PlanId = "free" | "premium-monthly" | "premium-quarterly" | "premium-annual";

export type Entitlements = {
  atsReviewsPerMonth: number;
  detailedAnalysesPerMonth: number;
  resumeBuilder: boolean;
  coverLetterBuilder: boolean;
  linkedInMakeover: boolean;
  jobSearch: boolean;
  jobAlerts: boolean;
  salaryAnalysesPerMonth: number;
  contactInitiationsPerMonth: number;
  rewriteCreditsPerMonth: number;
};

export const PLAN_ENTITLEMENTS: Record<PlanId, Readonly<Entitlements>> = {
  free: { atsReviewsPerMonth: 3, detailedAnalysesPerMonth: 0, resumeBuilder: false, coverLetterBuilder: false, linkedInMakeover: false, jobSearch: true, jobAlerts: false, salaryAnalysesPerMonth: 0, contactInitiationsPerMonth: 3, rewriteCreditsPerMonth: 0 },
  "premium-monthly": { atsReviewsPerMonth: 30, detailedAnalysesPerMonth: 10, resumeBuilder: true, coverLetterBuilder: true, linkedInMakeover: true, jobSearch: true, jobAlerts: true, salaryAnalysesPerMonth: 5, contactInitiationsPerMonth: 30, rewriteCreditsPerMonth: 50 },
  "premium-quarterly": { atsReviewsPerMonth: 30, detailedAnalysesPerMonth: 10, resumeBuilder: true, coverLetterBuilder: true, linkedInMakeover: true, jobSearch: true, jobAlerts: true, salaryAnalysesPerMonth: 5, contactInitiationsPerMonth: 30, rewriteCreditsPerMonth: 50 },
  "premium-annual": { atsReviewsPerMonth: 30, detailedAnalysesPerMonth: 10, resumeBuilder: true, coverLetterBuilder: true, linkedInMakeover: true, jobSearch: true, jobAlerts: true, salaryAnalysesPerMonth: 5, contactInitiationsPerMonth: 30, rewriteCreditsPerMonth: 50 },
};

export function entitlementsFor(plan: PlanId): Readonly<Entitlements> {
  return PLAN_ENTITLEMENTS[plan];
}
