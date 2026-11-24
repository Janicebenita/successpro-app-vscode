import { describe, expect, it } from "vitest";
import { isValidFeedAttachmentSignature, safeFeedAttachmentName, supportedFeedAttachment } from "./feed-attachments";

describe("feed attachment validation", () => {
  it("accepts only the supported professional attachment types", () => {
    expect(supportedFeedAttachment("application/pdf")?.kind).toBe("document");
    expect(supportedFeedAttachment("video/mp4")?.kind).toBe("video");
    expect(supportedFeedAttachment("application/zip")).toBeNull();
  });

  it("checks binary signatures instead of trusting browser MIME labels", () => {
    expect(isValidFeedAttachmentSignature(Buffer.from("%PDF-1.7"), "application/pdf")).toBe(true);
    expect(isValidFeedAttachmentSignature(Buffer.from("not a pdf"), "application/pdf")).toBe(false);
    expect(isValidFeedAttachmentSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg")).toBe(true);
  });

  it("normalizes attachment names without retaining unsafe characters", () => {
    expect(safeFeedAttachmentName("Board / update?.pdf", "pdf")).toBe("Board  update.pdf");
  });
});
