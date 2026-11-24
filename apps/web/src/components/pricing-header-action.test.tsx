import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({ user: null as Record<string, unknown> | null | "throw" }));
vi.mock("@/lib/session", () => ({
  getSessionUser: async () => {
    if (state.user === "throw") throw new Error("down");
    return state.user;
  },
}));
import { PricingHeaderAction } from "./pricing-header-action";

afterEach(cleanup);
beforeEach(() => { state.user = null; });

describe("PricingHeaderAction", () => {
  it("offers Sign in to signed-out visitors", async () => {
    render(await PricingHeaderAction());
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
  });
  it("offers Dashboard to signed-in visitors", async () => {
    state.user = { uid: "u1" };
    render(await PricingHeaderAction());
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });
  it("falls back to Sign in when the session check fails", async () => {
    state.user = "throw";
    render(await PricingHeaderAction());
    expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
  });
});
