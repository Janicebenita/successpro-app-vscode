import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeCareerjetResponse, searchCareerjetIndia } from "./careerjet";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const now = new Date("2026-09-26T00:00:00Z");
const job = { title: "Analyst", company: "Example", locations: "Mumbai", date: "Fri, 25 Sep 2026 12:00:00 GMT", description: "<p>Analyze data</p>", url: "https://jobviewtrack.com/v2/example", salary_currency_code: "INR", salary_min: 50000, salary_max: 70000, salary_type: "M" };
describe("Careerjet India", () => {
  it("retains salary period and source link without inventing annual pay", () => {
    expect(normalizeCareerjetResponse({ type: "JOBS", jobs: [job] }, now)).toMatchObject({ type: "jobs", jobs: [{ salaryText: "INR 50000–70000 / month", description: "Analyze data", postedOn: "2026-09-25", dateBasis: "posted" }] });
  });
  it("excludes expired, undated and unsafe-link listings", () => {
    expect(normalizeCareerjetResponse({ type: "JOBS", jobs: [{ ...job, date: "" }, { ...job, date: "2026-07-01" }, { ...job, url: "https://unapproved.example/job" }] }, now)).toEqual({ type: "jobs", jobs: [] });
  });
  it("preserves ambiguous locations for customer clarification", () => {
    expect(normalizeCareerjetResponse({ type: "LOCATIONS", locations: ["Mumbai, Maharashtra", "Mumbai region"] })).toEqual({ type: "locations", locations: ["Mumbai, Maharashtra", "Mumbai region"] });
  });
  it("requires real visitor context before dispatch", async () => {
    vi.stubEnv("CAREERJET_INDIA_API_KEY", "test-secret"); vi.stubEnv("CAREERJET_INDIA_APPROVED", "true");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(searchCareerjetIndia("Analyst", "Mumbai", { ip: "", userAgent: "test", referer: "https://example.com/opportunities" })).rejects.toThrow("CAREERJET_VISITOR_REQUIRED");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses documented basic auth, India locale and initiating page", async () => {
    vi.stubEnv("CAREERJET_INDIA_API_KEY", "test-secret"); vi.stubEnv("CAREERJET_INDIA_APPROVED", "true"); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ type: "JOBS", jobs: [] }) }); vi.stubGlobal("fetch", fetch);
    await searchCareerjetIndia("Analyst", "Mumbai", { ip: "203.0.113.1", userAgent: "test-browser", referer: "https://example.com/opportunities" });
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get("locale_code")).toBe("en_IN");
    expect(fetch.mock.calls[0][1].headers).toMatchObject({ Authorization: `Basic ${Buffer.from("test-secret:").toString("base64")}`, Referer: "https://example.com/opportunities" });
  });
});
