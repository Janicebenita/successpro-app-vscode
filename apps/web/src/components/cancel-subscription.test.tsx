import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import { CancelSubscription } from "./cancel-subscription";

function respond(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

beforeEach(() => { refresh.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("CancelSubscription", () => {
  it("asks for confirmation first and calls nothing yet", () => {
    respond(200, { ok: true });
    render(<CancelSubscription id="sub1" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel renewal" }));
    expect(screen.getByRole("button", { name: "Yes, cancel renewal" })).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("goes back without calling the server when the user keeps the plan", () => {
    respond(200, { ok: true });
    render(<CancelSubscription id="sub1" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel renewal" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep my plan" }));
    expect(screen.getByRole("button", { name: "Cancel renewal" })).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cancels, shows the paid-until message and refreshes the page", async () => {
    respond(200, { ok: true, cancelAtCycleEnd: true, accessUntil: "2026-11-01T00:00:00.000Z" });
    render(<CancelSubscription id="sub1" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel renewal" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel renewal" }));
    expect(await screen.findByText(/Renewal cancelled\. Premium until/)).toBeTruthy();
    const init = (fetch as unknown as { mock: { calls: [string, { body: string }][] } }).mock.calls[0];
    expect(init[0]).toBe("/api/payments/subscription/cancel");
    expect(JSON.parse(init[1].body)).toEqual({ internalSubscriptionId: "sub1" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows the server message and changes nothing on a failure", async () => {
    respond(502, { error: "We could not cancel right now. Nothing was changed. Please try again in a moment." });
    render(<CancelSubscription id="sub1" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel renewal" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel renewal" }));
    expect(await screen.findByText(/Nothing was changed/)).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel renewal" })).toBeTruthy();
  });
});
