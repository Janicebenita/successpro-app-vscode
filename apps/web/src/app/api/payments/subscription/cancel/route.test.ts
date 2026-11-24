// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { uid: "user1" } as Record<string, unknown> | null,
  docs: [] as Array<{ id: string; data: Record<string, unknown> }>,
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/session", () => ({ getSessionUser: async () => state.user }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({
      where: () => ({
        limit: () => ({
          get: async () => ({
            docs: state.docs.map((d) => ({
              id: d.id,
              data: () => d.data,
              ref: { update: async (data: Record<string, unknown>) => { state.updates.push(data); } },
            })),
          }),
        }),
      }),
    }),
  },
}));

import { POST } from "./route";

const plans = JSON.stringify({ INR: { "premium-monthly": "plan_M1", "premium-quarterly": "plan_Q1", "premium-annual": "plan_A1" } });
const env = { RAZORPAY_ENABLED: "true", RAZORPAY_MODE: "test", RAZORPAY_KEY_ID: "rzp_test_abc123", RAZORPAY_KEY_SECRET: "s", RAZORPAY_SUBSCRIPTIONS_ENABLED: "true", RAZORPAY_PLAN_IDS_JSON: plans };
const saved: Record<string, string | undefined> = {};
const ts = (ms: number) => ({ toMillis: () => ms });
const call = (headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/payments/subscription/cancel", { method: "POST", headers: { host: "localhost", ...headers }, body: JSON.stringify({}) }));
const active = (extra: Record<string, unknown> = {}) => ({ id: "sub1", data: { state: "active", providerSubscriptionId: "sub_ABC123", currentPeriodEnd: ts(Date.now() + 86_400_000), createdAt: ts(1000), ...extra } });

beforeEach(() => {
  for (const k of Object.keys(env)) saved[k] = process.env[k];
  Object.assign(process.env, env);
  state.user = { uid: "user1" }; state.docs = [active()]; state.updates = [];
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  vi.unstubAllGlobals();
});

describe("cancel subscription", () => {
  it("rejects a cross-site request", async () => {
    expect((await call({ origin: "https://evil.example" })).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires sign in", async () => {
    state.user = null;
    expect((await call()).status).toBe(401);
  });

  it("returns 404 when there is nothing to cancel", async () => {
    state.docs = [{ id: "old", data: { state: "completed", createdAt: ts(1) } }];
    expect((await call()).status).toBe(404);
  });

  it("cancels an active subscription at cycle end and keeps its state", async () => {
    const response = await call();
    expect(await response.json()).toMatchObject({ ok: true, cancelAtCycleEnd: true });
    const [url, init] = (fetch as unknown as { mock: { calls: [string, { body: string }][] } }).mock.calls[0];
    expect(url).toContain("/subscriptions/sub_ABC123/cancel");
    expect(JSON.parse(init.body)).toEqual({ cancel_at_cycle_end: 1 });
    expect(state.updates[0]).toMatchObject({ cancelAtCycleEnd: true, renewalEnabled: false });
    expect(state.updates[0]).not.toHaveProperty("state");
  });

  it("cancels a non-active subscription immediately", async () => {
    state.docs = [active({ state: "authenticated" })];
    await call();
    const init = (fetch as unknown as { mock: { calls: [string, { body: string }][] } }).mock.calls[0][1];
    expect(JSON.parse(init.body)).toEqual({ cancel_at_cycle_end: 0 });
    expect(state.updates[0]).toMatchObject({ state: "cancelled", cancelAtCycleEnd: false });
  });

  it("is safe to press twice: no second Razorpay call", async () => {
    state.docs = [active({ cancelAtCycleEnd: true, renewalEnabled: false })];
    expect(await (await call()).json()).toMatchObject({ ok: true, alreadyCancelled: true });
    expect(fetch).not.toHaveBeenCalled();
    expect(state.updates).toEqual([]);
  });

  it("changes nothing when Razorpay refuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { description: "last cycle" } }), { status: 400 })));
    expect((await call()).status).toBe(502);
    expect(state.updates).toEqual([]);
  });
});
