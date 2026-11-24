import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { canonicalProfileSchema } from "@successpro/contracts";
import { createLinkedInMakeover } from "@successpro/domain";
import { LinkedInMakeover } from "./linkedin-makeover";

const profile = canonicalProfileSchema.parse({ fullName: "Test Member", headline: "Product leader", summary: "Experienced product leader.", skills: ["Strategy"], location: "", currentRole: "Product leader", industry: "Technology", experience: [], education: [], targetRoles: [] });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("LinkedIn request recovery", () => {
  it("preserves content and enables retry after a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network unavailable")));
    const result = createLinkedInMakeover(profile);
    render(<LinkedInMakeover result={result} profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my profile" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Your profile wording has not changed"));
    expect(screen.getByRole("button", { name: "Tailor my profile" })).toBeEnabled();
    expect(screen.getByText(result.about.replace(/\s+/g, " ").trim())).toBeInTheDocument();
  });
  it("recovers from a non-JSON server failure without remaining busy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => { throw new SyntaxError("HTML response"); } }));
    render(<LinkedInMakeover result={createLinkedInMakeover(profile)} profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my profile" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Tailor my profile" })).toBeEnabled());
    expect(screen.getByRole("status")).toHaveTextContent("please try again");
  });
});
