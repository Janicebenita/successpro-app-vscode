import JSZip from "jszip";
import { PDFParse } from "pdf-parse";
import { NATIVE_REJECTION_MESSAGE, nativeConfig } from "./config";

export type NativeFileKind = "pdf" | "docx";
export type NativeUploadInspection = { kind: NativeFileKind; text?: string; pageCount: number | null; nativeCharacters: number; insufficientPages: number[] };

function cleanExtractedText(value: string) {
  return value.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n").trim();
}

function isPdf(bytes: Uint8Array) {
  return bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-";
}

function isZip(bytes: Uint8Array) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
}

function meaningfulText(value: string) {
  return value.replace(/[^\p{L}\p{N}]/gu, "");
}

export async function inspectNativeUpload(file: File, bytes: Uint8Array): Promise<NativeUploadInspection> {
  const config = nativeConfig();
  if (file.size <= 0 || file.size > config.maximumBytes) throw new Error(file.size > config.maximumBytes ? `Resume files must be ${Math.floor(config.maximumBytes / 1024 / 1024)} MB or smaller.` : NATIVE_REJECTION_MESSAGE);
  const lowerName = file.name.toLowerCase();
  const looksLikePdf = lowerName.endsWith(".pdf") || (isPdf(bytes) && (!lowerName.includes(".") || lowerName === "blob"));
  if (looksLikePdf && isPdf(bytes) && ["application/pdf", "application/octet-stream", ""].includes(file.type)) {
    // pdf-parse transfers/detaches its input while destroying the worker.
    // Validate a copy so the original upload remains writable to local storage.
    const parser = new PDFParse({ data: Uint8Array.from(bytes) });
    try {
      const result = await parser.getText();
      if (result.total > config.maximumPages) throw new Error(`Please upload a resume with ${config.maximumPages} pages or fewer.`);
      const pages = result.pages ?? [];
      const insufficientPages = pages.map((page, index) => ({ index, count: meaningfulText(page.text ?? "").length })).filter((page) => page.count < 20).map((page) => page.index + 1);
      const nativeCharacters = meaningfulText(result.text).length;
      return { kind: "pdf", text: cleanExtractedText(result.text), pageCount: result.total, nativeCharacters, insufficientPages };
    } catch (error) {
      if (error instanceof Error && (error.message === NATIVE_REJECTION_MESSAGE || error.message.includes("pages or fewer"))) throw error;
      throw new Error(NATIVE_REJECTION_MESSAGE);
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }
  if (lowerName.endsWith(".docx") && isZip(bytes) && ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream", ""].includes(file.type)) {
    try {
      const archive = await JSZip.loadAsync(bytes);
      if (!archive.file("[Content_Types].xml") || !archive.file("word/document.xml")) throw new Error("invalid-docx");
      if (archive.file("word/vbaProject.bin")) throw new Error("macro-docx");
      
      let text = "";
      try {
        const mammoth = (await import("mammoth")).default;
        const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
        text = result.value ?? "";
      } catch {
        const documentXml = await archive.file("word/document.xml")!.async("string");
        text = documentXml.replace(/<w:tab\/?\s*>/g, " ").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, " ");
      }

      const cleaned = cleanExtractedText(text);
      const nativeCharacters = meaningfulText(cleaned).length;
      if (nativeCharacters < 80) throw new Error("insufficient-text");

      const appXml = (await archive.file("docProps/app.xml")?.async("string")) ?? "";
      const pageCountMatch = appXml.match(/<Pages>(\d+)<\/Pages>/i);
      const appPages = pageCountMatch ? Number.parseInt(pageCountMatch[1], 10) : 0;
      const wordCount = cleaned.trim().split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
      const pageCount = appPages > 0 ? appPages : Math.max(1, Math.ceil(wordCount / 650));

      return { kind: "docx", text: cleaned, pageCount, nativeCharacters, insufficientPages: [] };
    } catch {
      throw new Error(NATIVE_REJECTION_MESSAGE);
    }
  }
  throw new Error(NATIVE_REJECTION_MESSAGE);
}

