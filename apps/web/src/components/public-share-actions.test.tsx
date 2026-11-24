import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PublicShareActions } from "./public-share-actions";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("public profile sharing", () => {
  it("exposes the public profile URL when clipboard permission fails on the dashboard", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("Permission denied")) } });
    render(<PublicShareActions name="Synthetic Member" profilePath="/p/sp-0000000000000000" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(screen.getByLabelText("Your public profile link")).toHaveValue(`${window.location.origin}/p/sp-0000000000000000`));
  });

  it("shares the public destination with LinkedIn rather than the current dashboard", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<PublicShareActions name="Synthetic Member" profilePath="/p/sp-0000000000000000" />);
    fireEvent.click(screen.getByRole("button", { name: "LinkedIn" }));
    expect(open).toHaveBeenCalledWith(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${window.location.origin}/p/sp-0000000000000000`)}`, "_blank", "noopener,noreferrer,width=720,height=640");
  });
});
