import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extractPdfResume } from "../src/lib/resume-extraction";
import { extractCanonicalProfile, reconcileExtractedProfile, analyzeResume } from "@successpro/domain";
import { runAiTask } from "../src/lib/ai/orchestrator";
import type { AiProvider } from "../src/lib/ai/providers";
import { canonicalProfileSchema } from "@successpro/contracts";

async function main() {
  const path = process.argv[2];
  if (!path || !process.env.GOOGLE_CLOUD_PROJECT || !process.env.GCLOUD_BIN) throw new Error("Supply PDF path, GOOGLE_CLOUD_PROJECT and GCLOUD_BIN.");
  const token = execFileSync(process.env.GCLOUD_BIN, ["auth", "print-access-token"], { encoding: "utf8" }).trim();
  let lastReviewResponse = "";
  const provider: AiProvider = { id: "vertex-lifecycle-check", model: "gemini-2.5-flash", async generate({ task, prompt, maximumOutputTokens, signal }) {
    const response = await fetch(`https://aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/global/publishers/google/models/gemini-2.5-flash:generateContent`, { method: "POST", signal: signal ?? AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: .15, maxOutputTokens: maximumOutputTokens, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } }) });
    if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
    const body = await response.json();
    const text = body.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
    if (task === "analyzeResume") lastReviewResponse = text;
    return { text };
  } };
  const options = { ownerId: "local-resume-quality-check", providers: [provider], disablePersistence: true, config: { policyVersion: "local-check", cacheTtlHours: 0, providers: [] }, onValidationFailure: (failure: unknown) => console.log(JSON.stringify({ validationFailure: failure })) };
  const document = await extractPdfResume(readFileSync(path));
  const base = extractCanonicalProfile(document.text);
  const extracted = await runAiTask("extractResumeProfile", { resumeText: document.text, deterministicDraft: base.draft }, options);
  const draft = reconcileExtractedProfile(base.draft, extracted.output.profileDraft);
  console.log(JSON.stringify({ stage: "extraction", validation: extracted.meta.validation, skills: draft.skills?.length, roles: draft.experience?.length, education: draft.education?.length, credentials: draft.certifications?.length }));
  const transformed = await runAiTask("transformResumeProfile", { resumeText: document.text, deterministicDraft: draft }, options);
  console.log(JSON.stringify({ stage: "transformation", meta: transformed.meta, skills: transformed.output.profileDraft.skills?.length, roles: transformed.output.profileDraft.experience?.length }));
  if (transformed.meta.validation === "passed") {
    const profile = canonicalProfileSchema.parse(transformed.output.profileDraft);
    const cover = await runAiTask("generateCoverLetter", { profile, targetRole: profile.targetRoles[0] || profile.currentRole || "Product Director", company: "Example Company", jobDescription: "Lead strategy and cross-functional teams to improve customer outcomes.", tone: "executive" }, options);
    const words = cover.output.paragraphs.join(" ").split(/\s+/).length;
    const linkedin = await runAiTask("generateLinkedInMakeover", { profile, currentProfileText: "", targetRole: profile.targetRoles[0] || profile.currentRole }, options);
    console.log(JSON.stringify({ stage: "cover-letter-and-linkedin", cover: cover.meta.validation, words, linkedin: linkedin.meta.validation, headlines: linkedin.output.headlines.length }));
    if (cover.meta.validation !== "passed" || linkedin.meta.validation !== "passed" || words < 250 || words > 450) process.exitCode = 1;
  }
  const review = await runAiTask("analyzeResume", { resumeText: document.text, deterministicReview: analyzeResume({ text: document.text, targetKeywords: [], documentSignals: { ...document.layout, pageCount: document.pageCount, extractionReliable: true } }) }, options);
  console.log(JSON.stringify({ stage: "review", meta: review.meta, actions: review.output.topActions.length, excerpts: review.output.topActions.filter((action) => action.originalExcerpt).length }));
  if (process.env.QA_DIAGNOSTIC_QUOTES === "1" && path.endsWith("/successpro-clarity-resume.pdf") && review.meta.validation !== "passed") console.log(JSON.stringify({ syntheticReview: lastReviewResponse, syntheticSource: document.text }));
  if ([extracted, transformed, review].some((run) => run.meta.validation !== "passed")) process.exitCode = 1;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Check failed"); process.exitCode = 1; });
