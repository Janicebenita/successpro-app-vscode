export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export type UploadValidation = { valid: true; kind: "pdf" | "doc" | "docx" | "txt" } | { valid: false; code: string; message: string };

export function validateResumeUpload(input: { name: string; mimeType: string; size: number; signature: Uint8Array }): UploadValidation {
  if (input.size <= 0) return { valid: false, code: "empty", message: "The selected file is empty." };
  if (input.size > MAX_RESUME_BYTES) return { valid: false, code: "too_large", message: "Resume files must be 10 MB or smaller." };

  const extension = input.name.toLowerCase().split(".").pop();
  const signature = new TextDecoder().decode(input.signature.slice(0, 4));
  if (extension === "pdf" && input.mimeType === "application/pdf" && signature.startsWith("%PDF")) return { valid: true, kind: "pdf" };
  if (extension === "doc" && ["application/msword", "application/x-msword", ""].includes(input.mimeType) && input.signature[0] === 0xd0 && input.signature[1] === 0xcf && input.signature[2] === 0x11 && input.signature[3] === 0xe0) return { valid: true, kind: "doc" };
  if (extension === "docx" && input.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && signature.startsWith("PK")) return { valid: true, kind: "docx" };
  if (extension === "txt" && ["text/plain", ""].includes(input.mimeType)) return { valid: true, kind: "txt" };

  return { valid: false, code: "type_mismatch", message: "We could not confirm this file type. Please upload the original PDF, Word (.doc or .docx), or TXT file." };
}
