import { describe, expect, it } from "vitest";
import type { JobSource } from "@successpro/contracts/jobs";
import { normalizeJobicyJobs, normalizeJoobleJobs, postedWithinDays } from "./connectors";

const source = { id: "jobicy-public", type: "jobicy", name: "Jobicy" } as JobSource;

describe("attributed public job ingestion", () => {
  it("maps Jooble snippets without inventing salary or a full description", () => {
    const jobs = normalizeJoobleJobs({ jobs: [{ id: 42, title: "Sales Director", company: "Example", location: "Mumbai", snippet: "<p>Sales leadership</p>", link: "https://in.jooble.org/jdp/42", updated: "2026-09-25T12:00:00Z" }] }, { ...source, type: "jooble" });
    expect(jobs[0]).toMatchObject({ sourceName: "Jooble", description: "Sales leadership", salaryText: "", postedOn: "2026-09-25", canonicalUrl: "https://in.jooble.org/jdp/42" });
    expect(normalizeJoobleJobs({}, source)).toEqual([]);
  });
  it("preserves the source listing, remote eligibility, publication date and salary basis", () => {
    const jobs = normalizeJobicyJobs({ jobs: [{ id: 123456, url: "https://jobicy.com/jobs/example-role", jobTitle: "Senior Product Designer", companyName: "Example Company", jobGeo: "Anywhere", jobType: ["full-time"], jobDescription: "<p>Lead product research and design.</p>", pubDate: "2026-09-25T12:00:00Z", salaryMin: 90000, salaryMax: 125000, salaryCurrency: "USD", salaryPeriod: "yearly" }] }, source);
    expect(jobs).toMatchObject([{ sourceName: "Jobicy", sourceJobId: "123456", canonicalUrl: "https://jobicy.com/jobs/example-role", location: "Remote", postedOn: "2026-09-25", workMode: "remote", salaryText: "USD 90000–125000 / yearly", description: "Lead product research and design." }]);
  });
  it("does not mistake region-restricted remote work for anywhere eligibility", () => {
    expect(normalizeJobicyJobs({ jobs: [{ id: 1, jobGeo: "USA", jobTitle: "Analyst" }] }, source)[0].location).toBe("USA");
  });
  it("rejects old and undated listings from the current-feed window", () => {
    const today = new Date("2026-09-26T00:00:00Z");
    expect(postedWithinDays("2026-09-25", today)).toBe(true);
    expect(postedWithinDays("2026-08-20", today)).toBe(false);
    expect(postedWithinDays("", today)).toBe(false);
  });
});
