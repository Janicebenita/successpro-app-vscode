import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractCanonicalProfile, analyzeResume } from "@successpro/domain";
import { extractPdfResume, extractDocxResume, extractLegacyDocResume } from "../src/lib/resume-extraction";

// Private test evidence stays in ignored tmp/, never in a public profile or build.
const sourceRoot = path.resolve("../../Sample Resumes");
const outputRoot = path.resolve("../../tmp/sample-resume-qa");
const files = (await readdir(sourceRoot)).filter((name) => /\.(pdf|docx|doc)$/i.test(name)).sort();
if (files.length !== 10) throw new Error(`Expected ten sample resumes; found ${files.length}.`);
await mkdir(outputRoot, { recursive: true, mode: 0o700 });
const selectedId = process.argv[2];
const previous = selectedId ? await readFile(path.join(outputRoot, "manifest.json"), "utf8").then((value) => JSON.parse(value).results).catch(() => []) : [];
const results: Array<Record<string, unknown>> = previous.filter((record: Record<string, unknown>) => record.id !== selectedId);
for (const [index, file] of files.entries()) {
  const id = `sample-${String(index + 1).padStart(2, "0")}`;
  if (selectedId && selectedId !== id) continue;
  const started = Date.now();
  try {
    const bytes = await readFile(path.join(sourceRoot, file));
    const document = /\.pdf$/i.test(file) ? await extractPdfResume(bytes) : /\.docx$/i.test(file) ? await extractDocxResume(bytes) : await extractLegacyDocResume(bytes);
    const recovered = extractCanonicalProfile(document.text);
    const review = analyzeResume({ text: document.text, targetKeywords: [], documentSignals: { ...document.layout, pageCount: document.pageCount ?? undefined, extractionReliable: document.text.length >= 300 } });
    const record = { id, file, sha256: createHash("sha256").update(bytes).digest("hex"), characters: document.text.length, pages: document.pageCount, seconds: Math.round((Date.now() - started) / 1000), textExtraction: document.text.length >= 80 ? "passed" : "failed", heuristicSkills: recovered.draft.skills?.length ?? 0, heuristicRoles: recovered.draft.experience?.length ?? 0, heuristicEducation: recovered.draft.education?.length ?? 0, visualReview: "pending", expertReview: "pending", transformation: "pending", exportReview: "pending" };
    await writeFile(path.join(outputRoot, `${id}.json`), JSON.stringify({ ...record, sourceText: document.text, recovered, review }, null, 2), { mode: 0o600 });
    results.push(record);
    console.log(JSON.stringify(record));
  } catch (error) {
    const failure = { id, file, textExtraction: "failed", error: error instanceof Error ? error.message : "Unknown error" };
    results.push(failure);
    console.log(JSON.stringify(failure));
  }
  await writeFile(path.join(outputRoot, "manifest.json"), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2), { mode: 0o600 });
}
if (results.some((result) => result.textExtraction === "failed")) process.exitCode = 1;
