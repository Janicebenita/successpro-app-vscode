import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobSource } from "@successpro/contracts/jobs";

const mocks = vi.hoisted(() => ({ usage: 0, cached: null as Record<string, unknown> | null, writes: [] as unknown[] }));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: {
  collection: (name: string) => ({ doc: (id: string) => ({ name, id, set: vi.fn() }) }),
  runTransaction: async (callback: (transaction: unknown) => unknown) => callback({
    get: async (ref: { name: string }) => ({ data: () => ref.name === "job_provider_usage" ? { requests: mocks.usage } : mocks.cached }),
    set: (_ref: unknown, value: unknown) => mocks.writes.push(value),
  }),
} }));
import { fetchJobsFromSource } from "./connectors";
const source: JobSource = { id: "test", type: "jooble", name: "Jooble", employer: "", token: "Director", region: "global", countryCode: "in", location: "Mumbai", enabled: true, termsReviewedOn: "2026-09-26", termsUrl: "https://in.jooble.org/api/about" };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); mocks.usage = 0; mocks.cached = null; mocks.writes = []; });
function configure() { vi.stubEnv("JOOBLE_INDIA_API_KEY", "test-secret"); vi.stubEnv("JOOBLE_INDIA_APPROVED", "true"); }
describe("Jooble lifetime quota safeguards", () => {
  it("does not dispatch when the lifetime quota is exhausted", async () => {
    configure(); mocks.usage = 500; const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(fetchJobsFromSource(source)).rejects.toThrow("JOOBLE_QUOTA_EXHAUSTED");
    expect(fetch).not.toHaveBeenCalled(); expect(mocks.writes).toHaveLength(0);
  });
  it("serves a fresh shared cache even after quota exhaustion", async () => {
    configure(); mocks.usage = 500; mocks.cached = { savedAt: Date.now(), body: { jobs: [] } };
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await fetchJobsFromSource(source)).toEqual([]); expect(fetch).not.toHaveBeenCalled();
  });
  it("reserves the final call and never retries an upstream failure", async () => {
    configure(); mocks.usage = 499; const fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 }); vi.stubGlobal("fetch", fetch);
    await expect(fetchJobsFromSource(source)).rejects.toThrow("JOOBLE_REQUEST_FAILED");
    expect(mocks.writes).toContainEqual({ requests: 500, limit: 500 }); expect(fetch).toHaveBeenCalledTimes(1);
    const options = fetch.mock.calls[0][1]; expect(JSON.parse(options.body)).toMatchObject({ keywords: "Director", location: "Mumbai" });
    expect(fetch.mock.calls[0][0]).toBe("https://jooble.org/api/test-secret");
  });
  it("refuses non-India queries and unapproved configuration", async () => {
    configure(); await expect(fetchJobsFromSource({ ...source, countryCode: "us" })).rejects.toThrow("INVALID_JOOBLE_INDIA_QUERY");
    vi.stubEnv("JOOBLE_INDIA_APPROVED", "false"); await expect(fetchJobsFromSource(source)).rejects.toThrow("JOOBLE_NOT_CONFIGURED");
  });
});
