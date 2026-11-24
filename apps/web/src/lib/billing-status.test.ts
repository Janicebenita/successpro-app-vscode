import { describe, expect, it } from "vitest";
import { adminPaymentSummary } from "./billing-status";

const plans = JSON.stringify({ INR: { "premium-monthly": "plan_M1", "premium-quarterly": "plan_Q1", "premium-annual": "plan_A1" } });
const test = { RAZORPAY_ENABLED: "true", RAZORPAY_MODE: "test", RAZORPAY_KEY_ID: "rzp_test_abc123", RAZORPAY_KEY_SECRET: "SECRETVALUE" };

describe("admin payment summary", () => {
  it("reports not configured with nothing set", () => {
    expect(adminPaymentSummary({})).toEqual({ mode: "Not configured", keyIdConfigured: false, keySecretConfigured: false, webhookSecretConfigured: false, enabled: false });
  });

  it("explains an invalid mode and missing credentials", () => {
    expect(adminPaymentSummary({ ...test, RAZORPAY_MODE: "sandbox" })).toMatchObject({ mode: "Off: mode must be test or live", enabled: false });
    expect(adminPaymentSummary({ ...test, RAZORPAY_KEY_SECRET: "" })).toMatchObject({ mode: "Off: credentials missing", keySecretConfigured: false, enabled: false });
  });

  it("does not look healthy when the key does not match the mode", () => {
    expect(adminPaymentSummary({ ...test, RAZORPAY_KEY_ID: "rzp_live_abc123" })).toMatchObject({ mode: "Off: key does not match mode", keyIdConfigured: true, enabled: false });
  });

  it("describes subscription readiness", () => {
    expect(adminPaymentSummary(test)).toMatchObject({ mode: "Test, subscriptions off", enabled: true });
    expect(adminPaymentSummary({ ...test, RAZORPAY_SUBSCRIPTIONS_ENABLED: "true", RAZORPAY_PLAN_IDS_JSON: plans })).toMatchObject({ mode: "Test, subscriptions on", enabled: true });
    expect(adminPaymentSummary({ ...test, RAZORPAY_SUBSCRIPTIONS_ENABLED: "true", RAZORPAY_PLAN_IDS_JSON: "not json" })).toMatchObject({ mode: "Test, plan IDs invalid", enabled: true });
    expect(adminPaymentSummary({ ...test, RAZORPAY_MODE: "live", RAZORPAY_KEY_ID: "rzp_live_abc123", RAZORPAY_SUBSCRIPTIONS_ENABLED: "true", RAZORPAY_PLAN_IDS_JSON: plans })).toMatchObject({ mode: "Live, subscriptions on" });
  });

  it("reports the webhook secret only as present or missing", () => {
    expect(adminPaymentSummary({ ...test, RAZORPAY_WEBHOOK_SECRET: "whsec" }).webhookSecretConfigured).toBe(true);
    expect(adminPaymentSummary({ ...test, RAZORPAY_WEBHOOK_SECRET: "  " }).webhookSecretConfigured).toBe(false);
  });

  it("never exposes credential values and keeps mode within the 40 character limit", () => {
    const cases = [{}, test, { ...test, RAZORPAY_MODE: "x" }, { ...test, RAZORPAY_KEY_SECRET: "" }, { ...test, RAZORPAY_KEY_ID: "rzp_live_abc123" }, { ...test, RAZORPAY_SUBSCRIPTIONS_ENABLED: "true", RAZORPAY_PLAN_IDS_JSON: "x" }];
    for (const env of cases) {
      const summary = adminPaymentSummary({ ...env, RAZORPAY_WEBHOOK_SECRET: "WHSECRETVALUE" });
      expect(summary.mode.length).toBeLessThanOrEqual(40);
      const text = JSON.stringify(summary);
      expect(text).not.toContain("SECRETVALUE");
      expect(text).not.toContain("rzp_");
    }
  });
});
