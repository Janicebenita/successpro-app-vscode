import { describe, expect, it } from "vitest";
import { canonicalProfileSchema } from "@successpro/contracts";
import { aiTaskSchemas, extractedProfileSchema } from "@successpro/contracts/ai";

describe("draft versus confirmed profile validation", () => {
  it("allows missing identity text only in an extraction draft", () => {
    const draft = { fullName: "", headline: "", skills: ["Strategy"] };
    expect(extractedProfileSchema.safeParse(draft).success).toBe(true);
    expect(canonicalProfileSchema.safeParse(draft).success).toBe(false);
  });
  it("keeps bounded source-draft field lengths", () => {
    expect(extractedProfileSchema.safeParse({ headline: "x".repeat(1_001) }).success).toBe(false);
    expect(extractedProfileSchema.safeParse({ fullName: "x".repeat(121) }).success).toBe(false);
  });
  it("preserves long source content while retaining stricter transformed-output limits", () => {
    const profileDraft = { headline: "Leadership ".repeat(20), summary: "Source career facts. ".repeat(150), experience: [{ id: "r", title: "Director", employer: "Example", startDate: "2020", endDate: "Present", achievements: Array.from({ length: 25 }, (_, i) => `Supported source responsibility ${i + 1}.`) }] };
    expect(extractedProfileSchema.safeParse(profileDraft).success).toBe(true);
    expect(aiTaskSchemas.transformResumeProfile.output.safeParse({ profileDraft, improvements: [{ field: "summary", observed: "Source", inference: "", suggestion: "Clarify" }], warnings: [] }).success).toBe(false);
  });
  it("still rejects a transformed output with no professional headline", () => {
    const result = aiTaskSchemas.transformResumeProfile.output.safeParse({ profileDraft: { headline: "", summary: "A professional summary.", experience: [{ id: "role", title: "Manager", employer: "Example", startDate: "", endDate: "", achievements: [] }] }, improvements: [{ field: "summary", observed: "Source summary", inference: "", suggestion: "Clarify the wording." }], warnings: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path.includes("headline"))).toBe(true);
  });
});
