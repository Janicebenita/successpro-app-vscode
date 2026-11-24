import JSZip from "jszip";
import type { Readable } from "node:stream";

export const docxExpansionLimits = { entryBytes: 32 * 1024 * 1024, totalBytes: 64 * 1024 * 1024 };

async function measuredEntrySize(entry: JSZip.JSZipObject, remaining: number) {
  // Count actual decompressed bytes instead of trusting ZIP directory sizes.
  // Do not accumulate an expanded entry in memory during this preflight.
  const ceiling = Math.min(docxExpansionLimits.entryBytes, remaining);
  // A declared uncompressed size is an early, inexpensive rejection path for
  // ordinary oversized archives. It is never the sole protection: a hostile
  // archive can lie in its directory metadata, so unknown or plausible values
  // still go through the bounded streamed measurement below.
  const declared = (entry as unknown as { _data?: { uncompressedSize?: unknown } })._data?.uncompressedSize;
  if (typeof declared === "number" && Number.isFinite(declared) && declared > ceiling) {
    throw new Error("Word archive expands beyond the processing limit");
  }
  return new Promise<number>((resolve, reject) => {
    let bytes = 0;
    let rejected = false;
    const stream = entry.nodeStream("nodebuffer") as Readable;
    stream.on("data", (chunk: Buffer) => {
      if (rejected) return;
      bytes += chunk.byteLength;
      if (bytes > ceiling) {
        rejected = true;
        stream.destroy();
        reject(new Error("Word archive expands beyond the processing limit"));
      }
    });
    stream.on("error", reject);
    stream.on("end", () => { if (!rejected) resolve(bytes); });
  });
}

/** Inspect package names before handing a Word archive to the text parser.
 * This is package screening, not a malware scan or parser isolation boundary.
 */
export async function inspectDocxPackage(buffer: Buffer) {
  const archive = await JSZip.loadAsync(buffer);
  const entries = Object.values(archive.files);
  if (entries.length > 2_000) throw new Error("Word archive contains too many entries");
  if (!archive.file("word/document.xml") || !archive.file("[Content_Types].xml")) throw new Error("Invalid Word document package");
  for (const entry of entries) {
    const original = (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name;
    const name = original.replace(/\\/g, "/");
    if (name.startsWith("/") || /^[a-z]:/i.test(name) || name.split("/").includes("..")) throw new Error("Unsafe Word archive path");
    if (/(?:^|\/)(?:vbaproject\.bin|activex|embeddings)(?:\/|$)/i.test(name) || /\.(?:exe|dll|com|scr|ps1|bat|cmd|js|vbs)$/i.test(name)) throw new Error("Word document contains unsupported active or embedded content");
  }
  let expandedBytes = 0;
  for (const entry of entries) {
    if (!entry.dir) expandedBytes += await measuredEntrySize(entry, docxExpansionLimits.totalBytes - expandedBytes);
  }
  return archive;
}
