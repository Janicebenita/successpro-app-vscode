import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  entitlement: undefined as Record<string, unknown> | undefined,
  user: { email: "tester@example.com", emailVerified: true } as { email?: string; emailVerified?: boolean } | null,
}));

vi.mock("./firebase-admin", () => ({
  adminDb: {
    collection: (name: string) => ({
      doc: () => ({ get: async () => (name === "entitlements" ? { exists: Boolean(state.entitlement), data: () => state.entitlement } : { exists: false, data: () => undefined }) }),
    }),
  },
  adminAuth: { getUser: async () => { if (!state.user) throw new Error("no such user"); return state.user; } },
}));

import { resolveUserEntitlements } from "./feature-entitlements";
import { subscriptionsOpen } from "./billing-config";

const day = 24 * 60 * 60 * 1000;
const until = (offsetMs: number) => ({ toDate: () => new Date(Date.now() + offsetMs) });
const original = process.env.SUCCESSPRO_PREMIUM_TEST_EMAILS;

afterEach(() => {
  if (original === undefined) delete process.env.SUCCESSPRO_PREMIUM_TEST_EMAILS; else process.env.SUCCESSPRO_PREMIUM_TEST_EMAILS = original;
  state.entitlement = undefined;
  state.user = { email: "tester@example.com", emailVerified: true };
});

describe("entitlements fail closed", () => {
  it("gives the free plan, with no preview unlock, when there is no paid record", async () => {
    delete process.env.SUCCESSPRO_PREMIUM_TEST_EMAILS;
    const access = await resolveUserEntitlements("user1");
    expect(access.planId).toBe("free");
    expect(access.testAccess).toBe(false);
    expect("preview" in access).toBe(false);
  });

  it("gives the paid plan while the paid-until date is in the future", async () => {
    state.entitlement = { planId: "premium-monthly", activeUntil: until(day) };
    const access = await resolveUserEntitlements("user1");
    expect(access.planId).toBe("premium-monthly");
    expect(access.testAccess).toBe(false);
    expect(access.activeUntil).not.toBeNull();
  });

  it("falls back to free once the paid-until date has passed", async () => {
    state.entitlement = { planId: "premium-annual", activeUntil: until(-day) };
    expect((await resolveUserEntitlements("user1")).planId).toBe("free");
  });

  it("gives premium to a verified email on the test allow-list", async () => {
    process.env.SUCCESSPRO_PREMIUM_TEST_EMAILS = "Tester@Example.com";
    const access = await resolveUserEntitlements("user1");
    expect(access.planId).toBe("premium-monthly");
    expect(access.testAccess).toBe(true);
  });

  it("stays free when the email is unverified, unlisted, unavailable or the list is unset", async () => {
    process.env.SUCCESSPRO_PREMIUM_TEST_EMAILS = "tester@example.com";
    state.user = { email: "tester@example.com", emailVerified: false };
    expect((await resolveUserEntitlements("user1")).planId).toBe("free");
    state.user = { email: "other@example.com", emailVerified: true };
    expect((await resolveUserEntitlements("user1")).planId).toBe("free");
    state.user = null;
    expect((await resolveUserEntitlements("user1")).planId).toBe("free");
    state.user = { email: "tester@example.com", emailVerified: true };
    delete process.env.SUCCESSPRO_PREMIUM_TEST_EMAILS;
    expect((await resolveUserEntitlements("user1")).planId).toBe("free");
  });
});

describe("subscriptionsOpen", () => {
  const base = { RAZORPAY_ENABLED: "true", RAZORPAY_MODE: "test", RAZORPAY_KEY_ID: "rzp_test_abc123", RAZORPAY_KEY_SECRET: "s" };
  const plans = JSON.stringify({ INR: { "premium-monthly": "plan_M1", "premium-quarterly": "plan_Q1", "premium-annual": "plan_A1" } });

  it("is closed unless billing, subscriptions and plan ids are all valid", () => {
    expect(subscriptionsOpen({})).toBe(false);
    expect(subscriptionsOpen(base)).toBe(false);
    expect(subscriptionsOpen({ ...base, RAZORPAY_SUBSCRIPTIONS_ENABLED: "true", RAZORPAY_PLAN_IDS_JSON: "bad" })).toBe(false);
  });

  it("is open when everything is valid", () => {
    expect(subscriptionsOpen({ ...base, RAZORPAY_SUBSCRIPTIONS_ENABLED: "true", RAZORPAY_PLAN_IDS_JSON: plans })).toBe(true);
  });
});
