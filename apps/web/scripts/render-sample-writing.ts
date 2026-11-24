import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalProfileSchema } from "@successpro/contracts";
import { renderCoverLetterPdf, renderResumePdf } from "../src/lib/document-renderer";

const id = process.argv[2];
if (!/^sample-(?:0[1-9]|10)$/.test(id ?? "")) throw new Error("Select sample-01 through sample-10 explicitly.");
const root = path.resolve("../../tmp/sample-resume-qa");
const model = process.argv.find((argument) => argument.startsWith("--model="))?.slice("--model=".length);
const modelSuffix = model ? `-${model}` : "";
const transformed = JSON.parse(await readFile(path.join(root, `${id}${modelSuffix}-transform-retest.json`), "utf8"));
const writing = JSON.parse(await readFile(path.join(root, `${id}${modelSuffix}-writing-retest.json`), "utf8"));
if (transformed.transformed?.meta.validation !== "passed" || writing.cover?.meta.validation !== "passed") throw new Error("Validated transformation and cover letter required.");
if (transformed.sourceHash !== writing.sourceHash) throw new Error("Transformation and writing fixtures do not share a source resume.");
const profile = canonicalProfileSchema.parse(transformed.transformed.output.profileDraft);
const directory = path.join(root, `${id}-exports`);
await mkdir(directory, { recursive: true, mode: 0o700 });
// Do not infer contact details from parsed prose or use a real account email.
// Blank optional contact is deliberate for this private rendering fixture.
const shared = { profile, contact: { email: "", location: profile.location }, templateId: "clarity" as const, pageSize: "a4" as const };
await writeFile(path.join(directory, "resume.pdf"), await renderResumePdf(shared), { mode: 0o600 });
await writeFile(path.join(directory, "cover-letter.pdf"), await renderCoverLetterPdf({ ...shared, letter: { date: "25 September 2026", company: "Example Employer", targetRole: profile.currentRole || profile.headline, greeting: writing.cover.output.greeting, paragraphs: writing.cover.output.paragraphs, closing: writing.cover.output.closing } }), { mode: 0o600 });
console.log(JSON.stringify({ sample: id, files: 2, template: "clarity", visualApproval: "pending" }));
