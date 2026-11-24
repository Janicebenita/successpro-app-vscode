import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runAiTask, resetAiCircuitBreakersForTests } from "../src/lib/ai/orchestrator";
import { aiTaskRegistry } from "../src/lib/ai/task-registry";
import { reviewEvidence } from "../src/lib/ai/review-evidence";
import type { AiProvider } from "../src/lib/ai/providers";
import { analyzeResume, extractCanonicalProfile } from "@successpro/domain";
import { canonicalProfileSchema } from "@successpro/contracts";

const root = path.resolve("../../tmp/sample-resume-qa");
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
if (manifest.results.length !== 10) throw new Error("Complete the ten-file extraction run first.");
const project = process.env.GOOGLE_CLOUD_PROJECT;
if (project !== "successpro-staging-1706786b" || !process.env.GCLOUD_BIN) throw new Error("Explicit staging project and gcloud path required.");
const requestedModel = process.argv.find((argument) => argument.startsWith("--model="))?.slice("--model=".length) ?? "gemini-3.6-flash";
if (!/^(?:gemini-2\.5-flash|gemini-3\.[5678]-flash|gemini-3\.5-flash-lite)$/.test(requestedModel)) throw new Error("Unsupported QA model");
const qaModelSuffix = requestedModel === "gemini-2.5-flash" ? "" : `-${requestedModel}`;
if (requestedModel.startsWith("gemini-3.")) aiTaskRegistry.analyzeResume.timeoutMs = 60_000;
if (requestedModel.startsWith("gemini-3.")) aiTaskRegistry.transformResumeProfile.timeoutMs = 45_000;
if (requestedModel.startsWith("gemini-3.")) {
  aiTaskRegistry.generateCoverLetter.timeoutMs = 40_000;
  aiTaskRegistry.generateCoverLetter.maximumOutputTokens = 6_000;
  aiTaskRegistry.generateLinkedInMakeover.timeoutMs = 45_000;
  aiTaskRegistry.generateLinkedInMakeover.maximumOutputTokens = 9_000;
}
const token = execFileSync(process.env.GCLOUD_BIN, ["auth", "print-access-token"], { encoding: "utf8" }).trim();
const providerResponses: string[] = [];
const provider: AiProvider = { id: "sample-qa-vertex", model: requestedModel, async generate({ task, prompt, maximumOutputTokens, signal }) {
  const generationConfig = this.model.startsWith("gemini-3.")
    ? { maxOutputTokens: maximumOutputTokens, responseMimeType: "application/json", thinkingConfig: { thinkingLevel: task === "analyzeResume" ? "MEDIUM" : "LOW" } }
    : { temperature: .15, maxOutputTokens: maximumOutputTokens, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } };
  const response = await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${this.model}:generateContent`, { method: "POST", signal, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig }) });
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    console.log(JSON.stringify({ event: "qa_provider_http", model: this.model, status: response.status, code: problem?.error?.status, detail: String(problem?.error?.message ?? "").slice(0, 500) }));
    throw new Error(`PROVIDER_HTTP_${response.status}`);
  }
  const body = await response.json();
  if (body.candidates?.[0]?.finishReason !== "STOP") console.log(JSON.stringify({ event: "qa_provider_finish", model: this.model, task, reason: body.candidates?.[0]?.finishReason, outputTokens: body.usageMetadata?.candidatesTokenCount, thinkingTokens: body.usageMetadata?.thoughtsTokenCount }));
  const text = body.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
  providerResponses.push(text);
  // Diagnose blocked output without logging resume text or contact details.
  try {
    const visit = (value: unknown, field = "output") => {
      if (typeof value === "string" && /\[redacted\s+[^\]]+\]/i.test(value)) console.log(JSON.stringify({ event: "qa_placeholder", field, placeholders: value.match(/\[redacted\s+[^\]]+\]/gi) }));
      else if (Array.isArray(value)) value.forEach((child, index) => visit(child, `${field}.${index}`));
      else if (value && typeof value === "object") Object.entries(value).forEach(([key, child]) => visit(child, `${field}.${key}`));
    };
    visit(JSON.parse(text));
  } catch { /* Normal orchestration reports invalid JSON. */ }
  return { text };
} };
const providers = process.argv.includes("--vertex-chain")
  ? requestedModel.startsWith("gemini-3.")
    ? [provider, ...["gemini-3.7-flash", "gemini-3.5-flash"].filter((model) => model !== requestedModel).map((model, index) => ({ ...provider, id: `sample-qa-vertex-fallback-${index + 1}`, model }))]
    : [provider, { ...provider, id: "sample-qa-vertex-lite", model: "gemini-2.5-flash-lite" }]
  : [provider];
if (process.argv[2] === "synthetic-long-review") {
  const resumeText = ["Synthetic Candidate", "Professional Summary", "Operations and product leader with cross-functional planning experience.",
    ...Array.from({ length: 10 }, (_, role) => [
      `Experience: Portfolio Lead ${role + 1} | Example Organization ${role + 1} | 2014-2024`,
      ...Array.from({ length: 100 }, (_, bullet) => `Coordinated source-backed planning, team communication, delivery reviews, and customer research for portfolio ${role + 1}, workstream ${bullet + 1}.`),
    ]).flat(), "Education", "Bachelor of Business Administration | Example University | 2013", "Skills", "Operations planning, stakeholder communication, customer research, project delivery"].join("\n");
  const words = resumeText.match(/\S+/g)?.length ?? 0;
  if (words < 10_000 || resumeText.length > 200_000) throw new Error("Synthetic review fixture is outside the supported long-resume envelope");
  const review = await runAiTask("analyzeResume", { resumeText, deterministicReview: analyzeResume({ text: resumeText, targetKeywords: [], documentSignals: { pageCount: 10 } }) }, { ownerId: "private-local-synthetic-long", providers, disablePersistence: true, config: { policyVersion: "synthetic-long-review", cacheTtlHours: 0, providers: [] }, onValidationFailure: (failure) => console.log(JSON.stringify({ event: "long_review_validation", failure })) });
  console.log(JSON.stringify({ id: "synthetic-long-review", words, characters: resumeText.length, evidenceSpans: reviewEvidence(resumeText).length, validation: review.meta.validation, provider: review.meta.provider, actions: review.output.topActions.length, seconds: Math.round(review.meta.latencyMs / 1000) }));
  if (review.meta.validation !== "passed") process.exitCode = 1;
  process.exit();
}
for (const entry of manifest.results.sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id))) {
  if (process.argv[2] && !["--lifecycle", "all", entry.id].includes(process.argv[2])) continue;
  const record = JSON.parse(await readFile(path.join(root, `${entry.id}.json`), "utf8"));
  const failures: unknown[] = [];
  providerResponses.length = 0;
  // Independent fixtures must each exercise the provider, not inherit an
  // open circuit from a preceding malformed-response test case.
  resetAiCircuitBreakersForTests();
  if (process.argv.includes("--writing-from-transform")) {
    const transformed = JSON.parse(await readFile(path.join(root, `${entry.id}${qaModelSuffix}-transform-retest.json`), "utf8"));
    if (transformed.sourceHash !== entry.sha256 || transformed.transformed?.meta.validation !== "passed") throw new Error("A matching validated transformation is required");
    const profile = canonicalProfileSchema.parse(transformed.transformed.output.profileDraft);
    const options = { ownerId: `private-local-${entry.id}`, providers, disablePersistence: true, config: { policyVersion: "sample-writing-retest", cacheTtlHours: 0, providers: [] }, onValidationFailure: (failure: unknown) => failures.push(failure) };
    const cover = await runAiTask("generateCoverLetter", { profile, targetRole: profile.currentRole || profile.headline, company: "Example Employer", jobDescription: "", tone: "executive" }, options);
    const linkedIn = await runAiTask("generateLinkedInMakeover", { profile, targetRole: profile.currentRole || profile.headline, currentProfileText: "" }, options);
    await writeFile(path.join(root, `${entry.id}${qaModelSuffix}-writing-retest.json`), JSON.stringify({ checkedAt: new Date().toISOString(), sourceHash: entry.sha256, cover, linkedIn, failures, providerResponses, factualVerification: "pending-original-comparison" }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ id: entry.id, cover: cover.meta.validation, linkedIn: linkedIn.meta.validation }));
    if (cover.meta.validation !== "passed" || linkedIn.meta.validation !== "passed") process.exitCode = 1;
    continue;
  }
  if (process.argv.includes("--review")) {
    const review = await runAiTask("analyzeResume", { resumeText: record.sourceText, deterministicReview: analyzeResume({ text: record.sourceText, targetKeywords: [], documentSignals: {} }) }, { ownerId: `private-local-${entry.id}`, providers, disablePersistence: true, config: { policyVersion: "sample-review-retest", cacheTtlHours: 0, providers: [] }, onValidationFailure: (failure: unknown) => failures.push(failure) });
    await writeFile(path.join(root, `${entry.id}${qaModelSuffix}-review-retest.json`), JSON.stringify({ checkedAt: new Date().toISOString(), sourceHash: entry.sha256, review, failures, providerResponses, factualVerification: "pending-original-comparison" }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ id: entry.id, review: review.meta.validation, actions: review.output.topActions.length }));
    if (review.meta.validation !== "passed") process.exitCode = 1;
    continue;
  }
  if (process.argv.includes("--linkedin")) {
    const prior = JSON.parse(await readFile(path.join(root, `${entry.id}-lifecycle.json`), "utf8"));
    if (prior.sourceHash !== entry.sha256 || prior.transformed?.meta.validation !== "passed") throw new Error("A matching validated transformed fixture is required");
    const profile = canonicalProfileSchema.parse(prior.transformed.output.profileDraft);
    const result = await runAiTask("generateLinkedInMakeover", { profile, targetRole: profile.currentRole || profile.headline, currentProfileText: "" }, { ownerId: `private-local-${entry.id}`, providers: [provider], disablePersistence: true, config: { policyVersion: "sample-linkedin", cacheTtlHours: 0, providers: [] }, onValidationFailure: (failure) => failures.push(failure) });
    await writeFile(path.join(root, `${entry.id}-linkedin-retest.json`), JSON.stringify({ checkedAt: new Date().toISOString(), sourceHash: entry.sha256, result, failures, factualVerification: "pending" }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ id: entry.id, linkedin: result.meta.validation, skills: result.output.skills.length, roles: result.output.experience.length }));
    if (result.meta.validation !== "passed") process.exitCode = 1;
    continue;
  }
  if (process.argv.includes("--lifecycle") || process.argv.includes("--transform")) {
    const extracted = JSON.parse(await readFile(path.join(root, qaModelSuffix ? `${entry.id}${qaModelSuffix}-extract-retest.json` : `${entry.id}-ai.json`), "utf8"));
    if (extracted.sourceHash !== entry.sha256 || extracted.result.meta.validation !== "passed") { console.log(JSON.stringify({ id: entry.id, stage: "lifecycle", result: "blocked-extraction" })); process.exitCode = 1; continue; }
    const options = { ownerId: `private-local-${entry.id}`, providers, disablePersistence: true, config: { policyVersion: "sample-lifecycle", cacheTtlHours: 0, providers: [] }, onValidationFailure: (failure: unknown) => failures.push(failure) };
    try {
      const transformed = await runAiTask("transformResumeProfile", { resumeText: record.sourceText, deterministicDraft: extracted.result.output.profileDraft, jobDescription: process.argv.includes("--job-tailor") ? `Seeking ${extracted.result.output.profileDraft.currentRole || "a professional"} with evidence-backed collaboration, delivery, and measurable outcomes.` : "" }, options);
      if (process.argv.includes("--transform")) {
        await writeFile(path.join(root, `${entry.id}${qaModelSuffix}${process.argv.includes("--job-tailor") ? "-job-tailored" : ""}-transform-retest.json`), JSON.stringify({ checkedAt: new Date().toISOString(), sourceHash: entry.sha256, transformed, failures, providerResponses, factualVerification: "pending" }, null, 2), { mode: 0o600 });
        console.log(JSON.stringify({ id: entry.id, transform: transformed.meta.validation }));
        if (transformed.meta.validation !== "passed") process.exitCode = 1;
        continue;
      }
      const review = await runAiTask("analyzeResume", { resumeText: record.sourceText, deterministicReview: analyzeResume({ text: record.sourceText, targetKeywords: [], documentSignals: {} }) }, options);
      const profile = transformed.meta.validation === "passed" ? canonicalProfileSchema.safeParse(transformed.output.profileDraft) : null;
      const cover = profile?.success ? await runAiTask("generateCoverLetter", { profile: profile.data, targetRole: profile.data.currentRole || profile.data.headline, company: "Example Employer", jobDescription: "", tone: "executive" }, options) : null;
      const linkedIn = profile?.success ? await runAiTask("generateLinkedInMakeover", { profile: profile.data, targetRole: profile.data.currentRole || profile.data.headline, currentProfileText: "" }, options) : null;
      await writeFile(path.join(root, `${entry.id}${qaModelSuffix}-lifecycle.json`), JSON.stringify({ checkedAt: new Date().toISOString(), sourceHash: entry.sha256, transformed, review, cover, linkedIn, failures, providerResponses, factualVerification: "pending-original-comparison", visualVerification: "pending" }, null, 2), { mode: 0o600 });
      console.log(JSON.stringify({ id: entry.id, transform: transformed.meta.validation, review: review.meta.validation, cover: cover?.meta.validation ?? "blocked", linkedIn: linkedIn?.meta.validation ?? "blocked" }));
      if ([transformed, review, cover, linkedIn].some((result) => result?.meta.validation !== "passed")) process.exitCode = 1;
    } catch (error) {
      console.log(JSON.stringify({ id: entry.id, stage: "lifecycle", result: "failed", errorType: error instanceof Error ? error.name : "Unknown" }));
      process.exitCode = 1;
    }
    continue;
  }
  const result = await runAiTask("extractResumeProfile", { resumeText: record.sourceText, deterministicDraft: extractCanonicalProfile(record.sourceText).draft }, { ownerId: `private-local-${entry.id}`, providers, disablePersistence: true, config: { policyVersion: "sample-qa", cacheTtlHours: 0, providers: [] }, onValidationFailure: (failure) => failures.push(failure) });
  const extractionFile = process.argv.includes("--extract-retest") ? `${entry.id}${qaModelSuffix}-extract-retest.json` : `${entry.id}-ai.json`;
  await writeFile(path.join(root, extractionFile), JSON.stringify({ checkedAt: new Date().toISOString(), sourceHash: entry.sha256, result, failures, factualVerification: "pending-original-comparison" }, null, 2), { mode: 0o600 });
  const draft = result.output.profileDraft;
  console.log(JSON.stringify({ id: entry.id, validation: result.meta.validation, skills: draft.skills?.length ?? 0, roles: draft.experience?.length ?? 0, education: draft.education?.length ?? 0, credentials: draft.certifications?.length ?? 0, seconds: Math.round(result.meta.latencyMs / 1000), factualVerification: "pending" }));
  if (result.meta.validation !== "passed") process.exitCode = 1;
}
