import { resolveBillingConfig } from "./billing-config";
import type { BillingEnv } from "./billing-config";

// Admin console summary. Reports whether each credential is present, never its value.
export function adminPaymentSummary(env: BillingEnv = process.env) {
  const config = resolveBillingConfig(env);
  let mode: string;
  if (!config.enabled) {
    const reasons: Record<typeof config.reason, string> = {
      "not-enabled": "Not configured",
      "invalid-mode": "Off: mode must be test or live",
      "missing-credentials": "Off: credentials missing",
      "key-mode-mismatch": "Off: key does not match mode",
    };
    mode = reasons[config.reason];
  } else {
    const label = config.mode === "live" ? "Live" : "Test";
    const subscriptions = config.subscriptions.enabled ? "subscriptions on" : config.subscriptions.reason === "invalid-plan-ids" ? "plan IDs invalid" : "subscriptions off";
    mode = `${label}, ${subscriptions}`;
  }
  return {
    mode,
    keyIdConfigured: Boolean(env.RAZORPAY_KEY_ID?.trim()),
    keySecretConfigured: Boolean(env.RAZORPAY_KEY_SECRET?.trim()),
    webhookSecretConfigured: Boolean(env.RAZORPAY_WEBHOOK_SECRET?.trim()),
    enabled: config.enabled,
  };
}
