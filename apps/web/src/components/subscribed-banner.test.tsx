import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SubscribedBanner } from "./subscribed-banner";

afterEach(cleanup);

describe("SubscribedBanner", () => {
  it("says Premium is active and shows the renewal date", () => {
    render(<SubscribedBanner activeUntil="2026-11-27T00:00:00.000Z" />);
    expect(screen.getByText("Premium is active")).toBeTruthy();
    expect(screen.getByText(/27 November 2026/)).toBeTruthy();
  });
  it("still works when no date is known", () => {
    render(<SubscribedBanner activeUntil={null} />);
    expect(screen.getByText(/Your plan is now active/)).toBeTruthy();
  });
  it("links to the billing page", () => {
    render(<SubscribedBanner activeUntil={null} />);
    expect(screen.getByRole("link", { name: "View billing" }).getAttribute("href")).toBe("/billing");
  });
});
