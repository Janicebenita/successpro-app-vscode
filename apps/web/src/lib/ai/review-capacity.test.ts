import { describe, expect, it } from "vitest";
import { aiTaskSchemas } from "@successpro/contracts/ai";
import { resumeAnalysisInputSchema } from "@successpro/contracts";
import { aiTaskRegistry } from "./task-registry";
import { reviewEvidence } from "./review-evidence";

describe("long-resume review capacity", () => {
  it("accepts a ten-thousand-word resume above the former character cutoff", () => {
    const resumeText = Array.from({ length: 10_000 }, (_, index) => `experience${index % 10}`).join(" ");
    expect(resumeText.length).toBeGreaterThan(100_000);
    expect(resumeText.length).toBeLessThan(200_000);
    expect(resumeAnalysisInputSchema.safeParse({ text: resumeText }).success).toBe(true);
    expect(aiTaskSchemas.analyzeResume.input.shape.resumeText.safeParse(resumeText).success).toBe(true);
  });

  it("provides enough response headroom and selectable evidence from the end", () => {
    expect(aiTaskRegistry.analyzeResume.maximumOutputTokens).toBeGreaterThanOrEqual(20_000);
    const source = `${Array.from({ length: 2_000 }, (_, index) => `Role ${index}: delivered a source-backed result.`).join("\n")}\nFinal award: industry recognition.`;
    const excerpts = reviewEvidence(source);
    expect(excerpts.length).toBeGreaterThan(250);
    expect(excerpts.at(-1)?.text).toBe("Final award: industry recognition.");
  });
});
