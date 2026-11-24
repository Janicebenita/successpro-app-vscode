import {z} from "zod";
import { createHash } from "node:crypto";
import { editorialStyle } from "../editorial-style";
import type { AiRunMeta, AiTaskInput, AiTaskName, AiTaskOutput } from "@successpro/contracts/ai";
import { aiTaskSchemas } from "@successpro/contracts/ai";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { loadAiConfig, usableProviderConfigs, type OrchestrationConfig } from "./config";
import { boundedGeneration, geminiGenerationConfig, providerFromConfig, type AiProvider } from "./providers";
import { aiTaskRegistry, deterministicAiFallback, promptForTask, resumeModelParameterIds } from "./task-registry";
import { recordProductEvent } from "@/lib/product-telemetry";
import { restoreSourceQuote, sanitizeAiOutput, validateAiSemantics } from "./semantic-validation";
import { reviewEvidence } from "./review-evidence";
import { getRatingAnchor } from "@successpro/domain";

type RunResult<T extends AiTaskName> = { output: AiTaskOutput<T>; meta: AiRunMeta };
type CacheRecord = { output: unknown; meta: AiRunMeta; expiresAt: string };
type RunOptions = {
  ownerId: string;
  sensitivity?: "personal" | "public";
  config?: OrchestrationConfig;
  providers?: AiProvider[];
  now?: Date;
  disablePersistence?: boolean;
  preferredLanguage?: string;
  generationBudgetMs?: number;
  onValidationFailure?: (failure: { task: AiTaskName; provider: string; stage: "initial" | "repair"; issues: Array<{ path: string; code: string; message: string }> }) => void;
};

const circuit = new Map<string, { failures: number; openUntil: number }>();

export function redact(value: unknown, key = ""): unknown {
  // Record identifiers are schema-owned references, not prose or contact data.
  // Applying phone detection here corrupts UUIDs and breaks role associations.
  if (["id", "roleId"].includes(key) && typeof value === "string") return value;
  if (["fullName", "email", "phone", "address", "recipientName"].includes(key)) return `[redacted ${key}]`;
  if (typeof value === "string") return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted email]")
    .replace(/(?<!\d)(?:\+?\d[\d .()-]{7,}\d)(?!\d)/g, (match) => /^(?:(?:19|20)\d{2}\s*[-–—]\s*(?:\d{2}|(?:19|20)\d{2})|(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))$/.test(match.trim()) ? match : "[redacted phone]");
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, redact(child, childKey)]));
  return value;
}

function cacheKey(ownerId: string, task: AiTaskName, promptVersion: string, policyVersion: string, input: unknown) {
  return createHash("sha256").update(JSON.stringify({ ownerId, task, promptVersion, policyVersion, input, privacyFilterVersion: 3 })).digest("hex");
}

