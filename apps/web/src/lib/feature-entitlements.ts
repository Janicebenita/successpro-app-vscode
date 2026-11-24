import { PLAN_ENTITLEMENTS, type Entitlements, type PlanId } from "@successpro/domain";
import { adminAuth, adminDb } from "./firebase-admin";
import { hasPremiumTestAccess } from "./billing-config";

const planIds = new Set<PlanId>(["free", "premium-monthly", "premium-quarterly", "premium-annual"]);
export const entitlementFeatures = ["resumeReviews", "detailedReports", "resumeBuilder", "coverLetterBuilder", "linkedInMakeover", "jobSearch", "jobAlerts", "salaryAnalyses", "contacts", "rewriteCredits"] as const;
export type EntitlementFeature = typeof entitlementFeatures[number];

function validPlan(value: unknown): PlanId { return typeof value === "string" && planIds.has(value as PlanId) ? value as PlanId : "free"; }
function finiteLimit(value: unknown, fallback: number) { return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100_000 ? value : fallback; }
function booleanValue(value: unknown, fallback: boolean) { return typeof value === "boolean" ? value : fallback; }

export function normalizeEntitlements(value: unknown, fallback: Readonly<Entitlements>) {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    atsReviewsPerMonth: finiteLimit(record.atsReviewsPerMonth, fallback.atsReviewsPerMonth),
    detailedAnalysesPerMonth: finiteLimit(record.detailedAnalysesPerMonth, fallback.detailedAnalysesPerMonth),
    resumeBuilder: booleanValue(record.resumeBuilder, fallback.resumeBuilder),
    coverLetterBuilder: booleanValue(record.coverLetterBuilder, fallback.coverLetterBuilder),
    linkedInMakeover: booleanValue(record.linkedInMakeover, fallback.linkedInMakeover),
    jobSearch: booleanValue(record.jobSearch, fallback.jobSearch),
    jobAlerts: booleanValue(record.jobAlerts, fallback.jobAlerts),
    salaryAnalysesPerMonth: finiteLimit(record.salaryAnalysesPerMonth, fallback.salaryAnalysesPerMonth),
    contactInitiationsPerMonth: finiteLimit(record.contactInitiationsPerMonth, fallback.contactInitiationsPerMonth),
    rewriteCreditsPerMonth: finiteLimit(record.rewriteCreditsPerMonth, fallback.rewriteCreditsPerMonth),
  } satisfies Entitlements;
}

export function featureValue(entitlements: Entitlements, feature: EntitlementFeature) {
  const map = { resumeReviews: entitlements.atsReviewsPerMonth, detailedReports: entitlements.detailedAnalysesPerMonth, resumeBuilder: entitlements.resumeBuilder, coverLetterBuilder: entitlements.coverLetterBuilder, linkedInMakeover: entitlements.linkedInMakeover, jobSearch: entitlements.jobSearch, jobAlerts: entitlements.jobAlerts, salaryAnalyses: entitlements.salaryAnalysesPerMonth, contacts: entitlements.contactInitiationsPerMonth, rewriteCredits: entitlements.rewriteCreditsPerMonth } as const;
  return map[feature];
}

export function featureAvailable(access: { entitlements: Entitlements }, feature: EntitlementFeature) {
  const value = featureValue(access.entitlements, feature);
  return typeof value === "boolean" ? value : value > 0;
}

// Test accounts listed in SUCCESSPRO_PREMIUM_TEST_EMAILS (verified email only) get premium without paying. Any failure means no access.
async function hasTestAccess(ownerId: string) {
  if (!(process.env.SUCCESSPRO_PREMIUM_TEST_EMAILS ?? "").trim()) return false;
  try {
    const account = await adminAuth.getUser(ownerId);
    return hasPremiumTestAccess({ email: account.email, email_verified: account.emailVerified });
  } catch {
    return false;
  }
}

export async function resolveUserEntitlements(ownerId: string) {
  const [userRecord, configRecord] = await Promise.all([adminDb.collection("entitlements").doc(ownerId).get(), adminDb.collection("system_config").doc("entitlements-v1").get()]);
  const userData = userRecord.data();
  const activeUntil = userData?.activeUntil?.toDate?.() as Date | undefined;
  const requestedPlan = validPlan(userData?.planId);
  const paidPlan: PlanId = requestedPlan !== "free" && activeUntil && activeUntil > new Date() ? requestedPlan : "free";
  const testAccess = paidPlan === "free" && (await hasTestAccess(ownerId));
  const planId: PlanId = testAccess ? "premium-monthly" : paidPlan;
  const configured = configRecord.data()?.plans as Record<string, unknown> | undefined;
  const entitlements = normalizeEntitlements(configured?.[planId], PLAN_ENTITLEMENTS[planId]);
  return { planId, entitlements, testAccess, activeUntil: activeUntil?.toISOString() ?? null, source: userRecord.exists ? "account" as const : "default" as const };
}
