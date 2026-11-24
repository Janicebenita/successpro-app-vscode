import { normalizedEmailSet } from "./testing-exemptions";

export const billingPlanKeys = ["premium-monthly", "premium-quarterly", "premium-annual"] as const;
export type BillingPlanKey = (typeof billingPlanKeys)[number];
export type BillingMode = "test" | "live";
export type BillingEnv = Record<string, string | undefined>;

export type BillingConfig =
  | { enabled: false; reason: "not-enabled" | "invalid-mode" | "missing-credentials" | "key-mode-mismatch" }
  | {
      enabled: true;
      mode: BillingMode;
      keyId: string;
      keySecret: string;
      subscriptions:
        | { enabled: false; reason: "not-enabled" | "invalid-plan-ids" }
        | { enabled: true; planIds: Record<BillingPlanKey, string> };
    };

const planIdPattern = /^plan_[A-Za-z0-9]+$/;

// Launch scope (decision 3): INR plans only.
export function parseInrPlanIds(raw: string | undefined): Record<BillingPlanKey, string> | null {
  if (!raw) return null;
  try {
    const inr = (JSON.parse(raw) as { INR?: Record<string, unknown> } | null)?.INR;
    if (!inr || typeof inr !== "object") return null;
    const result = {} as Record<BillingPlanKey, string>;
    for (const key of billingPlanKeys) {
      const value = inr[key];
      if (typeof value !== "string" || !planIdPattern.test(value.trim())) return null;
      result[key] = value.trim();
    }
    return result;
  } catch {
    return null;
  }
}

// Fails closed: anything missing or inconsistent turns billing off.
export function resolveBillingConfig(env: BillingEnv = process.env): BillingConfig {
  if (env.RAZORPAY_ENABLED !== "true") return { enabled: false, reason: "not-enabled" };
  const mode = env.RAZORPAY_MODE;
  if (mode !== "test" && mode !== "live") return { enabled: false, reason: "invalid-mode" };
  const keyId = env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  if (!keyId || !keySecret) return { enabled: false, reason: "missing-credentials" };
  if (!keyId.startsWith(`rzp_${mode}_`)) return { enabled: false, reason: "key-mode-mismatch" };
  if (env.RAZORPAY_SUBSCRIPTIONS_ENABLED !== "true") return { enabled: true, mode, keyId, keySecret, subscriptions: { enabled: false, reason: "not-enabled" } };
  const planIds = parseInrPlanIds(env.RAZORPAY_PLAN_IDS_JSON);
  if (!planIds) return { enabled: true, mode, keyId, keySecret, subscriptions: { enabled: false, reason: "invalid-plan-ids" } };
  return { enabled: true, mode, keyId, keySecret, subscriptions: { enabled: true, planIds } };
}

// Test accounts get premium without paying. Verified email required, same rule as the resume-review exemption.
export function hasPremiumTestAccess(user: { email?: string; email_verified?: boolean }, env: BillingEnv = process.env) {
  const email = user.email?.trim().toLowerCase();
  return Boolean(email && user.email_verified === true && normalizedEmailSet(env.SUCCESSPRO_PREMIUM_TEST_EMAILS ?? "").has(email));
}

// True only when subscription checkout can really run.
export function subscriptionsOpen(env: BillingEnv = process.env) {
  const config = resolveBillingConfig(env);
  return config.enabled && config.subscriptions.enabled;
}