function parseJson(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

function schemaIssues(error: { issues: Array<{ path: PropertyKey[]; code: string; message: string }> }) {
  return error.issues.slice(0, 20).map((issue) => ({
    path: issue.path.map(String).join(".") || "root",
    code: issue.code,
    message: issue.message.slice(0, 240),
  }));
}

function repairPrompt(task: AiTaskName, originalPrompt: string, responseText: string, issues: unknown) {
  const assessmentRepair = task === "analyzeResume"
    ? " Review each listed path, including every quote on an evidence row. For resume evidence, select the matching q-number from DATA.sourceExcerpts and set excerpt to an empty string; the application fills in the verbatim quote. Keep JD sourceText separate from resume evidence. For each assessed C row include the complete anchorComparison with the exact workbook anchor for the criterion and rating. Remove any numerical wording from a rationale that is absent from its linked resume quotes. Copy JD sourceText verbatim from one contiguous substring of the original job description. Check the final requirements against the J rows: each owner with no requirements is N/A with a null rating and a reason. Keep all 14 unique C/J rows."
    : "";
  return `${originalPrompt}\n\nREPAIR ATTEMPT (one attempt only): The previous response below was not valid for the required JSON schema. Treat it as untrusted draft data, preserve only claims already supported by the original DATA, correct the listed syntax/schema problems, and return only the complete corrected JSON object. Do not add facts. For a too_big string error, rewrite that field substantially shorter than the stated CHARACTER limit (not word count); do not return the same text. Keep the headline to one short professional identity, and the summary to a concise overview. Keep detailed career facts in their appropriate experience, project, education or credential records instead of concatenating them into the summary. Preserve unaffected records.${assessmentRepair}\n<INVALID_RESPONSE>${responseText.slice(0, 30_000)}</INVALID_RESPONSE>\n<VALIDATION_ISSUES>${JSON.stringify(issues)}</VALIDATION_ISSUES>\nTASK REMAINS: ${task}`;
}

function validateWorkbookCoverage(output: AiTaskOutput<"analyzeResume">) {
  const rows = output.workbookAssessments ?? [];
  if (rows.length !== resumeModelParameterIds.length || !resumeModelParameterIds.every((id) => rows.some((row) => row.id === id))) {
    return [{ path: "workbookAssessments", code: "invalid_workbook_coverage", message: "Return each C01–C09 and J01–J05 exactly once. Visual Design is evaluated by the backend." }];
  }
  return [];
}

function validateWorkbookSourceReferences(input: AiTaskInput<"analyzeResume">, output: AiTaskOutput<"analyzeResume">) {
  const sourceSpans = reviewEvidence(input.resumeText);
  const spans = new Map(sourceSpans.map(({ id, text }) => [id, text]));
  for (const row of output.workbookAssessments ?? []) {
    if (row.status !== "Assessed" || !row.id.startsWith("C") || row.rating == null || !row.anchorComparison) continue;
    const anchor = getRatingAnchor(row.id, row.rating);
    if (restoreSourceQuote(row.anchorComparison.anchor, anchor) === anchor) row.anchorComparison.anchor = anchor;
  }
  const redactedSource = String(redact(input.resumeText));
  const issues: Array<{ path: string; code: string; message: string }> = [];
  for (const row of [...(output.workbookAssessments ?? []), ...(output.jdRequirements ?? [])]) {
    if (row.status !== "Assessed" || !row.evidence) continue;
    const quotes = [row.evidence, ...(row.evidence.additionalExcerpts ?? [])];
    for (const quote of quotes) {
      let linkedSpan = quote.sourceExcerptId ? spans.get(quote.sourceExcerptId) : undefined;
      if (quote.excerpt.trim()) {
        if (linkedSpan) {
          const restored = restoreSourceQuote(quote.excerpt, linkedSpan);
          if (linkedSpan.includes(restored)) quote.excerpt = restored;
        }
        if (quote.sourceExcerptId && (!linkedSpan || (!linkedSpan.includes(quote.excerpt) && !String(redact(linkedSpan)).includes(quote.excerpt)))) {
          // A mismatched ID is recoverable only when the exact supplied quote
          // identifies one original resume span. Unsupported quotes still fail.
          const matches = sourceSpans.filter(({ text }) => text.includes(quote.excerpt));
          if (matches.length === 1) {
            quote.sourceExcerptId = matches[0].id;
            linkedSpan = matches[0].text;
          }
        } else if (!quote.sourceExcerptId) {
          quote.excerpt = restoreSourceQuote(quote.excerpt, input.resumeText);
        }
      }
      const supported = quote.sourceExcerptId
        ? typeof linkedSpan === "string" && (!quote.excerpt || linkedSpan.includes(quote.excerpt) || String(redact(linkedSpan)).includes(quote.excerpt))
        : Boolean(quote.excerpt.trim() && (input.resumeText.includes(quote.excerpt) || redactedSource.includes(quote.excerpt)));
      if (!supported && (quote.sourceExcerptId || quote !== row.evidence || row.rating !== 0 || !row.evidence.absenceSearch)) {
        issues.push({
          path: `${"owner" in row ? "jdRequirements" : "workbookAssessments"}.${row.id}.evidence`,
          code: "invalid_source_reference",
          message: "Choose the matching q-number from DATA.sourceExcerpts and set excerpt to an empty string so SuccessPro inserts the exact resume span. Do not cite the job requirement as candidate evidence.",
        });
      }
    }
  }
  return issues;
}

function validateProviderOutput<T extends AiTaskName>(task: T, input: AiTaskInput<T>, text: string) {
  try {
    const parsed = normalizeProfileOutput(task, parseJson(text));
    const validated = aiTaskSchemas[task].output.safeParse(parsed);
    if (!validated.success) return { success: false as const, issues: schemaIssues(validated.error) };
    if (task === "analyzeResume") {
      const review = validated.data as AiTaskOutput<"analyzeResume">;
      const issues = [...validateWorkbookCoverage(review), ...validateWorkbookSourceReferences(input as AiTaskInput<"analyzeResume">, review)];
      if (issues.length) return { success: false as const, issues: issues.slice(0, 20) };
    }
    const sanitized = sanitizeAiOutput(task, input, validated.data as AiTaskOutput<T>);
    const sanitizedSchema = aiTaskSchemas[task].output.safeParse(sanitized);
    if (!sanitizedSchema.success) return { success: false as const, issues: schemaIssues(sanitizedSchema.error) };
    const semanticIssues = validateAiSemantics(task, input, sanitizedSchema.data as AiTaskOutput<T>);
    return semanticIssues.length
      ? { success: false as const, issues: semanticIssues }
      : { success: true as const, data: sanitizedSchema.data };
  } catch {
    return { success: false as const, issues: [{ path: "root", code: "invalid_json", message: "Response is not valid JSON." }] };
  }
}

function normalizeProfileOutput(task: AiTaskName, value: unknown): unknown {
  if (task === "generateCoverLetter" && value && typeof value === "object") {
    const result = structuredClone(value) as { paragraphs?: unknown[] };
    if (Array.isArray(result.paragraphs)) {
      const seen = new Set<string>();
      result.paragraphs = result.paragraphs.filter((paragraph) => {
        if (typeof paragraph !== "string") return true;
        const key = paragraph.trim().replace(/\s+/g, " ").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
    }
    return result;
  }
  if (task === "analyzeResume" && value && typeof value === "object") {
    const result = structuredClone(value) as { topActions?: Array<{ originalExcerpt?: unknown }> };
    if (Array.isArray(result.topActions)) result.topActions.forEach((action) => {
      if (typeof action.originalExcerpt === "string" && action.originalExcerpt.length > 700) {
        const excerpt = action.originalExcerpt.slice(0, 680);
        action.originalExcerpt = excerpt.slice(0, excerpt.lastIndexOf(" ") > 0 ? excerpt.lastIndexOf(" ") : excerpt.length);
      }
    });
    return result;
  }
  if (!["extractResumeProfile", "transformResumeProfile"].includes(task) || !value || typeof value !== "object") return value;
  const output = structuredClone(value) as { profileDraft?: Record<string, unknown>; improvements?: Array<{ observed?: unknown }> };
  // This field is a displayed source excerpt, not the candidate's content.
  // Bound a copied source passage without discarding the entire career draft.
  if (Array.isArray(output.improvements)) output.improvements.forEach((improvement) => {
    if (typeof improvement.observed === "string" && improvement.observed.length > 1_500) {
      const excerpt = improvement.observed.slice(0, 1_400);
      const boundary = excerpt.lastIndexOf(" ");
      improvement.observed = `${excerpt.slice(0, boundary > 0 ? boundary : excerpt.length)}…`;
    }
  });
  const profile = output.profileDraft;
  if (!profile || typeof profile !== "object") return output;
  for (const field of ["experience", "education", "projects", "certifications", "awards", "publications", "volunteerExperience", "links"]) {
    const records = profile[field];
    if (!Array.isArray(records)) continue;
    records.forEach((record) => {
      if (!record || typeof record !== "object") return;
      // Printed resumes commonly omit the scheme; retain the visible domain/path
      // rather than rejecting an otherwise complete profile for a display URL.
      for (const key of ["link", "url", "credentialUrl"]) {
        const value = record[key];
        if (typeof value === "string" && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}(?:[/?#]|$)/i.test(value.trim())) record[key] = `https://${value.trim()}`;
      }
      // Missing optional details mean unknown; they are never invented.
      for (const key of ["startDate", "endDate", "date", "issuer", "description", "publisher"]) {
        if (record[key] === null || record[key] === undefined) record[key] = "";
      }
      if (field === "experience" && (record.achievements === null || record.achievements === undefined)) record.achievements = [];
    });
  }
  return output;
}

function providerAvailable(provider: AiProvider, now: Date) {
  const state = circuit.get(provider.id);
  return !state || state.openUntil <= now.valueOf();
}

function recordProviderResult(provider: AiProvider, success: boolean, now: Date) {
  if (success) { circuit.delete(provider.id); return; }
  const prior = circuit.get(provider.id) ?? { failures: 0, openUntil: 0 };
  const failures = prior.failures + 1;
  circuit.set(provider.id, { failures, openUntil: failures >= 3 ? now.valueOf() + 60_000 : 0 });
}

async function readCache(id: string, now: Date): Promise<CacheRecord | null> {
  const snapshot = await adminDb.collection("ai_cache").doc(id).get();
  const value = snapshot.data() as CacheRecord | undefined;
  return value && new Date(value.expiresAt) > now ? value : null;
}

export function isReusableAiCache(meta: AiRunMeta) {
  return meta.validation === "passed" && meta.provider !== "successpro-rules";
}

async function recordRun(ownerId: string, meta: AiRunMeta, cacheId: string, output: unknown, expiresAt: Date, cacheOutput = true) {
  const runRef = adminDb.collection("ai_runs").doc();
  const batch = adminDb.batch();
  batch.set(runRef, { id: runRef.id, ownerId, ...meta, cacheKey: cacheId, createdAt: FieldValue.serverTimestamp(), schemaVersion: 1 });
  if (cacheOutput) batch.set(adminDb.collection("ai_cache").doc(cacheId), { ownerId, output, meta, expiresAt: expiresAt.toISOString(), createdAt: FieldValue.serverTimestamp(), schemaVersion: 1 });
  await batch.commit();
}

export async function runAiTask<T extends AiTaskName>(task: T, rawInput: unknown, options: RunOptions): Promise<RunResult<T>> {
  const now = options.now ?? new Date();
  const input = aiTaskSchemas[task].input.parse(rawInput) as AiTaskInput<T>;
  const definition = aiTaskRegistry[task];
  const config = options.config ?? await loadAiConfig(task);
  const safeInput = redact(input) as AiTaskInput<T>;
  const id = cacheKey(options.ownerId, task, definition.promptVersion, config.policyVersion, safeInput);
  if (!options.disablePersistence) {
    const cached = await readCache(id, now).catch(() => null);
    if (cached && isReusableAiCache(cached.meta)) {
      const validated = aiTaskSchemas[task].output.safeParse(cached.output);
      if (validated.success
        && (task !== "analyzeResume" || validateWorkbookCoverage(validated.data as AiTaskOutput<"analyzeResume">).length === 0)
        && validateAiSemantics(task, input, validated.data as AiTaskOutput<T>).length === 0) {
        const meta = { ...cached.meta, cached: true };
        if (!options.disablePersistence) await recordProductEvent({ ownerId: options.ownerId, name: "ai_run_completed", outcome: meta.validation === "fallback" ? "fallback" : "success", durationMs: meta.latencyMs, source: "cache", task, provider: meta.provider, fallbackDepth: meta.fallbackDepth }).catch(() => undefined);
        return { output: editorialStyle(validated.data) as AiTaskOutput<T>, meta };
      }
    }
  }

  const providers = options.providers ?? usableProviderConfigs(config, options.sensitivity ?? "personal", task).map(providerFromConfig);
  const isDev = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";
  const hasConsent = options.sensitivity === "public" || isDev || (await adminDb.collection("registration_consents").doc(options.ownerId).get().then((snapshot) => snapshot.data()?.externalAiDataUseAccepted === true).catch(() => false));
  const consentedProviders = options.providers ? providers : hasConsent ? providers : [];
  // Allocate IDs before redaction so shortened contact spans cannot shift IDs.
  const evidence = task === "analyzeResume" ? redact(reviewEvidence((input as AiTaskInput<"analyzeResume">).resumeText)) as ReturnType<typeof reviewEvidence> : undefined;
  const promptInput = structuredClone(safeInput);
  if (task === "generateLinkedInMakeover") {
    // Stable short references avoid transcription errors in long, similar UUIDs.
    // They are resolved only against this request's profile after generation.
    (promptInput as AiTaskInput<"generateLinkedInMakeover">).profile.experience.forEach((role, index) => { role.id = `career_record_${index + 1}`; });
  }
  const prompt = `${promptForTask(task, promptInput, evidence)}\n\nOUTPUT LANGUAGE: ${options.preferredLanguage || "en"}. Preserve names, employers, qualifications, URLs, and quoted source text in their original form. Return only the required JSON shape.`;
  // Leave room within the server request limit for extraction and persistence.
  const maximumBudgetMs = task === "analyzeResume" ? 105_000 : 25_000;
  let responseJsonSchema:Record<string,unknown>|undefined;
  if(task === "analyzeResume"){
    const schema=z.toJSONSchema(aiTaskSchemas.analyzeResume.output) as unknown as { [key:string]:unknown; $schema?:unknown; required?:string[]; properties:Record<string,{minItems?:number;maxItems?:number;items:{properties:Record<string,{enum:string[]}>}}> };
    delete schema.$schema;delete schema.properties.criteria;
    schema.required=Array.from(new Set([...(schema.required ?? []),"workbookAssessments","jdRequirements","meaningfulJd"]));
    schema.properties.workbookAssessments.items.properties.id.enum = resumeModelParameterIds;
    schema.properties.topActions.minItems=(input as AiTaskInput<"analyzeResume">).resumeText.length>=3000?3:1;
    // Gemini enforces a supported structural subset; Zod retains all exact bounds.
    const compact=(value:unknown):unknown=>{
      if(Array.isArray(value))return value.map(compact);
      if(!value || typeof value !== "object")return value;
      const keep=new Set(["type","properties","required","items","enum","anyOf"]);
      return Object.fromEntries(Object.entries(value).filter(([key])=>keep.has(key)).map(([key,child])=>[key,key === "properties" ? Object.fromEntries(Object.entries(child as Record<string,unknown>).map(([name,node])=>[name,compact(node)])) : compact(child)]));
    };
    const structural=compact(schema) as {properties:Record<string,{minItems?:number}>};
    structural.properties.topActions.minItems=(input as AiTaskInput<"analyzeResume">).resumeText.length>=3000?3:1;
    responseJsonSchema=structural as unknown as Record<string,unknown>;
  }
  const generationBudgetMs = Math.min(maximumBudgetMs, Math.max(0, options.generationBudgetMs ?? maximumBudgetMs));
  const generationDeadline = Date.now() + generationBudgetMs;
  for (let index = 0; index < consentedProviders.length; index += 1) {
    if (Date.now() >= generationDeadline) break;
    const provider = consentedProviders[index];
    if (!providerAvailable(provider, now)) continue;
    const started = Date.now();
    const hasFallback = consentedProviders.slice(index + 1).some((candidate) => providerAvailable(candidate, now));
    const remainingMs = generationDeadline - started;
    // Reserve time for fallback even when the initial assessment request stalls.
    const fallbackReserveMs = task === "analyzeResume" && hasFallback
      ? Math.min(65_000, Math.floor(remainingMs * 0.62))
      : 0;
    const attemptDeadline = generationDeadline - fallbackReserveMs;
    try {
      const response = await boundedGeneration(provider, { task, prompt, responseJsonSchema, maximumOutputTokens: definition.maximumOutputTokens, timeoutMs: Math.min(definition.timeoutMs, attemptDeadline - Date.now()) });
      let validated = validateProviderOutput(task, input, response.text);
      let repairAttempts = 0;
      if (!validated.success) {
        console.warn(JSON.stringify({ event: "ai_output_validation_failed", task, provider: provider.id, stage: "initial", issues: validated.issues.map(({ path, code }) => ({ path, code })) }));
        options.onValidationFailure?.({ task, provider: provider.id, stage: "initial", issues: validated.issues.map(({ path, code, message }) => ({ path, code, message })) });
        // A primary repair must not consume the next provider's only chance.
        // Use only this provider’s share of the overall deadline for repair.
        const repairDeadline = task === "analyzeResume" ? attemptDeadline : generationDeadline - (hasFallback ? Math.min(20_000, definition.timeoutMs) : 0);
        const repairBudget = repairDeadline - Date.now();
        if (repairBudget <= 0) throw new Error("PROVIDER_REPAIR_BUDGET_EXHAUSTED");
        repairAttempts = 1;
        const repaired = await boundedGeneration(provider, { task, responseJsonSchema, prompt: repairPrompt(task, prompt, response.text, validated.issues), maximumOutputTokens: definition.maximumOutputTokens, timeoutMs: Math.min(definition.timeoutMs, repairBudget) });
        validated = validateProviderOutput(task, input, repaired.text);
        if (!validated.success) {
          console.warn(JSON.stringify({ event: "ai_output_validation_failed", task, provider: provider.id, stage: "repair", issues: validated.issues.map(({ path, code }) => ({ path, code })) }));
          options.onValidationFailure?.({ task, provider: provider.id, stage: "repair", issues: validated.issues.map(({ path, code, message }) => ({ path, code, message })) });
        }
      }
      if (!validated.success) throw new Error("PROVIDER_SCHEMA_INVALID");
      recordProviderResult(provider, true, now);
      const meta: AiRunMeta = { task, provider: provider.id, model: provider.model, promptVersion: definition.promptVersion, policyVersion: config.policyVersion, fallbackDepth: index, latencyMs: Date.now() - started, cached: false, validation: "passed", repairAttempts, ...(response.requestId ? {requestId:response.requestId}:{}), ...(Number.isFinite(response.inputTokens) ? { inputTokens: Math.max(0, Math.min(10_000_000, Math.round(response.inputTokens!))) } : {}), ...(Number.isFinite(response.outputTokens) ? { outputTokens: Math.max(0, Math.min(10_000_000, Math.round(response.outputTokens!))) } : {}) };
      meta.generatedAt=new Date().toISOString();
      const providerKind=config.providers.find(p=>p.id===provider.id)?.kind;
      meta.generationParameters=options.providers ? {settings:"injected-provider-not-reported"} : providerKind==="gemini" || providerKind==="vertex-gemini" ? geminiGenerationConfig(provider.model,task,definition.maximumOutputTokens) : {temperature:0.15,max_completion_tokens:definition.maximumOutputTokens};
      if (!options.disablePersistence) await recordRun(options.ownerId, meta, id, validated.data, new Date(now.valueOf() + config.cacheTtlHours * 3_600_000)).catch(() => undefined);
      if (!options.disablePersistence) await recordProductEvent({ ownerId: options.ownerId, name: "ai_run_completed", outcome: "success", durationMs: meta.latencyMs, source: "provider", task, provider: meta.provider, fallbackDepth: meta.fallbackDepth }).catch(() => undefined);
      return { output: editorialStyle(validated.data) as AiTaskOutput<T>, meta };
    } catch (error) {
      recordProviderResult(provider, false, now);
      console.warn("ai_provider_attempt_failed", { task, provider: provider.id, model: provider.model, code: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN", fallbackDepth: index });
    }
  }

  const started = Date.now();
  const output = deterministicAiFallback(task, input);
  const meta: AiRunMeta = { task, provider: "successpro-rules", model: "deterministic-fallback-v1", promptVersion: definition.promptVersion, policyVersion: config.policyVersion, fallbackDepth: consentedProviders.length, latencyMs: Date.now() - started, cached: false, validation: "fallback", repairAttempts: 0 };
  meta.generatedAt=new Date().toISOString();meta.generationParameters={};
  if (!options.disablePersistence) await recordRun(options.ownerId, meta, id, output, new Date(now.valueOf() + config.cacheTtlHours * 3_600_000), false).catch(() => undefined);
  if (!options.disablePersistence) await recordProductEvent({ ownerId: options.ownerId, name: "ai_run_completed", outcome: "fallback", durationMs: meta.latencyMs, source: "rules", task, provider: meta.provider, fallbackDepth: meta.fallbackDepth }).catch(() => undefined);
  return { output: editorialStyle(output), meta };
}

export function resetAiCircuitBreakersForTests() { circuit.clear(); }
