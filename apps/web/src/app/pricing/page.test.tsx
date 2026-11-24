import { describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PricingPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/pricing-header-action", () => ({ PricingHeaderAction: () => null }));

describe("pricing page", () => {
  it("offers Subscribe on the three paid plans and Start free on Free", () => {
    render(<PricingPage />);
    expect(screen.getAllByRole("button", { name: "Subscribe" })).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Start free" })).toBeTruthy();
    expect(screen.queryByText(/Join waitlist/i)).toBeNull();
    expect(screen.queryByText(/not available to purchase yet/i)).toBeNull();
    expect(screen.getByText("Renews every month. Cancel anytime.")).toBeTruthy();
    expect(screen.getByText("Renews every 3 months. Cancel anytime.")).toBeTruthy();
    expect(screen.getByText("Renews every year. Cancel anytime.")).toBeTruthy();
    cleanup();
  });
});
