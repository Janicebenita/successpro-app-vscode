import { writeFile } from "node:fs/promises";
import { baseProfile, coverLetterFixture, documentContact } from "./generate-document-goldens";
import { renderCoverLetterPdf, renderResumePdf } from "../src/lib/document-renderer";
import { extractPdfResume } from "../src/lib/resume-extraction";
import { execFileSync } from "node:child_process";
import { canonicalProfileSchema } from "@successpro/contracts";
let testProfile = baseProfile;
if (process.argv.includes("--cloud-profile")) {
  const token = execFileSync("/private/tmp/successpro-gcloud/google-cloud-sdk/bin/gcloud", ["auth", "print-access-token"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const response = await fetch("https://firestore.googleapis.com/v1/projects/successpro-staging-1706786b/databases/(default)/documents/profiles/qa-journey-d08388b5-9852-48f6-bd9d-747debaa9b84", { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Synthetic profile read failed: ${response.status}`);
  const data = await response.json();
  type FirestoreValue = { mapValue?: { fields?: Record<string, FirestoreValue> }; arrayValue?: { values?: FirestoreValue[] }; stringValue?: string; booleanValue?: boolean; integerValue?: string; doubleValue?: number };
  const decode = (value: FirestoreValue): unknown => value.mapValue ? Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, field]) => [key, decode(field)])) : value.arrayValue ? (value.arrayValue.values ?? []).map(decode) : value.stringValue ?? value.booleanValue ?? value.integerValue ?? value.doubleValue ?? null;
  testProfile = canonicalProfileSchema.parse(decode({ mapValue: { fields: data.fields } }));
}
let buffer: Buffer = Buffer.alloc(0);
await renderCoverLetterPdf({ profile: testProfile, contact: documentContact, templateId: "clarity", pageSize: "a4", letter: coverLetterFixture });
for (let run = 0; run < 4; run++) buffer = await renderResumePdf({ profile: { ...testProfile, fullName: `Synthetic Degree Test ${run}` }, contact: documentContact, templateId: "clarity", pageSize: "a4" });
await writeFile("../../tmp/pdfs/degree-export.pdf", buffer);
await extractPdfResume(buffer);
const concurrent = await Promise.all(Array.from({ length: 8 }, (_, run) => renderResumePdf({ profile: { ...testProfile, fullName: `Concurrent Degree Test ${run}` }, contact: documentContact, templateId: "clarity", pageSize: "a4" })));
await Promise.all(concurrent.map((pdf, run) => writeFile(`../../tmp/pdfs/degree-concurrent-${run}.pdf`, pdf)));
execFileSync(process.env.QA_PYTHON_BIN ?? "python3", ["-c", `
from pathlib import Path
from pypdf import PdfReader
files = [Path("../../tmp/pdfs/degree-export.pdf"), *sorted(Path("../../tmp/pdfs").glob("degree-concurrent-*.pdf"))]
for file in files:
    reader = PdfReader(file)
    text = " ".join(page.extract_text() for page in reader.pages)
    if "B.E., Computer Science" not in text:
        raise SystemExit("Mixed-document qualification fidelity failed: " + file.name)
    for page in reader.pages:
        for font in page["/Resources"].get("/Font", {}).values():
            cmap = font.get_object().get("/ToUnicode")
            if cmap and b"<>" in cmap.get_object().get_data():
                raise SystemExit("Empty ToUnicode entry: " + file.name)
print("Mixed-document fidelity: 9/9 passed")
`], { stdio: ["ignore", "inherit", "inherit"] });
console.log(JSON.stringify({ output: "tmp/pdfs/degree-export.pdf", expectedDegree: "B.E., Computer Science" }));
