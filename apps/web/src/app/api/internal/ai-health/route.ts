import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { verifyInternalAutomation } from "@/lib/internal-automation";
import { loadAiConfig, usableProviderConfigs } from "@/lib/ai/config";
import { providerFromConfig } from "@/lib/ai/providers";

export async function POST(request: Request) {
  if (!(await verifyInternalAutomation(request))) return NextResponse.json({ error: "Unauthorized automation request." }, { status: 401 });
  const config = await loadAiConfig();
  const providers = usableProviderConfigs(config, "public");
  const results = [];
  for (const providerConfig of providers) {
    const started = Date.now();
    try {
      const response = await providerFromConfig(providerConfig).generate({ task: "supportResponse", prompt: "Return only this JSON object exactly: {\"answer\":\"healthy\",\"articleUrls\":[],\"needsHuman\":false,\"escalationReason\":\"\"}", maximumOutputTokens: 80, timeoutMs: 8_000 });
      const parsed = JSON.parse(response.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
      if (parsed?.answer !== "healthy" || !Array.isArray(parsed.articleUrls) || parsed.needsHuman !== false) throw new Error("INVALID_HEALTH_RESPONSE");
      results.push({ id: providerConfig.id, model: providerConfig.model, healthy: true, latencyMs: Date.now() - started });
    } catch (error) {
      results.push({ id: providerConfig.id, model: providerConfig.model, healthy: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.message.slice(0, 80) : "UNKNOWN" });
    }
  }
  const healthy = results.filter((result) => result.healthy).length;
  const reference = adminDb.collection("ai_provider_health").doc();
  const record = { id: reference.id, policyVersion: config.policyVersion, configuredProviders: providers.length, healthyProviders: healthy, results, checkedAt: FieldValue.serverTimestamp(), schemaVersion: 1 };
  const batch = adminDb.batch(); batch.set(reference, record); batch.set(adminDb.collection("system_status").doc("ai_provider_health"), record); await batch.commit();
  return NextResponse.json({ ok: true, providerAvailable: healthy > 0, fallbackReady: true, policyVersion: config.policyVersion, configuredProviders: providers.length, healthyProviders: healthy, results });
}
