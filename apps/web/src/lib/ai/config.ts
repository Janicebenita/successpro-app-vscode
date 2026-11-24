import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import type { ProviderConfig } from "./providers";
import type { AiTaskName } from "@successpro/contracts/ai";

const providerConfigSchema = z.object({ id: z.string().min(1), kind: z.enum(["vertex-gemini", "gemini", "openai-compatible"]), model: z.string().min(1), project: z.string().trim().min(1).optional(), apiKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]+$/).optional(), baseUrl: z.string().url().optional(), enabled: z.boolean(), approvedForPersonalData: z.boolean(), timeoutMs: z.number().int().min(1_000).max(120_000).optional(), tasks: z.array(z.enum(["extractResumeProfile", "transformResumeProfile", "analyzeResume", "explainResumeIssue", "rewriteResumeSection", "generateCoverLetter", "generateLinkedInMakeover", "careerGapPlan", "recommendUpskilling", "salaryNarrative", "researchJobs", "supportResponse"])).optional() });
const orchestrationConfigSchema = z.object({ policyVersion: z.string().min(1), providers: z.array(providerConfigSchema).max(8), cacheTtlHours: z.number().int().min(0).max(720).default(24) });
export type OrchestrationConfig = z.infer<typeof orchestrationConfigSchema>;

export const safeDefaultAiConfig: OrchestrationConfig = {
  policyVersion: "vertex-quality-lifecycle-v10-factual-anchors",
  cacheTtlHours: 24,
  providers: [
    { id: "vertex-lifecycle-primary", kind: "vertex-gemini", model: "gemini-3.6-flash", enabled: true, approvedForPersonalData: true, timeoutMs: 60_000 },
    { id: "vertex-lifecycle-fallback", kind: "vertex-gemini", model: "gemini-3.7-flash", enabled: true, approvedForPersonalData: true, timeoutMs: 45_000 },
    { id: "vertex-established-fallback", kind: "vertex-gemini", model: "gemini-3.5-flash", enabled: true, approvedForPersonalData: true, timeoutMs: 45_000 },
  ],
};

export async function loadAiConfig(task?: AiTaskName): Promise<OrchestrationConfig> {
  const resumeVertexProject = process.env.RESUME_CONTENT_VERTEX_PROJECT?.trim();
  if (task === "analyzeResume" && resumeVertexProject) {
    return {
      policyVersion: "resume-content-vertex-v1",
      cacheTtlHours: 24,
      providers: [
        { id: "resume-vertex-primary", kind: "vertex-gemini", project: resumeVertexProject, model: "gemini-3.5-flash-lite", enabled: true, approvedForPersonalData: true, timeoutMs: 60_000, tasks: ["analyzeResume"] },
        { id: "resume-vertex-fallback", kind: "vertex-gemini", project: resumeVertexProject, model: "gemini-3.5-flash", enabled: true, approvedForPersonalData: true, timeoutMs: 65_000, tasks: ["analyzeResume"] },
      ],
    };
  }
  if (process.env.RESUME_AI_PROVIDER === "gemini" && process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL) {
    const primaryModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const backupModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash";
    return {
      policyVersion: "local-gemini-ats-ai-hybrid-v1",
      cacheTtlHours: 24,
      providers: [
        {
          id: "local-gemini",
          kind: "gemini",
          model: primaryModel,
          apiKeyEnv: "GEMINI_API_KEY",
          enabled: true,
          approvedForPersonalData: true,
          timeoutMs: 60_000,
        },
        {
          id: "local-gemini-fallback",
          kind: "gemini",
          model: backupModel,
          apiKeyEnv: "GEMINI_API_KEY",
          enabled: true,
          approvedForPersonalData: true,
          timeoutMs: 65_000,
        },
      ],
    };
  }
  try {
    const snapshot = await adminDb.collection("system_config").doc("ai_orchestration").get();
    const parsed = orchestrationConfigSchema.safeParse(snapshot.data());
    if (parsed.success) return parsed.data;
  } catch { /* Firestore may be unavailable in local unit tests. */ }
  const env = process.env.AI_PROVIDER_CHAIN_JSON;
  if (env) {
    try {
      const parsed = orchestrationConfigSchema.safeParse(JSON.parse(env));
      if (parsed.success) return parsed.data;
    } catch { /* A malformed override must not take every writing endpoint down. */ }
  }
  return safeDefaultAiConfig;
}

export function usableProviderConfigs(config: OrchestrationConfig, sensitivity: "personal" | "public", task?: AiTaskName): ProviderConfig[] {
  return config.providers.filter((provider) => provider.enabled && (!task || !provider.tasks || provider.tasks.includes(task)) && (provider.kind === "vertex-gemini" || Boolean(provider.apiKeyEnv && process.env[provider.apiKeyEnv])) && (sensitivity === "public" || provider.approvedForPersonalData));
}
