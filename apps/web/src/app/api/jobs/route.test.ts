// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ documents: new Map<string, unknown>(), recruiterJobs: [] as Array<Record<string, unknown>>, ai: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionUser: async () => ({ uid: "candidate-1" }) }));
vi.mock("@/lib/feature-entitlements", () => ({ resolveUserEntitlements: async () => ({}), featureAvailable: () => true }));
vi.mock("@/lib/product-telemetry", () => ({ recordProductEvent: async () => undefined }));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: (name: string) => ({ doc: (id: string) => ({ get: async () => ({ data: () => state.documents.get(`${name}/${id}`) }) }), where: () => ({ limit: () => ({ get: async () => ({ size: state.recruiterJobs.length, docs: state.recruiterJobs.map((job) => ({ id: String(job.id), data: () => job })) }) }) }) }) } }));
vi.mock("@/lib/jobs/connectors", () => ({ fetchRegionalJobsForPreferences: async () => [], postedWithinDays: (date: string) => date === new Date().toISOString().slice(0, 10) }));
vi.mock("@/lib/jobs/ingestion", () => ({ currentJobs: async () => [{ id: "job-1", fingerprint: "fingerprint-1", title: "Product Strategy Lead", employer: "Example Employer", location: "New York, United States", description: "Lead product strategy and customer research for enterprise products.", workMode: "hybrid", sourceName: "Approved source", canonicalUrl: "https://example.com/job-1", postedOn: "2026-09-25", lastSeenOn: "2026-09-26", salaryText: "", freshness: "current" }] }));
vi.mock("@/lib/ai/orchestrator", () => ({ runAiTask: state.ai }));
import { GET } from "./route";

beforeEach(() => {
  state.documents.clear(); state.recruiterJobs = []; state.ai.mockReset();
  state.documents.set("profiles/candidate-1", { fullName: "Example Candidate", headline: "Product leader", location: "New York, United States", summary: "Led product strategy and customer research.", currentRole: "Product Director", industry: "Software", skills: ["Product strategy", "Customer research"], experience: [], education: [], targetRoles: [], openToWork: false, publicProfileEnabled: false });
  state.ai.mockResolvedValue({ output: { matches: [{ jobId: "job-1", reason: "Product strategy and customer research are evidenced in the profile.", gaps: [], caution: "Confirm the opening on the source site." }] }, meta: { validation: "passed" } });
});

describe("profile-first opportunity discovery", () => {
  it("keeps basic sourced matches available when the AI orchestration throws", async () => {
    state.ai.mockRejectedValue(new Error("Provider unavailable"));
    const response = await GET(); const body = await response.json();
    expect(response.status).toBe(200); expect(body.jobs).toHaveLength(1);
    expect(body.matches).toEqual([]); expect(body.meta).toBeNull();
    expect(body.message).toMatch(/basic title, skill and location/i);
  });
  it("finds jobs using a confirmed profile without requiring saved preferences", async () => {
    const response = await GET(); const body = await response.json();
    expect(body.jobs.map((job: { id: string }) => job.id)).toEqual(["job-1"]);
    expect(state.ai).toHaveBeenCalledWith("researchJobs", expect.objectContaining({ roleTitles: ["Product Director"], locations: ["New York, United States"], profileContext: expect.objectContaining({ currentRole: "Product Director" }) }), expect.anything());
  });
  it("does not show loosely prefiltered jobs the expert matcher rejected", async () => {
    state.ai.mockResolvedValue({ output: { matches: [] }, meta: { validation: "passed" } });
    const body = await (await GET()).json();
    expect(body.jobs).toEqual([]);
    expect(body.message).toMatch(/no current approved listing/i);
  });
  it("labels basic matches honestly when expert matching is unavailable", async () => {
    state.ai.mockResolvedValue({ output: { matches: [] }, meta: { validation: "fallback" } });
    const body = await (await GET()).json();
    expect(body.jobs).toHaveLength(1);
    expect(body.matches).toEqual([]);
    expect(body.message).toMatch(/basic title, skill and location/i);
  });
  it("includes a matching verified recruiter position for profile-only application", async () => {
    state.recruiterJobs = [{ id: "recruiter-job-1", title: "Product Director", organizationName: "Verified Employer", location: "New York, United States", workMode: "hybrid", description: "Lead product strategy and customer research.", publishedOn: new Date().toISOString().slice(0, 10), recruiterId: "another-account" }];
    state.ai.mockResolvedValue({ output: { matches: [{ jobId: "recruiter:recruiter-job-1", reason: "Relevant product leadership.", gaps: [], caution: "Confirm the details." }] }, meta: { validation: "passed" } });
    const body = await (await GET()).json();
    expect(body.recruiterJobs).toMatchObject([{ id: "recruiter-job-1", organizationName: "Verified Employer" }]);
    expect(body.jobs).toEqual([]);
  });
});
