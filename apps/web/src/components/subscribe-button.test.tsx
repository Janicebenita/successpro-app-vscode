import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SubscribeButton } from "./subscribe-button";

const open = vi.fn();
const razorpay = vi.fn();
const { assign } = vi.hoisted(() => ({ assign: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: assign, refresh: vi.fn() }) }));

function respond(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}
const click = () => fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));

beforeEach(() => {
  open.mockReset(); razorpay.mockReset(); assign.mockReset();
  razorpay.mockImplementation(function (this: unknown, options: Record<string, unknown>) { (razorpay as unknown as { last?: Record<string, unknown> }).last = options; return { open }; });
  (window as unknown as { Razorpay: unknown }).Razorpay = razorpay;
  Object.defineProperty(window, "location", { value: { assign }, writable: true });
});
afterEach(() => { cleanup(); delete (window as unknown as { Razorpay?: unknown }).Razorpay; vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("SubscribeButton", () => {
  it("sends signed-out visitors to login and returns them to pricing", async () => {
    respond(401, { error: "Sign in to choose a subscription." });
    render(<SubscribeButton planId="premium-monthly" label="Subscribe" planName="Premium Monthly" />);
    click();
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/login?returnTo=/pricing"));
    expect(open).not.toHaveBeenCalled();
  });

  it("shows the server message and opens no popup on an error", async () => {
    respond(409, { error: "Your current plan is still active." });
    render(<SubscribeButton planId="premium-monthly" label="Subscribe" planName="Premium Monthly" />);
    click();
    expect(await screen.findByText("Your current plan is still active.")).toBeTruthy();
    expect(open).not.toHaveBeenCalled();
  });

  it("opens Razorpay Checkout with the subscription id and key", async () => {
    respond(200, { keyId: "rzp_test_abc123", subscriptionId: "sub_NEW123" });
    render(<SubscribeButton planId="premium-annual" label="Subscribe" planName="Premium Annual" />);
    click();
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect((razorpay as unknown as { last: Record<string, unknown> }).last).toMatchObject({ key: "rzp_test_abc123", subscription_id: "sub_NEW123", description: "Premium Annual" });
    const body = JSON.parse((fetch as unknown as { mock: { calls: [string, { body: string }][] } }).mock.calls[0][1].body);
    expect(body).toEqual({ planId: "premium-annual", currency: "INR" });
  });

  it("says no payment was recorded when the popup is closed", async () => {
    respond(200, { keyId: "rzp_test_abc123", subscriptionId: "sub_NEW123" });
    render(<SubscribeButton planId="premium-monthly" label="Subscribe" planName="Premium Monthly" />);
    click();
    await waitFor(() => expect(open).toHaveBeenCalled());
    const options = (razorpay as unknown as { last: { modal: { ondismiss: () => void } } }).last;
    options.modal.ondismiss();
    expect(await screen.findByText("Checkout closed. No completed payment was recorded.")).toBeTruthy();
  });

  const flow = (active: boolean) => vi.fn(async (url: string) =>
    url.includes("/status")
      ? new Response(JSON.stringify({ active }), { status: 200 })
      : new Response(JSON.stringify({ keyId: "rzp_test_abc123", subscriptionId: "sub_NEW123" }), { status: 200 }));
  const paidHandler = () => (razorpay as unknown as { last: { handler: () => void; modal: { ondismiss: () => void } } }).last;

  it("goes to the dashboard once the server reports Premium is active", async () => {
    vi.stubGlobal("fetch", flow(true));
    render(<SubscribeButton planId="premium-monthly" label="Subscribe" planName="Premium Monthly" />);
    click();
    await waitFor(() => expect(open).toHaveBeenCalled());
    paidHandler().handler();
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/dashboard?subscribed=1"));
  });

  it("stops waiting after 30 seconds and tells the user they will not be charged twice", async () => {
    vi.stubGlobal("fetch", flow(false));
    render(<SubscribeButton planId="premium-monthly" label="Subscribe" planName="Premium Monthly" />);
    click();
    await waitFor(() => expect(open).toHaveBeenCalled());
    vi.useFakeTimers();
    paidHandler().handler();
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(screen.getByText(/still confirming your payment/i)).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not replace the confirming message when the popup reports it was closed after payment", async () => {
    vi.stubGlobal("fetch", flow(false));
    render(<SubscribeButton planId="premium-monthly" label="Subscribe" planName="Premium Monthly" />);
    click();
    await waitFor(() => expect(open).toHaveBeenCalled());
    paidHandler().handler();
    expect(await screen.findByText("Confirming your payment…")).toBeTruthy();
    paidHandler().modal.ondismiss();
    expect(screen.queryByText("Checkout closed. No completed payment was recorded.")).toBeNull();
  });

  it("shows a safe message when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    render(<SubscribeButton planId="premium-monthly" label="Subscribe" planName="Premium Monthly" />);
    click();
    expect(await screen.findByText("Checkout could not start. No charge was made.")).toBeTruthy();
  });
});
