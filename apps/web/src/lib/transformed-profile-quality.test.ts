import { describe, expect, it } from "vitest";
import { aiTaskSchemas } from "@successpro/contracts/ai";

const output = (summary: string) => ({ profileDraft: { headline: "Programme and Product Management Leader", summary, skills: ["Programme management"], experience: [{ id: "role-1", title: "Director", employer: "Example Company", startDate: "2020", endDate: "Present", achievements: ["Led a verified programme across multiple regions."] }] }, improvements: [{ field: "summary", observed: "Verified source evidence.", inference: "The original summary lacked focus.", suggestion: "Use a concise, role-relevant executive narrative." }], warnings: [] });

describe("transformed profile quality contract", () => {
  it("accepts a focused evidence-grounded professional summary", () => {
    expect(aiTaskSchemas.transformResumeProfile.output.safeParse(output("Program and product management leader with more than 10 years of experience across SaaS, cloud and e-commerce. Has led international product launches, service-delivery teams and complex transformation programmes across APAC, EMEA and North America. Combines technology delivery with commercial and operational leadership.")).success).toBe(true);
  });

  it("rejects cross-column contact, skills and highlights contamination", () => {
    const contaminated = "A certified professional with over 10 years of experience. CONTACT COMPELLING EDGE Hyderabad Service Delivery Management: Managed 55 employees and 9941266601 Sales. d@resumewriterindia.com SKILLS Product Management.";
    expect(aiTaskSchemas.transformResumeProfile.output.safeParse(output(contaminated)).success).toBe(false);
  });

  it("rejects a pasted multi-section block even without contact details", () => {
    expect(aiTaskSchemas.transformResumeProfile.output.safeParse(output(`Professional leader. ${"Long copied material ".repeat(70)}`)).success).toBe(false);
  });
});
