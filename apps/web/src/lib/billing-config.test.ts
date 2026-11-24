import { describe, expect, it } from "vitest";
import { hasPremiumTestAccess, parseInrPlanIds, resolveBillingConfig } from "./billing-config";

const plans = JSON.stringify({ INR: { "premium-monthly": "plan_M1", "premium-quarterly": "plan_Q1", "premium-annual": "plan_A1" } });
const base = { RAZORPAY_ENABLED: "true", RAZORPAY_MODE: "test", RAZORPAY_KEY_ID: "rzp_test_abc123", RAZORPAY_KEY_SECRET: "secret" };

describe("billing config", () => {
  it("is off when nothing is set or the flag is not exactly true", () => {
    expect(resolveBillingConfig({})).toEqual({ enabled: false, reason: "not-enabled" });
    expect(resolveBillingConfig({ ...base, RAZORPAY_ENABLED: "TRUE" })).toEqual({ enabled: false, reason: "not-enabled" });
  });

  it("is off for a missing or invalid mode", () => {
    expect(resolveBillingConfig({ ...base, RAZORPAY_MODE: undefined })).toEqual({ enabled: false, reason: "invalid-mode" });
    expect(resolveBillingConfig({ ...base, RAZORPAY_MODE: "sandbox" })).toEqual({ enabled: false, reason: "invalid-mode" });
  });

  it("is off when credentials are missing", () => {
    expect(resolveBillingConfig({ ...base, RAZORPAY_KEY_SECRET: " " })).toEqual({ enabled: false, reason: "missing-credentials" });
    expect(resolveBillingConfig({ ...base, RAZORPAY_KEY_ID: undefined })).toEqual({ enabled: false, reason: "missing-credentials" });
  });

  it("is off when the key prefix does not match the mode", () => {
    expect(resolveBillingConfig({ ...base, RAZORPAY_KEY_ID: "rzp_live_abc123" })).toEqual({ enabled: false, reason: "key-mode-mismatch" });
    expect(resolveBillingConfig({ ...base, RAZORPAY_MODE: "live" })).toEqual({ enabled: false, reason: "key-mode-mismatch" });
  });

  it("enables billing but keeps subscriptions off until switched on", () => {
    const config = resolveBillingConfig(base);
    expect(config.enabled && config.mode).toBe("test");
    expect(config.enabled && config.subscriptions).toEqual({ enabled: false, reason: "not-enabled" });
  });

  it("keeps subscriptions off when plan ids are bad, without throwing", () => {
    const env = { ...base, RAZORPAY_SUBSCRIPTIONS_ENABLED: "true" };
    for (const raw of [undefined, "not json", "{}", JSON.stringify({ INR: { "premium-monthly": "plan_M1" } }), JSON.stringify({ INR: { "premium-monthly": "x", "premium-quarterly": "plan_Q1", "premium-annual": "plan_A1" } })]) {
      const config = resolveBillingConfig({ ...env, RAZORPAY_PLAN_IDS_JSON: raw });
      expect(config.enabled && config.subscriptions).toEqual({ enabled: false, reason: "invalid-plan-ids" });
    }
  });

  it("enables subscriptions with valid INR plan ids", () => {
    const config = resolveBillingConfig({ ...base, RAZORPAY_SUBSCRIPTIONS_ENABLED: "true", RAZORPAY_PLAN_IDS_JSON: plans });
    expect(config.enabled && config.subscriptions).toEqual({ enabled: true, planIds: { "premium-monthly": "plan_M1", "premium-quarterly": "plan_Q1", "premium-annual": "plan_A1" } });
  });

  it("parses plan ids safely", () => {
    expect(parseInrPlanIds(plans)?.["premium-annual"]).toBe("plan_A1");
    expect(parseInrPlanIds("{")).toBeNull();
  });
});

describe("premium test access", () => {
  const env = { SUCCESSPRO_PREMIUM_TEST_EMAILS: " Tester@Example.com , other@example.com " };
  it("matches verified listed emails regardless of case and spaces", () => {
    expect(hasPremiumTestAccess({ email: "tester@example.com", email_verified: true }, env)).toBe(true);
    expect(hasPremiumTestAccess({ email: " OTHER@example.com", email_verified: true }, env)).toBe(true);
  });
  it("rejects unverified, unlisted, missing or unset cases", () => {
    expect(hasPremiumTestAccess({ email: "tester@example.com", email_verified: false }, env)).toBe(false);
    expect(hasPremiumTestAccess({ email: "tester@example.com" }, env)).toBe(false);
    expect(hasPremiumTestAccess({ email: "nobody@example.com", email_verified: true }, env)).toBe(false);
    expect(hasPremiumTestAccess({ email_verified: true }, env)).toBe(false);
    expect(hasPremiumTestAccess({ email: "tester@example.com", email_verified: true }, {})).toBe(false);
  });
});
