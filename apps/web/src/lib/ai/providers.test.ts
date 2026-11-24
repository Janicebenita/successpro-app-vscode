import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiGenerationConfig, providerFromConfig } from "./providers";

describe("Gemini generation configuration", () => {
  it("uses model-compatible thinking levels for Gemini 3 writing and review", () => {
    expect(geminiGenerationConfig("gemini-3.5-flash", "transformResumeProfile", 7_000)).toEqual({
      maxOutputTokens: 7_000, responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "LOW" },
    });
    expect(geminiGenerationConfig("gemini-3.5-flash", "analyzeResume", 3_200)).toEqual({
      maxOutputTokens: 3_200, responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "LOW" },
    });
  });
  it("retains the bounded 2.5 request format for the existing fallback", () => {
    expect(geminiGenerationConfig("gemini-2.5-flash", "extractResumeProfile", 7_000)).toEqual({
      maxOutputTokens: 7_000, responseMimeType: "application/json", temperature: 0.15, thinkingConfig: { thinkingBudget: 0 },
    });
  });
});


describe("Gemini resume assessment recovery", () => {
  const provider = providerFromConfig({
    id: "test-gemini", kind: "gemini", model: "gemini-3.5-flash-lite",
    apiKeyEnv: "TEST_GEMINI_KEY", enabled: true, approvedForPersonalData: true,
  });
  const request = { task: "analyzeResume", prompt: "Assessment prompt", maximumOutputTokens: 8_000, timeoutMs: 8_000 } as const;

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("recovers when the first two requests hit temporary capacity errors", async () => {
    vi.stubEnv("TEST_GEMINI_KEY", "test-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: { status: "UNAVAILABLE" } }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ error: { status: "UNAVAILABLE" } }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(provider.generate(request)).resolves.toMatchObject({ text: "{}" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 10_000);

  it("fails over immediately when Gemini reports an exhausted daily quota", async () => {
    vi.stubEnv("TEST_GEMINI_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      error: { details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] },
    }, { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(provider.generate(request)).rejects.toThrow("PROVIDER_HTTP_429");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

