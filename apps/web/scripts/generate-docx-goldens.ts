import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { documentTemplates } from "@successpro/domain";
import { renderResumeDocx, renderCoverLetterDocx } from "../src/lib/document-docx-renderer";
import { baseProfile, coverLetterFixture, documentContact } from "./generate-document-goldens";

const output = path.resolve(process.cwd(), "../../tmp/docx/professional-export");
await mkdir(output, { recursive: true });
for (const template of documentTemplates) {
  const input = { profile: baseProfile, contact: documentContact, templateId: template.id, pageSize: "a4" as const };
  await writeFile(path.join(output, `${template.id}-resume.docx`), await renderResumeDocx(input));
  await writeFile(path.join(output, `${template.id}-cover-letter.docx`), await renderCoverLetterDocx({ ...input, letter: coverLetterFixture }));
}
console.log("Generated eight Word export fixtures in", output);
