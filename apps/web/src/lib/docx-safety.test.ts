import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { docxExpansionLimits, inspectDocxPackage } from "./docx-safety";

async function fixture(extra?: string) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("word/document.xml", "<document/>");
  if (extra) zip.file(extra, "content");
  return zip.generateAsync({ type: "nodebuffer" });
}
describe("Word package screening", () => {
  it("rejects a small compressed archive with excessive actual expansion", async () => {
    const zip = await JSZip.loadAsync(await fixture());
    zip.file("word/media/image.bin", Buffer.alloc(docxExpansionLimits.entryBytes + 1, 65));
    const compressed = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    expect(compressed.length).toBeLessThan(100_000);
    await expect(inspectDocxPackage(compressed)).rejects.toThrow("expands beyond");
  });
  it("accepts a normal package", async () => expect(await inspectDocxPackage(await fixture())).toBeDefined());
  it.each(["word/vbaProject.bin", "word/activeX/control.xml", "word/embeddings/object.bin", "word/payload.exe", "../escape.xml"])("rejects %s before parsing", async (name) => {
    await expect(inspectDocxPackage(await fixture(name))).rejects.toThrow();
  });
  it("rejects a zip that is not a Word package", async () => {
    await expect(inspectDocxPackage(await new JSZip().generateAsync({ type: "nodebuffer" }))).rejects.toThrow("Invalid Word");
  });
});
