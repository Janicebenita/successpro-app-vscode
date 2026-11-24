export type FeedAttachmentKind = "image" | "document" | "video";

export type FeedAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: FeedAttachmentKind;
  objectName: string;
};

const MIME_TYPES: Record<string, { extension: string; kind: FeedAttachmentKind; maxBytes: number }> = {
  "image/jpeg": { extension: "jpg", kind: "image", maxBytes: 8_000_000 },
  "image/png": { extension: "png", kind: "image", maxBytes: 8_000_000 },
  "image/webp": { extension: "webp", kind: "image", maxBytes: 8_000_000 },
  "application/pdf": { extension: "pdf", kind: "document", maxBytes: 10_000_000 },
  "video/mp4": { extension: "mp4", kind: "video", maxBytes: 25_000_000 },
  "video/webm": { extension: "webm", kind: "video", maxBytes: 25_000_000 },
  "video/quicktime": { extension: "mov", kind: "video", maxBytes: 25_000_000 },
};

export function supportedFeedAttachment(type: string) {
  return MIME_TYPES[type] ?? null;
}

export function isValidFeedAttachmentSignature(bytes: Buffer, type: string) {
  if (type === "image/jpeg") return bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/webp") return bytes.subarray(0, 4).equals(Buffer.from("RIFF")) && bytes.subarray(8, 12).equals(Buffer.from("WEBP"));
  if (type === "application/pdf") return bytes.subarray(0, 5).equals(Buffer.from("%PDF-"));
  if (type === "video/webm") return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (type === "video/mp4" || type === "video/quicktime") return bytes.subarray(4, 8).equals(Buffer.from("ftyp"));
  return false;
}

export function safeFeedAttachmentName(name: string, fallbackExtension: string) {
  const stem = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9 _.-]/g, "").trim().slice(0, 80) || "attachment";
  return `${stem}.${fallbackExtension}`;
}
