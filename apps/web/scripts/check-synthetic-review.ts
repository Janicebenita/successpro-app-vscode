import { execFileSync } from "node:child_process";
import { runAiTask } from "../src/lib/ai/orchestrator";
import type { AiProvider } from "../src/lib/ai/providers";

const ownerId = process.argv[2];
if (!/^qa-journey-[a-f0-9-]+$/.test(ownerId ?? "")) throw new Error("Synthetic QA identity required");
const project = "successpro-staging-1706786b";
const token = execFileSync(process.env.GCLOUD_BIN!, ["auth", "print-access-token"], { encoding: "utf8" }).trim();
const query = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:runQuery`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "analyses" }], where: { fieldFilter: { field: { fieldPath: "ownerId" }, op: "EQUAL", value: { stringValue: ownerId } } }, limit: 1 } }) });
if (!query.ok) throw new Error(`Synthetic query failed: ${query.status}`);
const rows = await query.json();
function decode(value: Record<string, unknown>): unknown {
  if (value.mapValue) return Object.fromEntries(Object.entries((value.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields ?? {}).map(([key, child]) => [key, decode(child)]));
  if (value.arrayValue) return ((value.arrayValue as { values?: Record<string, unknown>[] }).values ?? []).map(decode);
  if (value.integerValue !== undefined) return Number(value.integerValue);
  return value.stringValue ?? value.doubleValue ?? value.booleanValue ?? null;
}
if (!rows[0]?.document) throw new Error("Synthetic analysis not found");
const record = decode({ mapValue: { fields: rows[0].document.fields } }) as { input: { text: string }; result: unknown };
const responses: string[] = [];
const provider: AiProvider = { id: "qa-review", model: "gemini-2.5-flash", async generate({ prompt, maximumOutputTokens, signal }) {
  const response = await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/gemini-2.5-flash:generateContent`, { method: "POST", signal, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: .15, maxOutputTokens: maximumOutputTokens, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } }) });
  if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
  const body = await response.json();
  const text = body.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
  responses.push(text);
  return { text };
} };
const result = await runAiTask("analyzeResume", { resumeText: record.input.text, deterministicReview: record.result }, { ownerId, providers: [provider], disablePersistence: true, config: { policyVersion: "qa-review", cacheTtlHours: 0, providers: [] }, onValidationFailure: (failure) => console.log(JSON.stringify(failure)) });
console.log(JSON.stringify({ validation: result.meta.validation, repairAttempts: result.meta.repairAttempts, actions: result.output.topActions.length }));
if (result.meta.validation !== "passed") {
  console.log(JSON.stringify({ syntheticSource: record.input.text, syntheticResponses: responses }));
  process.exitCode = 1;
}
