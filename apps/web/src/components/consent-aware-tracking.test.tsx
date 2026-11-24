import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { isEligibleTrackingHost, safePagePath, TrackingChoices } from "./consent-aware-tracking";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
afterEach(() => { cleanup(); window.localStorage.clear(); vi.restoreAllMocks(); });

describe("consent-aware tracking", () => {
  it("never activates on revision URLs or localhost", () => {
    expect(isEligibleTrackingHost("successpro.xfactor.ltd")).toBe(true);
    expect(isEligibleTrackingHost("consent-qa---successpro-web-staging.a.run.app")).toBe(false);
    expect(isEligibleTrackingHost("localhost")).toBe(false);
  });

  it("uses a fixed page category instead of forwarding private dynamic paths", () => {
    expect(safePagePath("/dashboard")).toBe("/dashboard");
    expect(safePagePath("/p/sp-private-identifier")).toBe("/p");
    expect(safePagePath("/conversations/private-person-id")).toBe("/other");
    expect(safePagePath("/admin/payments")).toBeNull();
  });

  it("lets visitors reverse a previously saved optional tracking choice", () => {
    render(<TrackingChoices />);
    fireEvent.click(screen.getByRole("button", { name: "Decline optional cookies" }));
    expect(window.localStorage.getItem("successpro_optional_tracking")).toBe("no");
    expect(screen.getByText(/Declined/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Allow optional cookies" }));
    expect(window.localStorage.getItem("successpro_optional_tracking")).toBe("yes");
    expect(screen.getByText(/Allowed/)).toBeInTheDocument();
  });
});
