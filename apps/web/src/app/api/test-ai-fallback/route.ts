import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { loadAiConfig } from "@/lib/ai/config";
import { runAiTask } from "@/lib/ai/orchestrator";
import { providerFromConfig } from "@/lib/ai/providers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" || !(await getSessionUser())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const simulatePrimaryFailure = url.searchParams.get("simulateFailure") === "true";

  const config = await loadAiConfig();
  const primaryModel = config.providers[0]?.model ?? "gemini-3.5-flash-lite";
  const fallbackModel = config.providers[1]?.model ?? "gemini-3.5-flash";

  // If simulatePrimaryFailure is requested, inject a broken primary provider
  // to directly prove that the secondary model takes over seamlessly!
  let providersToUse = config.providers.map(providerFromConfig);
  if (simulatePrimaryFailure) {
    providersToUse = [
      {
        id: "simulated-failing-primary",
        model: "simulated-offline-primary-model",
        async generate() {
          throw new Error("Simulated 503 Service Unavailable / Rate Limit Exceeded on Primary Model");
        },
      },
      providersToUse[1] || providerFromConfig({
        id: "local-gemini-fallback",
        kind: "gemini",
        model: fallbackModel,
        apiKeyEnv: "GEMINI_API_KEY",
        enabled: true,
        approvedForPersonalData: true,
        timeoutMs: 120_000,
      }),
    ];
  }

  const startedAt = Date.now();
  try {
    const result = await runAiTask(
      "explainResumeIssue",
      {
        factor: "Measurable Impact & Metrics",
        evidence: ["Increased regional revenue by 32% year-over-year."],
        issue: "Add specific dollar bounds or baseline context.",
        targetRole: "Strategy & Transformation Director",
      },
      {
        ownerId: "fallback-diagnostic-test",
        sensitivity: "public",
        providers: providersToUse,
        disablePersistence: true,
      }
    );

    const totalElapsedMs = Date.now() - startedAt;

    return NextResponse.json({
      status: "success",
      configuredPrimary: primaryModel,
      configuredFallback: fallbackModel,
      simulationMode: simulatePrimaryFailure,
      executedProvider: result.meta.provider,
      executedModel: result.meta.model,
      fallbackDepth: result.meta.fallbackDepth,
      isFallbackTriggered: result.meta.fallbackDepth > 0,
      latencyMs: result.meta.latencyMs,
      totalElapsedMs,
      validation: result.meta.validation,
      sampleAiGuidance: result.output.suggestion,
      explanation:
        result.meta.fallbackDepth === 0
          ? `Primary model (${result.meta.model}) handled the request successfully.`
          : `Fallback SUCCESS: Primary model was bypassed/failed, and secondary model (${result.meta.model}) seamlessly completed the task!`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        configuredPrimary: primaryModel,
        configuredFallback: fallbackModel,
      },
      { status: 500 }
    );
  }
}
