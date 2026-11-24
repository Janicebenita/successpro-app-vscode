import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { inspectNativeUpload } from "./resume-native/validation";

describe("check inspectNativeUpload", () => {
  it("checks why it throws in formData", async () => {
    const bytes = readFileSync("D:/successpro-app-vscode/.local/phase4b/fixtures/poor_singlecol_nodates_nocontact.pdf");
    const formData = new FormData();
    const file = new File([bytes], "poor_singlecol_nodates_nocontact.pdf", { type: "application/pdf" });
    formData.append("resume", file);
    const req = new Request("http://localhost:3000/api/resumes", { method: "POST", body: formData });
    const parsedForm = await req.formData();
    const parsedFile = parsedForm.get("resume") as File;
    console.log("name:", parsedFile.name, "type:", parsedFile.type, "size:", parsedFile.size);
    const parsedBytes = new Uint8Array(await parsedFile.arrayBuffer());
    console.log("parsedBytes len:", parsedBytes.length);
    try {
      const res = await inspectNativeUpload(parsedFile, parsedBytes);
      console.log("Success:", res);
    } catch (err) {
      console.error("inspectNativeUpload error:", err);
    }
  });
});
