// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { uid: "user1", email: "a@example.com", email_verified: true } as Record<string, unknown> | null,
  consent: true,
  existing: [] as Array<{ id: string; data: Record<string, unknown> }>,
  created: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/session", () => ({ getSessionUser: async () => state.user }));
vi.mock("@/lib/firebase-admin", () => {
  const ts = (ms: number) => ({ toMillis: () => ms });
  return {
    adminDb: {
      collection: (name: string) => ({
        doc: (id = "newsub123456") => ({
          id,
          collection: name,
          get: async () => ({ data: () => ({ registrationConsentComplete: state.consent }) }),
          update: async (data: Record<string, unknown>) => { state.updates.push(data); },
        }),
        where: () => ({ limit: () => ({}) }),
      }),
      runTransaction: async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          get: async () => ({ docs: state.existing.map((e) => ({ id: e.id, data: () => e.data })) }),
          create: (_ref: unknown, data: Record<string, unknown>) => { state.created.push(data); },
        }),
    },
    __ts: ts,
  };
});

import { POST } from "./route";

const plans = JSON.stringify({ INR: { "premium-monthly": "plan_M1", "premium-quarterly": "plan_Q1", "premium-annual": "plan_A1" } });
const env = { RAZORPAY_ENABLED: "true", RAZORPAY_MODE: "test", RAZORPAY_KEY_ID: "rzp_test_abc123", RAZORPAY_KEY_SECRET: "s", RAZORPAY_SUBSCRIPTIONS_ENABLED: "true", RAZORPAY_PLAN_IDS_JSON: plans };
const saved: Record<string, string | undefined> = {};
const call = (body: unknown) => POST(new Request("http://localhost/api/payments/subscription", { method: "POST", body: JSON.stringify(body) }));
const ts = (ms: number) => ({ toMillis: () => ms });

beforeEach(() => {
  for (const k of Object.keys(env)) saved[k] = process.env[k];
  Object.assign(process.env, env);
  state.user = { uid: "user1", email: "a@example.com", email_verified: true };
  state.consent = true; state.existing = []; state.created = []; state.updates = [];
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "sub_NEW123", short_url: "https://rzp.io/i/x", status: "created" }), { status: 200 })));
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  vi.unstubAllGlobals();
});

describe("subscription checkout", () => {
  it("requires sign in", async () => {
    state.user = null;
    expect((await call({ planId: "premium-monthly" })).status).toBe(401);
  });

  it("rejects non-INR currencies before anything is saved", async () => {
    const response = await call({ planId: "premium-monthly", currency: "USD" });
    expect(response.status).toBe(409);
    expect(state.created).toEqual([]);
  });

  it("is closed when billing is not configured", async () => {
    delete process.env.RAZORPAY_ENABLED;
    expect((await call({ planId: "premium-monthly" })).status).toBe(503);
  });

  it("requires a verified email and completed consent", async () => {
    state.user = { uid: "user1", email: "a@example.com", email_verified: false };
    expect((await call({ planId: "premium-monthly" })).status).toBe(403);
    state.user = { uid: "user1", email: "a@example.com", email_verified: true };
    state.consent = false;
    expect((await call({ planId: "premium-monthly" })).status).toBe(403);
  });

  it("blocks a user who already has an active subscription", async () => {
    state.existing = [{ id: "old1", data: { state: "active", planId: "premium-monthly" } }];
    const response = await call({ planId: "premium-annual" });
    expect(response.status).toBe(409);
    expect(state.created).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocks a cancelled subscription that still has paid time left", async () => {
    state.existing = [{ id: "old1", data: { state: "cancelled", currentPeriodEnd: ts(Date.now() + 86_400_000) } }];
    expect((await call({ planId: "premium-monthly" })).status).toBe(409);
  });

  it("reuses a recent checkout for the same plan without calling Razorpay", async () => {
    state.existing = [{ id: "recent1", data: { state: "created", planId: "premium-monthly", providerSubscriptionId: "sub_OLD999", createdAt: ts(Date.now() - 60_000), checkoutUrl: null } }];
    const body = await (await call({ planId: "premium-monthly" })).json();
    expect(body).toMatchObject({ subscriptionId: "sub_OLD999", keyId: "rzp_test_abc123" });
    expect(fetch).not.toHaveBeenCalled();
    expect(state.created).toEqual([]);
  });

  it("saves a record first, then returns the Razorpay subscription id", async () => {
    const response = await call({ planId: "premium-monthly" });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ subscriptionId: "sub_NEW123", planId: "premium-monthly", currency: "INR" });
    expect(state.created[0]).toMatchObject({ ownerId: "user1", planId: "premium-monthly", providerPlanId: "plan_M1", state: "created" });
    expect(state.updates.at(-1)).toMatchObject({ providerSubscriptionId: "sub_NEW123" });
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("marks the record failed when Razorpay errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    const response = await call({ planId: "premium-monthly" });
    expect(response.status).toBe(502);
    expect(state.updates.at(-1)).toMatchObject({ state: "failed" });
  });
});
