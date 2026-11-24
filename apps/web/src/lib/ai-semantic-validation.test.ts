import { describe, expect, it } from "vitest";
import { sanitizeAiOutput, validateAiSemantics } from "@/lib/ai/semantic-validation";

const input = {
  resumeText: `Samira Test\nProduct Manager\nNorthstar Technologies\n2022 - Present\nLed customer retention work that improved retention by 18 percent.\nMBA, Example School, 2020\nSkills: strategy, analytics, customer research, leadership.`,
  deterministicDraft: {
    fullName: "Samira Test",
    currentRole: "Product Manager",
    skills: ["Strategy", "Analytics"],
    experience: [{ id: "role-1", title: "Product Manager", employer: "Northstar Technologies", startDate: "2022", endDate: "Present", achievements: ["Improved retention by 18 percent."] }],
  },
  targetRoles: ["Product Director"],
  jobDescription: "",
  refinementNotes: "",
  preserveStructure: false,
};

function output(overrides: Record<string, unknown> = {}) {
  return {
    profileDraft: {
      headline: "Product Management Leader",
      summary: "Product manager with a record of improving customer retention by 18 percent.",
      currentRole: "Product Manager",
      skills: ["Strategy", "Analytics"],
      experience: [{ id: "role-1", title: "Product Manager", employer: "Northstar Technologies", startDate: "2022", endDate: "Present", achievements: ["Improved customer retention by 18 percent through focused product work."] }],
      ...overrides,
    },
    improvements: [{ field: "summary", observed: "improved retention by 18 percent", inference: "The evidence can be more prominent.", suggestion: "Lead with the verified outcome." }],
    warnings: [],
  };
}

describe("AI semantic source grounding", () => {
  it("accepts professional paraphrasing when every structured fact and number is supported", () => {
    expect(validateAiSemantics("transformResumeProfile", input, output() as never)).toEqual([]);
  });

  it("rejects an invented employer, qualification, skill, date and metric", () => {
    const issues = validateAiSemantics("transformResumeProfile", input, output({
      skills: ["Artificial intelligence"],
      experience: [{ id: "role-1", title: "Vice President", employer: "Imaginary Labs", startDate: "2019", endDate: "Present", achievements: ["Raised revenue by 42%."] }],
      certifications: [{ id: "cert-1", name: "AWS Architect", issuer: "Amazon", date: "2024", credentialUrl: "" }],
    }) as never);
    expect(issues.map((issue) => issue.code)).toContain("unsupported_numeric_claim");
    expect(issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      "profileDraft.skills.0",
      "profileDraft.experience.0.employer",
      "profileDraft.experience.0.title",
      "profileDraft.experience.0.startDate",
      "profileDraft.certifications.0.name",
    ]));
  });

  it("does not treat an optional job description as evidence of a candidate skill", () => {
    const tailored = { ...input, jobDescription: "Seeking Artificial intelligence and cloud architecture experience." };
    expect(validateAiSemantics("transformResumeProfile", tailored, output({ skills: ["Artificial intelligence"] }) as never).map((issue) => issue.code)).toContain("unsupported_claim");
  });

  it("preserves customer-owned identity and removes unsupported skill suggestions", () => {
    const sanitized = sanitizeAiOutput("transformResumeProfile", input, output({ fullName: "[redacted fullName]", skills: ["Strategy", "Artificial intelligence"] }) as never);
    expect(sanitized.profileDraft.fullName).toBe("Samira Test");
    expect(sanitized.profileDraft.skills).toEqual(["Strategy", "Analytics"]);
  });

  it("accepts explicit customer corrections as grounded input during refinement", () => {
    const corrected = { ...input, deterministicDraft: { ...input.deterministicDraft, skills: [...input.deterministicDraft.skills, "Portfolio Strategy"] }, refinementNotes: "Emphasize the corrected portfolio strategy skill.", preserveStructure: true };
    expect(validateAiSemantics("transformResumeProfile", corrected, output({ skills: ["Strategy", "Portfolio Strategy"] }) as never)).toEqual([]);
  });
});
