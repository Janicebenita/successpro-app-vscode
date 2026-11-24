import type { AiTaskName } from "@successpro/contracts/ai";
import { GoogleAuth } from "google-auth-library";
import { setTimeout as wait } from "node:timers/promises";

export type ProviderKind = "vertex-gemini" | "gemini" | "openai-compatible";
export type ProviderConfig = { id: string; kind: ProviderKind; model: string; project?: string; apiKeyEnv?: string; baseUrl?: string; enabled: boolean; approvedForPersonalData: boolean; timeoutMs?: number; tasks?: AiTaskName[] };
export type ProviderResponse = { text: string; requestId?:string; inputTokens?: number; outputTokens?: number };
export type AiProvider = { id: string; model: string; generate(args: { task: AiTaskName; prompt: string; maximumOutputTokens: number; timeoutMs: number; signal?: AbortSignal; responseJsonSchema?: Record<string,unknown> }): Promise<ProviderResponse> };

export function geminiGenerationConfig(model: string, task: AiTaskName, maximumOutputTokens: number) {
  if (model.startsWith("gemini-3.")) {
    return {
      maxOutputTokens: maximumOutputTokens,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "LOW" },
    };
  }
  return {
    maxOutputTokens: maximumOutputTokens,
    responseMimeType: "application/json",
    temperature: 0.15,
    thinkingConfig: { thinkingBudget: 0 },
  };
}

// Covers credentials as well as network work; a provider cannot leave the caller waiting forever.
export async function boundedGeneration(provider: AiProvider, args: Parameters<AiProvider["generate"]>[0]) {
  if (args.timeoutMs <= 0) throw new Error("PROVIDER_DEADLINE_EXCEEDED");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      provider.generate({ ...args, signal: controller.signal }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("PROVIDER_DEADLINE_EXCEEDED")); }, args.timeoutMs); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

function isDailyQuotaExhausted(body: { error?: { details?: Array<{ violations?: Array<{ quotaId?: string }> }> } } | null) {
  return Array.isArray(body?.error?.details) && body.error.details.some((detail) =>
    Array.isArray(detail?.violations) && detail.violations.some((violation) =>
      /perday/i.test(violation?.quotaId ?? "")));
}

async function jsonRequest(url: string, init: RequestInit, timeoutMs: number, transientRetryDelays: number[] = [], skipDailyQuotaRetry = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
    signal.throwIfAborted();
    for (let attempt = 0; attempt <= transientRetryDelays.length; attempt++) {
      signal.throwIfAborted();
      const response = await fetch(url, { ...init, signal, cache: "no-store" });
      const body = await response.json().catch(() => null);
      if(response.ok)return body;
      console.error("PROVIDER_HTTP_ERROR:", response.status, JSON.stringify(body));
      const delay = transientRetryDelays[attempt];
      const dailyQuota = skipDailyQuotaRetry && response.status === 429 && isDailyQuotaExhausted(body);
      if (delay !== undefined && !dailyQuota && [429, 502, 503, 504].includes(response.status)) {
        await wait(delay, undefined, { signal });
        continue;
      }
      throw new Error(`PROVIDER_HTTP_${response.status}: ${JSON.stringify(body)}`);
    }
  } finally { clearTimeout(timer); }
}

function keyFor(config: ProviderConfig) {
  const key = config.apiKeyEnv ? process.env[config.apiKeyEnv] : undefined;
  if (!key) throw new Error("PROVIDER_KEY_MISSING");
  return key;
}

export function providerFromConfig(config: ProviderConfig): AiProvider {
  if (config.kind === "vertex-gemini") return {
    id: config.id, model: config.model,
    async generate({ task, prompt, maximumOutputTokens, timeoutMs, signal, responseJsonSchema }) {
      const project = config.project ?? process.env.GOOGLE_CLOUD_PROJECT;
      if (!project) throw new Error("VERTEX_PROJECT_MISSING");
      const location = process.env.VERTEX_AI_LOCATION || "global";
      const url = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(config.model)}:generateContent`;
      const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
      const headers = new Headers(await auth.getRequestHeaders(url));
      if (!headers.has("authorization")) throw new Error("VERTEX_IDENTITY_MISSING");
      headers.set("Content-Type", "application/json");
      signal?.throwIfAborted();
      const body = await jsonRequest(url, { method: "POST", signal, headers, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: {...geminiGenerationConfig(config.model, task, maximumOutputTokens),...(responseJsonSchema ? {responseJsonSchema}: {})} }) }, Math.min(config.timeoutMs ?? timeoutMs, timeoutMs));
      const text = body?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
      return { text, requestId:body?.responseId, inputTokens: body?.usageMetadata?.promptTokenCount, outputTokens: body?.usageMetadata?.candidatesTokenCount };
    },
  };
  if (config.kind === "gemini") return {
    id: config.id, model: config.model,
    async generate({ task, prompt, maximumOutputTokens, timeoutMs, signal, responseJsonSchema }) {
      const genConfig = { ...geminiGenerationConfig(config.model, task, maximumOutputTokens), ...(responseJsonSchema ? { responseJsonSchema } : {}) };
      const body = await jsonRequest(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`, { method: "POST", signal, headers: { "Content-Type": "application/json", "x-goog-api-key": keyFor(config) }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: genConfig }) }, Math.min(config.timeoutMs ?? timeoutMs, timeoutMs), task === "analyzeResume" ? [1_000, 3_000] : [1_000], task === "analyzeResume");
      const text = body?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
      return { text, requestId:body?.responseId, inputTokens: body?.usageMetadata?.promptTokenCount, outputTokens: body?.usageMetadata?.candidatesTokenCount };
    },
  };
  return {
    id: config.id, model: config.model,
    async generate({ prompt, maximumOutputTokens, timeoutMs, signal }) {
      const body = await jsonRequest(`${config.baseUrl ?? "https://api.groq.com/openai/v1"}/chat/completions`, { method: "POST", signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyFor(config)}` }, body: JSON.stringify({ model: config.model, temperature: 0.15, max_completion_tokens: maximumOutputTokens, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }) }, Math.min(config.timeoutMs ?? timeoutMs, timeoutMs));
      return { text: body?.choices?.[0]?.message?.content ?? "", inputTokens: body?.usage?.prompt_tokens, outputTokens: body?.usage?.completion_tokens };
    },
  };
}
