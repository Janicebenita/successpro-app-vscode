import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProfileForm } from "./profile-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const initial = { fullName: "Test Candidate", headline: "Operations manager", summary: "My verified original summary.", skills: ["Operations"], experience: [{ id: "role-1", title: "Manager", employer: "Example", startDate: "2020", endDate: "Present", achievements: [] }], education: [{ id: "education-1", qualification: "Bachelor's degree", institution: "Example University", startDate: "", endDate: "2018" }] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("editable transformation recovery", () => {
  it("shows extraction questions beside editable details before transformation", () => {
    render(<ProfileForm initial={initial} resumeDraft={initial} draftApplied resumeDraftWarnings={["Confirm the exact awarding institution before publishing."]} />);
    expect(screen.getByRole("heading", { name: "Details to confirm" })).toBeInTheDocument();
    expect(screen.getByText("Confirm the exact awarding institution before publishing.")).toBeInTheDocument();
    expect(screen.getByLabelText("Professional summary")).toBeInTheDocument();
  });
  it("lets the customer place the confirmation panel on either side", () => {
    render(<ProfileForm initial={initial} resumeDraft={initial} draftApplied resumeDraftWarnings={["Confirm the exact awarding institution before publishing."]} />);
    fireEvent.click(screen.getByRole("button", { name: "Move panel left" }));
    expect(screen.getByRole("button", { name: "Move panel right" })).toBeInTheDocument();
  });
  it("clears reviewed questions after the customer saves corrected details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ publicProfileId: null }) }));
    render(<ProfileForm initial={initial} resumeDraft={initial} draftApplied resumeDraftWarnings={["Confirm your qualification year."]} />);
    fireEvent.click(screen.getByLabelText(/I checked this against my original document/i));
    fireEvent.click(screen.getByRole("button", { name: "Save my changes" }));
    await waitFor(() => expect(screen.queryByText("Confirm your qualification year.")).not.toBeInTheDocument());
  });
  it("requires an explicit answer when the resume lacks a core section", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    render(<ProfileForm initial={{ ...initial, skills: [] }} resumeDraft={{ ...initial, skills: [] }} draftApplied />);
    fireEvent.click(screen.getByRole("button", { name: "Transform with expert assistance" }));
    expect(screen.getAllByText(/Please answer the 1 highlighted detail/i).length).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("asks the customer to classify an older untyped highlight before saving", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<ProfileForm initial={{ ...initial, awards: [{ id: "a1", title: "Finished a major event", issuer: "", date: "", description: "" }] }} resumeDraft={initial} draftApplied />);
    fireEvent.click(screen.getByRole("button", { name: "Save my changes" }));
    expect(screen.getAllByText(/choose whether each saved highlight is an award or an achievement/i).length).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("sends an optional job description to the resume writer without losing edits", async () => {
    const fetch = vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    vi.stubGlobal("fetch", fetch);
    render(<ProfileForm initial={initial} resumeDraft={initial} draftApplied />);
    fireEvent.change(screen.getByLabelText(/Job description to tailor this resume/i), { target: { value: "Lead operations and stakeholder planning." } });
    fireEvent.click(screen.getByRole("button", { name: "Transform with expert assistance" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(JSON.parse(fetch.mock.calls[0][1].body).jobDescription).toBe("Lead operations and stakeholder planning.");
  });
  it("bounds the request, keeps edits and enables retry after a timeout", async () => {
    const fetch = vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    vi.stubGlobal("fetch", fetch);
    render(<ProfileForm initial={initial} resumeDraft={initial} draftApplied />);
    fireEvent.change(screen.getByDisplayValue(initial.summary), { target: { value: "My latest manual correction." } });
    fireEvent.click(screen.getByRole("button", { name: "Transform with expert assistance" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Transform with expert assistance" })).toBeEnabled());
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(screen.getByDisplayValue("My latest manual correction.")).toBeInTheDocument();
    expect(screen.getAllByText(/transformation was interrupted/i).length).toBeGreaterThan(0);
  });
  it.each([
    { profileDraft: { summary: "Unvalidated rewrite" }, assistant: { validation: "fallback" } },
    { profileDraft: { skills: "Invalid skills" }, assistant: { validation: "passed" } },
    {},
  ])("never overwrites edits with fallback or malformed success responses", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
    render(<ProfileForm initial={initial} resumeDraft={initial} draftApplied />);
    fireEvent.click(screen.getByRole("button", { name: "Transform with expert assistance" }));
    await waitFor(() => expect(screen.getAllByText(/without a usable draft/i).length).toBeGreaterThan(0));
    expect(screen.getByDisplayValue(initial.summary)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transform with expert assistance" })).toBeEnabled();
  });
});
