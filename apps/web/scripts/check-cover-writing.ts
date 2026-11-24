import { execFileSync } from "node:child_process";
import { baseProfile } from "./generate-document-goldens";
import { runAiTask, resetAiCircuitBreakersForTests } from "../src/lib/ai/orchestrator";
import type { AiProvider } from "../src/lib/ai/providers";

const token = execFileSync(process.env.GCLOUD_BIN!, ["auth", "print-access-token"], { encoding: "utf8" }).trim();
const project = "successpro-staging-1706786b";
const provider: AiProvider = { id: "cover-qa", model: "gemini-2.5-flash", async generate({ prompt, maximumOutputTokens, signal }) {
  const response = await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/gemini-2.5-flash:generateContent`, { method: "POST", signal, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: .15, maxOutputTokens: maximumOutputTokens, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } }) });
  if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
  const body = await response.json();
  const text = body.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
  if (process.env.QA_SYNTHETIC_DETAIL === "1") console.log(JSON.stringify({ syntheticResponse: text }));
  return { text };
} };
for (const tone of ["warm", "direct", "executive"] as const) {
  if (process.argv[2] && process.argv[2] !== tone) continue;
  resetAiCircuitBreakersForTests();
  const result = await runAiTask("generateCoverLetter", { profile: baseProfile, targetRole: "Product Director", company: "Example Company", jobDescription: "Lead product strategy, customer research, analytics and cross-functional teams to improve customer outcomes.", tone }, { ownerId: "synthetic-cover-qa", providers: [provider], disablePersistence: true, config: { policyVersion: "qa", cacheTtlHours: 0, providers: [] }, onValidationFailure: (failure) => console.log(JSON.stringify(failure)) });
  console.log(JSON.stringify({ tone, validation: result.meta.validation, words: result.output.paragraphs.join(" ").split(/\s+/).length, paragraphs: result.output.paragraphs.length, repairs: result.meta.repairAttempts }));
  if (result.meta.validation !== "passed") process.exitCode = 1;
}
