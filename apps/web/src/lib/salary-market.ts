import { createHash } from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import type { SalarySource } from "@successpro/contracts";

type ResearchInput = { role: string; location: string; yearsExperience: number; industry?: string; currency: string };
type GroundingChunk = { web?: { uri?: string; title?: string } };
type ModelSource = { url?: unknown; sourceIndex?: unknown; low?: unknown; midpoint?: unknown; high?: unknown; publishedOn?: unknown };
type ModelResult = { currency?: unknown; sources?: ModelSource[]; summary?: unknown };
type GroundingSupport = { segment?: { text?: string }; groundingChunkIndices?: number[] };
type VertexResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: GroundingChunk[]; groundingSupports?: GroundingSupport[]; webSearchQueries?: string[]; searchEntryPoint?: { renderedContent?: string } } }> };

function date(value: unknown, today: string) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today; }
function amount(value: unknown) { const number = typeof value === "number" ? value : Number(value); return Number.isSafeInteger(number) && number >= 0 ? number : null; }
function sameUrl(left: string, right: string) { try { const a = new URL(left); const b = new URL(right); return a.origin === b.origin && a.pathname.replace(/\/$/, "") === b.pathname.replace(/\/$/, ""); } catch { return false; } }
function sourceDomain(url: string, title = "") {
  const titledDomain = title.trim().toLowerCase().match(/^([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:\b|\/)/)?.[1];
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host === "vertexaisearch.cloud.google.com" && titledDomain ? titledDomain.replace(/^www\./, "") : host;
  } catch { return ""; }
}
function suitableSource(url: string, title = "") { return !/(^|\.)(reddit|quora|facebook|linkedin|x|twitter)\.(com|in)$/.test(sourceDomain(url, title)); }

export function groundedSalarySources(result: ModelResult, chunks: GroundingChunk[], today = new Date().toISOString().slice(0, 10)): SalarySource[] {
  const evidence = chunks.flatMap((chunk) => chunk.web?.uri && /^https:\/\//.test(chunk.web.uri) ? [{ url: chunk.web.uri, name: chunk.web.title?.trim() || new URL(chunk.web.uri).hostname }] : []);
  const seen = new Set<string>();
  return (Array.isArray(result.sources) ? result.sources : []).flatMap((candidate) => {
    if (typeof candidate.url !== "string" || seen.has(candidate.url)) return [];
    const url = candidate.url;
    const source = evidence.find((item) => sameUrl(item.url, url));
    const low = amount(candidate.low); const midpoint = amount(candidate.midpoint); const high = amount(candidate.high);
    if (!source || low === null || midpoint === null || high === null || low > midpoint || midpoint > high) return [];
    seen.add(url);
    const publishedOn = date(candidate.publishedOn, today);
    return [{ id: `web-salary-${createHash("sha256").update(url).digest("hex").slice(0, 16)}`, name: source.name.slice(0, 160), url: source.url, publishedOn, dateBasis: publishedOn === today && candidate.publishedOn !== today ? "accessed" as const : "published" as const, low, midpoint, high }];
  }).slice(0, 12);
}

function prompt(input: ResearchInput) {
  return `Research current annual gross cash salary ranges for a ${input.role} in ${input.location}, with approximately ${input.yearsExperience} years of relevant experience, in ${input.industry || "the relevant industry"}. Use ${input.currency} and match the role, geography, and seniority as closely as possible. Search public salary surveys, official labour statistics, transparent employer ranges, or job listings with salary ranges. Write a concise prose answer with each numeric range tied to a cited source. State important limitations. Do not guess figures, do not turn total compensation into cash pay, and do not provide JSON.`;
}

function citedPassages(candidate: NonNullable<VertexResponse["candidates"]>[number]) {
  const chunks = candidate.groundingMetadata?.groundingChunks ?? [];
  const passages = (candidate.groundingMetadata?.groundingSupports ?? []).flatMap((support) => {
    const text = support.segment?.text?.trim() ?? "";
    const sourceIndices = (support.groundingChunkIndices ?? []).filter((index) => Number.isInteger(index) && index >= 0 && !!chunks[index]?.web?.uri);
    return /\d/.test(text) && sourceIndices.length ? [{ text: text.slice(0, 900), sourceIndices }] : [];
  });
  const seen = new Set<number>();
  return passages.filter((passage) => {
    const index = passage.sourceIndices[0];
    if (seen.has(index)) return false;
    seen.add(index);
    return true;
  }).slice(0, 6);
}

function extractedSources(result: ModelResult, chunks: GroundingChunk[], passages: ReturnType<typeof citedPassages>, today: string): SalarySource[] {
  const cited = new Set(passages.flatMap((passage) => passage.sourceIndices));
  const seenDomains = new Set<string>();
  return (Array.isArray(result.sources) ? result.sources : []).flatMap((item) => {
    const index = Number(item.sourceIndex);
    const web = chunks[index]?.web;
    const low = amount(item.low); const midpoint = amount(item.midpoint); const high = amount(item.high);
    if (!Number.isInteger(index) || !cited.has(index) || !web?.uri || !/^https:\/\//.test(web.uri) || !suitableSource(web.uri, web.title) || low === null || midpoint === null || high === null || low > midpoint || midpoint > high) return [];
    const domain = sourceDomain(web.uri, web.title);
    if (!domain || seenDomains.has(domain)) return [];
    seenDomains.add(domain);
    return [{ id: `web-salary-${createHash("sha256").update(web.uri).digest("hex").slice(0, 16)}`, name: (web.title?.trim() || new URL(web.uri).hostname).slice(0, 160), url: web.uri, publishedOn: today, dateBasis: "accessed" as const, low, midpoint, high }];
  }).slice(0, 12);
}

function parseJson(text: string): ModelResult | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned) as ModelResult; } catch { return null; }
}

