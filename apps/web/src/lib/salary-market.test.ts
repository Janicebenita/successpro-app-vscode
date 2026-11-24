import { describe, expect, it } from "vitest";
import { groundedSalarySources, researchSalaryMarket } from "./salary-market";

describe("grounded salary market research", () => {
  it("accepts only salary values whose URL was returned by grounded web research", () => {
    const sources = groundedSalarySources({ sources: [
      { url: "https://example.com/salaries", low: 1_200_000, midpoint: 1_600_000, high: 2_000_000, publishedOn: "2026-02-01" },
      { url: "https://invented.example/salary", low: 1, midpoint: 2, high: 3 },
    ] }, [{ web: { uri: "https://example.com/salaries", title: "Transparent salary survey" } }], "2026-09-26");
    expect(sources).toEqual([{ id: expect.stringMatching(/^web-salary-/), name: "Transparent salary survey", url: "https://example.com/salaries", publishedOn: "2026-02-01", dateBasis: "published", low: 1_200_000, midpoint: 1_600_000, high: 2_000_000 }]);
  });

  it("marks an unknown publication date as accessed rather than inventing one", () => {
    const [source] = groundedSalarySources({ sources: [{ url: "https://example.com/range", low: 1, midpoint: 2, high: 3 }] }, [{ web: { uri: "https://example.com/range", title: "Range" } }], "2026-09-26");
    expect(source).toMatchObject({ publishedOn: "2026-09-26", dateBasis: "accessed" });
  });

  it("uses Gemini web grounding and rejects references not returned by the grounding response", async () => {
    const prior = process.env.GOOGLE_CLOUD_PROJECT;
    process.env.GOOGLE_CLOUD_PROJECT = "successpro-test";
    const requestBodies: Array<Record<string, unknown>> = [];
    try {
      const result = await researchSalaryMarket({ role: "Product Manager", location: "Bengaluru, India", yearsExperience: 8, industry: "Technology", currency: "INR" }, {
        accessToken: async () => "test-token",
        today: () => "2026-09-26",
        request: async (_url, init) => {
          requestBodies.push(JSON.parse(String(init.body)));
          return new Response(JSON.stringify(requestBodies.length === 1 ? { candidates: [{ content: { parts: [{ text: "A reported annual range is INR 18 to 27 lakh." }] }, groundingMetadata: { webSearchQueries: ["Product Manager salary Bengaluru"], searchEntryPoint: { renderedContent: "<div>Search</div>" }, groundingChunks: [{ web: { uri: "https://evidence.example/range", title: "Evidence" } }, { web: { uri: "https://evidence.example/another", title: "Repeated site" } }, { web: { uri: "https://reddit.com/r/salary", title: "Forum" } }], groundingSupports: [{ segment: { text: "A reported annual range is INR 18 to 27 lakh." }, groundingChunkIndices: [0, 1, 2] }] } }] } : { candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: "One cited range matched.", sources: [{ sourceIndex: 0, low: 1_800_000, midpoint: 2_200_000, high: 2_700_000 }, { sourceIndex: 1, low: 2_000_000, midpoint: 2_400_000, high: 2_800_000 }, { sourceIndex: 2, low: 1_000_000, midpoint: 1_200_000, high: 1_400_000 }] }) }] } }] }), { status: 200 });
        },
      });
      expect(requestBodies[0]).toMatchObject({ tools: [{ google_search: {} }] });
      expect(requestBodies[0]).not.toMatchObject({ generationConfig: { responseMimeType: "application/json" } });
      expect(requestBodies[1]).toMatchObject({ generationConfig: { responseMimeType: "application/json" } });
      expect(result).toMatchObject({ currency: "INR", queries: ["Product Manager salary Bengaluru"], searchSuggestionHtml: "<div>Search</div>", sources: [{ name: "Evidence", dateBasis: "accessed", midpoint: 2_200_000 }] });
      expect(result?.sources).toHaveLength(1);
    } finally { if (prior === undefined) delete process.env.GOOGLE_CLOUD_PROJECT; else process.env.GOOGLE_CLOUD_PROJECT = prior; }
  });

  it("uses the next approved research model when the primary model fails", async () => {
    const prior = process.env.GOOGLE_CLOUD_PROJECT;
    process.env.GOOGLE_CLOUD_PROJECT = "successpro-test";
    const endpoints: string[] = [];
    try {
      const result = await researchSalaryMarket({ role: "Engineer", location: "Mumbai, India", yearsExperience: 5, currency: "INR" }, {
        accessToken: async () => "test-token", today: () => "2026-09-26",
        request: async (url) => {
          endpoints.push(url);
          if (endpoints.length === 1) return new Response("unavailable", { status: 503 });
          return new Response(JSON.stringify(endpoints.length === 2 ? { candidates: [{ content: { parts: [{ text: "Salary is 1 to 3 INR annually." }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://evidence.example/engineer", title: "Evidence" } }], groundingSupports: [{ segment: { text: "Salary is 1 to 3 INR annually." }, groundingChunkIndices: [0] }] } }] } : { candidates: [{ content: { parts: [{ text: JSON.stringify({ sources: [{ sourceIndex: 0, low: 1, midpoint: 2, high: 3 }] }) }] } }] }));
        },
      });
      expect(endpoints).toHaveLength(3);
      expect(endpoints[1]).toContain("gemini-3.6-flash");
      expect(result?.sources[0]).toMatchObject({ url: "https://evidence.example/engineer", midpoint: 2 });
    } finally { if (prior === undefined) delete process.env.GOOGLE_CLOUD_PROJECT; else process.env.GOOGLE_CLOUD_PROJECT = prior; }
  });

  it("keeps independent publishers behind Google grounding redirects", async () => {
    const prior = process.env.GOOGLE_CLOUD_PROJECT;
    process.env.GOOGLE_CLOUD_PROJECT = "successpro-test";
    let calls = 0;
    try {
      const result = await researchSalaryMarket({ role: "Product Manager", location: "Bengaluru", yearsExperience: 8, currency: "INR" }, {
        accessToken: async () => "test-token", today: () => "2026-09-26",
        request: async () => {
          calls += 1;
          const redirects = ["survey.example", "survey.example", "benchmark.example", "reddit.com"].map((title, index) => ({ web: { uri: `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${index}`, title } }));
          const candidate = calls === 1
            ? { content: { parts: [{ text: "Salaries are 18 to 27 lakh at each source." }] }, groundingMetadata: { groundingChunks: redirects, groundingSupports: [{ segment: { text: "Salaries are 18 to 27 lakh at each source." }, groundingChunkIndices: [0, 1, 2, 3] }] } }
            : { content: { parts: [{ text: JSON.stringify({ sources: [0, 1, 2, 3].map((sourceIndex) => ({ sourceIndex, low: 1_800_000, midpoint: 2_200_000, high: 2_700_000 })) }) }] } };
          return new Response(JSON.stringify({ candidates: [candidate] }));
        },
      });
      expect(result?.sources.map((source) => source.name)).toEqual(["survey.example", "benchmark.example"]);
    } finally { if (prior === undefined) delete process.env.GOOGLE_CLOUD_PROJECT; else process.env.GOOGLE_CLOUD_PROJECT = prior; }
  });
});
