// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { uid: "user1" } as Record<string, unknown> | null,
  access: { planId: "free", testAccess: false, activeUntil: null } as Record<string, unknown> | "throw",
}));

vi.mock("@/lib/session", () => ({ getSessionUser: async () => state.user }));
vi.mock("@/lib/feature-entitlements", () => ({
  resolveUserEntitlements: async () => {
    if (state.access === "throw") throw new Error("down");
    return state.access;
  },
}));

import { GET } from "./route";

beforeEach(() => {
  state.user = { uid: "user1" };
  state.access = { planId: "free", testAccess: false, activeUntil: null };
});

describe("subscription status", () => {
  it("rejects signed-out visitors", async () => {
    state.user = null;
    expect((await GET()).status).toBe(401);
  });
  it("reports a paid plan as active", async () => {
    state.access = { planId: "premium-monthly", testAccess: false, activeUntil: "2026-11-27T00:00:00.000Z" };
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ active: true, planId: "premium-monthly", activeUntil: "2026-11-27T00:00:00.000Z" });
  });
  it("reports the free plan as not active", async () => {
    expect(await (await GET()).json()).toEqual({ active: false, planId: "free", activeUntil: null });
  });
  it("does not count test-email access as paid", async () => {
    state.access = { planId: "premium-monthly", testAccess: true, activeUntil: null };
    expect((await (await GET()).json()).active).toBe(false);
  });
  it("answers 503 when the lookup fails", async () => {
    state.access = "throw";
    expect((await GET()).status).toBe(503);
  });
});