export async function researchSalaryMarket(input: ResearchInput, dependencies: { accessToken?: () => Promise<string | null>; request?: (url: string, init: RequestInit) => Promise<Response>; today?: () => string; models?: string[]; timeoutMs?: number } = {}): Promise<{ sources: SalarySource[]; currency: string; disclaimer: string; summary: string; queries: string[]; searchSuggestionHtml: string } | null> {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) return null;
  const token = dependencies.accessToken ? await dependencies.accessToken() : await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getAccessToken();
  if (!token) return null;
  const request = dependencies.request ?? fetch;
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? 95_000);
  try {
    for (const model of dependencies.models ?? ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash"]) {
      const endpoint = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/global/publishers/google/models/${model}:generateContent`;
      const response = await request(endpoint, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt(input) }] }], tools: [{ google_search: {} }], generationConfig: { maxOutputTokens: 3_500, thinkingConfig: { thinkingLevel: "LOW" } } }) });
      if (!response.ok) continue;
      const body = await response.json() as VertexResponse; const candidate = body.candidates?.[0];
      if (!candidate) continue;
      const passages = citedPassages(candidate);
      const chunks = candidate.groundingMetadata?.groundingChunks ?? [];
      if (!passages.length) continue;
      const extractionPrompt = `Convert ONLY these cited salary passages into annual gross cash ranges in ${input.currency}. Pick at most one comparable range per sourceIndex, matching ${input.role} and ${input.yearsExperience} years most closely. Do not add a salary not explicitly supported by a passage. Convert an explicitly stated local unit such as INR lakh/LPA to whole ${input.currency} units; do not convert currencies or turn total compensation into cash. Each sourceIndex must appear in its passage. If the cited text does not support a comparable salary range, return an empty array. Return compact JSON {"summary":"short limitations","sources":[{"sourceIndex":0,"low":1000000,"midpoint":1200000,"high":1400000}]}; use exact integers. DATA: ${JSON.stringify(passages)}`;
      const extraction = await request(endpoint, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: extractionPrompt }] }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: 3_000, thinkingConfig: { thinkingLevel: "LOW" } } }) });
      if (!extraction.ok) continue;
      const parsed = await extraction.json() as VertexResponse;
      const output = parseJson(parsed.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "");
      if (!output) continue;
      const today = dependencies.today?.() ?? new Date().toISOString().slice(0, 10);
      const sources = extractedSources(output, chunks, passages, today);
      if (!sources.length) continue;
      const summary = typeof output.summary === "string" ? output.summary.slice(0, 700) : "Current online salary evidence was found for this comparison.";
      return { sources, currency: input.currency, summary, queries: candidate.groundingMetadata?.webSearchQueries?.slice(0, 6) ?? [], searchSuggestionHtml: candidate.groundingMetadata?.searchEntryPoint?.renderedContent?.slice(0, 20_000) ?? "", disclaimer: `AI researched public online sources for a ${input.role} comparison in ${input.location}. Review the linked evidence before negotiating; ranges are indicative, not guaranteed offers.` };
    }
    return null;
  } catch { return null; } finally { clearTimeout(timeout); }
}
