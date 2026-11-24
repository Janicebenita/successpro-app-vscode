import { readFile, writeFile } from "node:fs/promises";
import { canonicalProfileSchema } from "@successpro/contracts";
import { renderResumePdf } from "../src/lib/document-renderer";
const data = JSON.parse(await readFile("../../tmp/sample-resume-qa/sample-08-gemini-3.6-flash-transform-retest.json", "utf8"));
const profile = canonicalProfileSchema.parse(data.transformed.output.profileDraft);
await writeFile("../../tmp/pdfs/saksham-check/flow-fixed.pdf", await renderResumePdf({ profile, templateId: "editorial", pageSize: "a4", contact: { email: "qa@example.com", location: profile.location } }));
