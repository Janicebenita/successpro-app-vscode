// @vitest-environment node
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Snap = { id: string; exists: boolean; ref: { collection: string; id: string }; data: () => Record<string, unknown> | undefined };
const state = vi.hoisted(() => ({
  sub: null as { id: string; data: Record<string, unknown> } | null,
  events: new Set<string>(),
  writes: [] as Array<{ op: string; collection: string; id: string; data: Record<string, unknown> }>,
}));

vi.mock("@/lib/notifications", () => ({ createNotification: async () => undefined, paymentNotification: () => ({}) }));
vi.mock("@/lib/product-telemetry", () => ({ recordProductEvent: async () => undefined }));
vi.mock("@/lib/firebase-admin", () => {
  const snap = (id: string, data?: Record<string, unknown>): Snap => ({ id, exists: Boolean(data), ref: { collection: "subscriptions", id }, data: () => data });
  return {
    adminDb: {
      collection: (collection: string) => ({
        where: (_field: string, _op: string, value: unknown) => ({
          limit: () => ({
            get: async () => (collection === "subscriptions" && state.sub && state.sub.data.providerSubscriptionId === value ? { empty: false, docs: [snap(state.sub.id, state.sub.data)] } : { empty: true, docs: [] }),
          }),
        }),
        doc: (id: string) => ({ collection, id, get: async () => (collection === "subscriptions" && state.sub?.id === id ? snap(id, state.sub.data) : snap(id)) }),
      }),
      runTransaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          get: async (ref: { collection: string; id: string }) =>
            ref.collection === "webhook_events" ? { exists: state.events.has(ref.id), data: () => ({}) } : state.sub?.id === ref.id ? snap(ref.id, state.sub.data) : snap(ref.id),
          create: (ref: { collection: string; id: string }, data: Record<string, unknown>) => state.writes.push({ op: "create", collection: ref.collection, id: ref.id, data }),
          set: (ref: { collection: string; id: string }, data: Record<string, unknown>) => state.writes.push({ op: "set", collection: ref.collection, id: ref.id, data }),
        }),
    },
  };
});

import { POST } from "./route";

const SECRET = "test-webhook-secret";
const body = (createdAt: number, notes: unknown = []) =>
  JSON.stringify({ event: "subscription.charged", created_at: createdAt, payload: { subscription: { entity: { id: "sub_ABC123", status: "active", current_end: 1_900_000_000, notes } } } });
const call = (raw: string, opts: { sign?: boolean; eventId?: string } = {}) =>
  POST(new Request("http://localhost/api/payments/razorpay-webhook", {
    method: "POST",
    headers: { "x-razorpay-event-id": opts.eventId ?? "evt_1", "x-razorpay-signature": opts.sign === false ? "bad" : createHmac("sha256", SECRET).update(raw).digest("hex") },
    body: raw,
  }));
const subscriptionWrites = () => state.writes.filter((w) => w.collection === "subscriptions");

beforeEach(() => {
  process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
  state.sub = { id: "AbCdEfGhIjKl", data: { ownerId: "user1", planId: "premium-monthly", providerSubscriptionId: "sub_ABC123", state: "created" } };
  state.events = new Set();
  state.writes = [];
});

describe("razorpay webhook", () => {
  it("accepts a correctly signed event when the stored secret has a trailing newline", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = `${SECRET}\n`;
    expect((await call(body(1000))).status).toBe(200);
  });

  it("returns 500, not 401, when the webhook secret is not configured", async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expect((await call(body(1000))).status).toBe(500);
  });

  it("rejects a wrong signature and writes nothing", async () => {
    expect((await call(body(1000), { sign: false })).status).toBe(401);
    expect(state.writes).toEqual([]);
  });

  it("records a valid event and updates the matched subscription", async () => {
    const response = await call(body(1000));
    expect(response.status).toBe(200);
    expect(state.writes.find((w) => w.collection === "webhook_events")?.data).toMatchObject({ processingResult: "processed", matchedRecordType: "subscription" });
    expect(subscriptionWrites()[0]?.data).toMatchObject({ lastEventId: "evt_1", lastProviderCreatedAt: 1000 });
  });

  it("ignores a duplicate event id", async () => {
    state.events.add("evt_1");
    expect(await (await call(body(1000))).json()).toMatchObject({ ok: true, duplicate: true });
    expect(state.writes).toEqual([]);
  });

  it("does not let an older event overwrite newer subscription state", async () => {
    state.sub!.data.lastProviderCreatedAt = 2000;
    expect(await (await call(body(1000))).json()).toMatchObject({ ignoredAsStale: true });
    expect(subscriptionWrites()).toEqual([]);
    expect(state.writes.find((w) => w.collection === "webhook_events")?.data).toMatchObject({ processingResult: "ignored-stale" });
  });

  it("matches by our internal id when the provider id was never saved", async () => {
    state.sub!.data.providerSubscriptionId = null;
    await call(body(1000, { internal_subscription_id: "AbCdEfGhIjKl" }));
    expect(subscriptionWrites()[0]?.data).toMatchObject({ providerSubscriptionId: "sub_ABC123" });
  });

  it("stores an event with no matching subscription as unmatched", async () => {
    state.sub = null;
    expect((await call(body(1000))).status).toBe(200);
    expect(state.writes.find((w) => w.collection === "webhook_events")?.data).toMatchObject({ processingResult: "unmatched" });
    expect(subscriptionWrites()).toEqual([]);
  });
});
