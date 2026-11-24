import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJobsFromSource, fetchRegionalJobsForPreferences, normalizeBrightDataJobs, postedWithinDays } from "@/lib/jobs/connectors";
import type { JobSource } from "@successpro/contracts/jobs";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const base: Omit<JobSource, "type" | "id" | "name" | "token"> = { employer: "Northstar", region: "global", countryCode: "in", location: "", enabled: true, termsReviewedOn: "2026-09-23", termsUrl: "https://example.com/terms" };

describe("lawful public job connectors", () => {
  it("normalizes Greenhouse records and strips source HTML", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ jobs: [{ id: 42, title: "Product Manager", absolute_url: "https://boards.greenhouse.io/northstar/jobs/42", updated_at: "2026-09-22T10:00:00Z", location: { name: "Bengaluru (Hybrid)" }, content: "<p>Lead product management strategy and SQL analytics.</p><script>bad()</script>" }] }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const jobs = await fetchJobsFromSource({ ...base, id: "northstar-gh", name: "Northstar careers", type: "greenhouse", token: "northstar" });
    expect(jobs[0]).toMatchObject({ sourceJobId: "42", title: "Product Manager", workMode: "hybrid", freshness: "current" });
    expect(jobs[0].description).toBe("Lead product management strategy and SQL analytics.");
    expect(jobs[0].normalizedSkills).toEqual(expect.arrayContaining(["sql", "product management", "analytics"]));
  });

  it("normalizes Lever records and keeps a distinct source record with the same dedupe fingerprint", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ id: "lever-42", text: "Product Manager", hostedUrl: "https://jobs.lever.co/northstar/lever-42", createdAt: Date.parse("2026-09-22T10:00:00Z"), categories: { location: "Bengaluru (Hybrid)", commitment: "Full-time", workplaceType: "hybrid" }, descriptionPlain: "Lead product strategy and SQL analytics." }]), { status: 200, headers: { "Content-Type": "application/json" } })));
    const lever = await fetchJobsFromSource({ ...base, id: "northstar-lever", name: "Northstar careers", type: "lever", token: "northstar" });
    expect(lever[0]).toMatchObject({ sourceJobId: "lever-42", employmentType: "Full-time", workMode: "hybrid" });
    expect(lever[0].id).not.toBe(lever[0].fingerprint);
  });

  it("rejects tokens that could escape the fixed provider host", async () => {
    await expect(fetchJobsFromSource({ ...base, id: "bad", name: "Bad", type: "greenhouse", token: "../../attacker" })).rejects.toThrow("INVALID_GREENHOUSE_TOKEN");
  });

  it("normalizes official USAJOBS results when server credentials are present", async () => {
    vi.stubEnv("USAJOBS_API_KEY", "test-key");
    vi.stubEnv("USAJOBS_USER_AGENT", "team@example.com");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ SearchResult: { SearchResultItems: [{ MatchedObjectId: "123", MatchedObjectDescriptor: { PositionID: "123", PositionTitle: "Data Analyst", PositionURI: "https://www.usajobs.gov/job/123", PublicationStartDate: "2026-09-20T00:00:00", OrganizationName: "Department of Testing", PositionLocationDisplay: "Washington, DC", PositionSchedule: [{ Name: "Full-time" }], PositionRemuneration: [{ MinimumRange: "80000", MaximumRange: "100000", Description: "Per Year" }], UserArea: { Details: { JobSummary: "Use Python and SQL for data analysis." } } } }] } }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const jobs = await fetchJobsFromSource({ ...base, id: "usajobs-data", name: "USAJOBS", type: "usajobs", token: "data analyst" });
    expect(jobs[0]).toMatchObject({ title: "Data Analyst", employer: "Department of Testing", employmentType: "Full-time", salaryText: "80000-100000 Per Year" });
    expect(jobs[0].normalizedSkills).toEqual(expect.arrayContaining(["python", "sql", "data analysis"]));
  });

  it("queries Adzuna's official regional API with a strict 30-day window", async () => {
    vi.stubEnv("ADZUNA_APP_ID", "test-id"); vi.stubEnv("ADZUNA_APP_KEY", "test-key");
    const fetchMock = vi.fn(async (input: string) => { void input; return new Response(JSON.stringify({ results: [{ id: "in-1", title: "Product Analyst", redirect_url: "https://www.adzuna.in/details/in-1", created: "2026-09-20T10:00:00Z", company: { display_name: "Northstar India" }, location: { display_name: "Bengaluru, Karnataka" }, description: "Use SQL and data analysis.", contract_time: "full_time" }] }), { status: 200, headers: { "Content-Type": "application/json" } }); });
    vi.stubGlobal("fetch", fetchMock);
    const jobs = await fetchJobsFromSource({ ...base, id: "adzuna-in-product", name: "Adzuna India", type: "adzuna", token: "product analyst", location: "Bengaluru" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/jobs/in/search/1?");
    expect(String(fetchMock.mock.calls[0][0])).toContain("max_days_old=30");
    expect(jobs[0]).toMatchObject({ title: "Product Analyst", employer: "Northstar India", location: "Bengaluru, Karnataka" });
  });

  it("excludes missing, future, and older-than-30-day postings", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    expect(postedWithinDays("2026-08-25", now)).toBe(true);
    expect(postedWithinDays("2026-08-24", now)).toBe(false);
    expect(postedWithinDays("", now)).toBe(false);
    expect(postedWithinDays("2026-09-25", now)).toBe(false);
  });

  it("builds separate regional source searches from each customer's preferences", async () => {
    vi.stubEnv("ADZUNA_APP_ID", "test-id"); vi.stubEnv("ADZUNA_APP_KEY", "test-key");
    const fetchMock = vi.fn(async (input: string) => { const url = new URL(input); return new Response(JSON.stringify({ results: [{ id: url.searchParams.get("where"), title: url.searchParams.get("what"), redirect_url: `https://www.adzuna.com/details/${encodeURIComponent(url.searchParams.get("where") ?? "job")}`, created: "2026-09-20T10:00:00Z", company: { display_name: "Customer-specific employer" }, location: { display_name: url.searchParams.get("where") }, description: "SaaS partnerships and enterprise sales", contract_time: "full_time" }] }), { status: 200, headers: { "Content-Type": "application/json" } }); });
    vi.stubGlobal("fetch", fetchMock);
    const jobs = await fetchRegionalJobsForPreferences({ roleTitles: ["Business Development"], locations: ["New York, USA", "Mumbai, India"], keywords: ["SaaS"] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => new URL(url).searchParams.get("where"))).toEqual(expect.arrayContaining(["New York, USA", "Mumbai, India"]));
    expect(jobs.map((job) => job.location)).toEqual(expect.arrayContaining(["New York, USA", "Mumbai, India"]));
  });

  it("uses the original HTTPS application URL and basic fields from Google Jobs provider results", () => {
    const source: JobSource = { ...base, id: "brightdata-us", name: "Google Jobs via Bright Data", type: "brightdata_google_jobs", token: "product manager", countryCode: "us", location: "New York" };
    const jobs = normalizeBrightDataJobs({ jobs: [{ job_id: "g-1", title: "Product Manager", company_name: "Northstar", location: "New York, NY", posted_at: "2 days ago", description: "Lead product strategy and analytics.", apply_options: [{ link: "javascript:bad()" }, { link: "https://careers.example.com/jobs/g-1" }] }] }, source, new Date("2026-09-24T12:00:00Z"));
    expect(jobs[0]).toMatchObject({ canonicalUrl: "https://careers.example.com/jobs/g-1", postedOn: "2026-09-22", title: "Product Manager", employer: "Northstar" });
  });
});
