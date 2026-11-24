import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { analyzeResume } from "@successpro/domain";
import { ResumeReview } from "./resume-review";

const text = "Product manager with eight years of experience leading customer operations. Improved service processes and coordinated cross-functional product teams.";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function start() {
  render(<ResumeReview externalAiConsentAccepted />);
  fireEvent.change(screen.getByPlaceholderText("Upload your resume above, or paste its text here."), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Review my resume" }));
}
describe("review result recovery", () => {
  it("opens a recovered upload directly instead of restoring an unrelated old report", async () => {
    const originalUrl = window.location.href;
    const id = "11111111-1111-4111-8111-111111111111";
    try {
      window.history.replaceState({}, "", "/review?processingJobId=" + id);
      window.sessionStorage.setItem("successpro:last-analysis", "old-pending-report");
      const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "awaiting_review", extraction: { text, signals: {} } }) });
      vi.stubGlobal("fetch", fetch);
      render(<ResumeReview externalAiConsentAccepted />);
      await waitFor(() => expect(screen.getByDisplayValue(text)).toBeInTheDocument());
      expect(fetch).toHaveBeenCalledWith("/api/resumes/native/" + id, { cache: "no-store" });
      expect(window.sessionStorage.getItem("successpro:last-analysis")).toBeNull();
      expect(window.sessionStorage.getItem("successpro:last-native-job")).toBe(id);
    } finally {
      window.history.replaceState({}, "", originalUrl);
      window.sessionStorage.clear();
    }
  });
  it("shows a provider retry error without replacing the resume with a Pending report", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: "Gemini is busy. Retry shortly; no review allowance was used.", code: "CONTENT_ASSESSMENT_UNAVAILABLE", allowanceUsed: 0 }) }));
    start();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Gemini is busy"));
    expect(screen.getByDisplayValue(text)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review my resume" })).toBeEnabled();
    expect(screen.queryByText("Score Pending")).not.toBeInTheDocument();
  });
  it("preserves pasted text and does not promise an unused allowance after a lost response", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Network unavailable"));
    vi.stubGlobal("fetch", fetch);
    start();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Check your saved reports"));
    expect(screen.getByDisplayValue(text)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review my resume" })).toBeEnabled();
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(screen.getByRole("alert")).not.toHaveTextContent("allowance was not used");
  });
  it("labels fallback findings as partial and reports the server-confirmed zero charge", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: analyzeResume({ text, targetKeywords: [], documentSignals: {} }), assistant: { output: { summary: "Basic findings", topActions: [], limitations: [] }, meta: { validation: "fallback" } }, reviewStatus: "partial", allowanceUsed: 0, remaining: 3 }) }));
    start();
    expect(await screen.findByText(/Your partial report is saved/)).toHaveTextContent("No review allowance was used");
    expect(screen.getByText("Basic findings are ready")).toBeInTheDocument();
    expect(screen.queryByText("Your resume check is complete")).not.toBeInTheDocument();
    expect(screen.queryByText("Basic findings", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Guidance for your next edit")).not.toBeInTheDocument();
  });
});

describe("review with a job description", () => {
  const jobDescription = "Lead customer operations and coordinate cross-functional product teams. Improve service processes and communicate performance to stakeholders.";

  it.each([
    { button: "Review my resume", endpoints: ["/api/reviews", "/api/job-match"] },
    { button: "Check My Match with This Job", endpoints: ["/api/job-match", "/api/reviews"] },
  ])("runs each assessment once from $button", async ({ button, endpoints }) => {
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const fetch = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url === "/api/job-match"
        ? { result: { score: 64, matched: [], missing: [], actions: [], disclaimer: "Job match" } }
        : { result: analyzeResume({ text, targetKeywords: [], jobDescription }), reviewStatus: "completed" },
    }));
    vi.stubGlobal("fetch", fetch);

    render(<ResumeReview externalAiConsentAccepted />);
    fireEvent.change(screen.getByPlaceholderText("Upload your resume above, or paste its text here."), { target: { value: text } });
    fireEvent.change(screen.getByPlaceholderText("Or paste the full job description text here…"), { target: { value: jobDescription } });
    fireEvent.click(screen.getByRole("button", { name: button }));

    await screen.findByText("Your resume check is complete");
    expect(screen.getByText("Job match: 64%. See matching and missing skills below.")).toBeInTheDocument();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(endpoints);
    expect(screen.getByRole("button", { name: "Review my resume" })).toBeEnabled();
    expect(scroll).not.toHaveBeenCalled();
  });
});
