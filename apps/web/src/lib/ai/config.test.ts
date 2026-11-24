import { afterEach, beforeEach, expect, it, vi } from "vitest";
const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: () => ({ doc: () => ({ get }) }) } }));
import { loadAiConfig, safeDefaultAiConfig, usableProviderConfigs } from "./config";
beforeEach(() => { get.mockRejectedValue(new Error("unavailable")); });
afterEach(() => { vi.unstubAllEnvs(); });
it("survives a malformed environment override without exposing its value", async () => {
  vi.stubEnv("AI_PROVIDER_CHAIN_JSON", "{broken");
  expect(await loadAiConfig()).toEqual(safeDefaultAiConfig);
});
it("uses a valid environment override when the configuration store is unavailable", async () => {
  const config = { policyVersion: "test", providers: [], cacheTtlHours: 0 };
  vi.stubEnv("AI_PROVIDER_CHAIN_JSON", JSON.stringify(config));
  expect(await loadAiConfig()).toEqual(config);
});
it("honours the stored disabled-provider configuration over environment defaults", async () => {
  const config = { policyVersion: "disabled", providers: [], cacheTtlHours: 0 };
  get.mockResolvedValue({ data: () => config });
  vi.stubEnv("AI_PROVIDER_CHAIN_JSON", "{broken");
  expect(await loadAiConfig()).toEqual(config);
});
it("routes the quality-model chain across the customer lifecycle", () => {
  for (const task of ["extractResumeProfile", "transformResumeProfile", "analyzeResume", "generateCoverLetter", "generateLinkedInMakeover", "careerGapPlan", "recommendUpskilling", "salaryNarrative", "researchJobs"] as const) {
    expect(usableProviderConfigs(safeDefaultAiConfig, "personal", task).map((provider) => provider.model)).toEqual(["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash"]);
  }
});

it("routes resume scoring alone through the opt-in Vertex project", async () => {
  vi.stubEnv("RESUME_CONTENT_VERTEX_PROJECT", "staging-project");
  vi.stubEnv("RESUME_AI_PROVIDER", "gemini");
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MODEL", "existing-model");
  const review = await loadAiConfig("analyzeResume");
  expect(review.providers.map(({ kind, project, timeoutMs }) => ({ kind, project, timeoutMs }))).toEqual([
    { kind: "vertex-gemini", project: "staging-project", timeoutMs: 60_000 },
    { kind: "vertex-gemini", project: "staging-project", timeoutMs: 65_000 },
  ]);
  const writing = await loadAiConfig("generateCoverLetter");
  expect(writing.providers[0]).toMatchObject({ kind: "gemini", model: "existing-model" });
});
