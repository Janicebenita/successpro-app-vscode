import { describe, expect, it, vi } from "vitest";
import { resolvePdfVisualInspection } from "./resume-extraction";

describe("PDF extraction fallback", () => {
  it("does not wait indefinitely for optional visual inspection", async () => {
    await expect(resolvePdfVisualInspection("Readable resume content ".repeat(8), () => new Promise(() => {}), 20)).resolves.toBeNull();
  });
  it("keeps readable embedded text when optional visual inspection fails", async () => {
    const inspector = vi.fn().mockRejectedValue(new Error("native renderer unavailable"));
    await expect(resolvePdfVisualInspection("Readable resume content ".repeat(8), inspector)).resolves.toBeNull();
    expect(inspector).toHaveBeenCalledOnce();
  });

  it("does not hide a complete extraction failure", async () => {
    await expect(resolvePdfVisualInspection("short", async () => { throw new Error("renderer unavailable"); })).rejects.toThrow("content and visual inspection both failed");
  });
});
