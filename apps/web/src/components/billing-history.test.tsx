import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { BillingHistory } from "./billing-history";

afterEach(() => cleanup());

const sub = { id: "s1", type: "subscription" as const, name: "SuccessPro premium monthly", state: "active", amount: 49900, currency: "INR", createdAt: "2026-10-01T00:00:00.000Z", paidThrough: "2026-11-01T00:00:00.000Z", renewalEnabled: true as boolean | null };

describe("billing history", () => {
  it("shows the amount and a Cancel button for an active renewing subscription", () => {
    render(<BillingHistory records={[sub]} />);
    expect(screen.getByText(/499/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel renewal" })).toBeTruthy();
  });

  it("shows the paid-through date in India time, matching Razorpay", () => {
    render(<BillingHistory records={[{ ...sub, paidThrough: "2026-11-27T18:30:00.000Z" }]} />);
    expect(screen.getByText(/Access through 28 November 2026/)).toBeTruthy();
  });

  it("shows the cancelled message and no button once renewal is cancelled", () => {
    render(<BillingHistory records={[{ ...sub, renewalEnabled: false, cancelAtCycleEnd: true }]} />);
    expect(screen.getByText(/Renewal cancelled\. Premium until/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel renewal" })).toBeNull();
  });

  it("offers no Cancel button for writing orders or unconfirmed subscriptions", () => {
    render(<BillingHistory records={[{ ...sub, id: "w1", type: "writing", renewalEnabled: null }, { ...sub, id: "s2", state: "created" }]} />);
    expect(screen.queryByRole("button", { name: "Cancel renewal" })).toBeNull();
  });
});
