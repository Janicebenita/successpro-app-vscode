import { describe, expect, it } from "vitest";
import { analyzeResume } from "@successpro/domain";

describe("resume scoring section recovery", () => {
  it("recognises an introductory professional summary without a Summary heading", () => {
    const result = analyzeResume({ text: "Samira Example\nProduct leader\nsamira@example.com\nProduct leader with eleven years of experience building digital services and leading cross-functional teams to improve customer outcomes.\nCORE SKILLS\nProduct strategy\nEXPERIENCE\nDirector | Example | 2020 - Present\nLed a product team.", targetKeywords: [], documentSignals: {} });
    expect(result.factors.find((factor) => factor.id === "positioning")?.issues).toEqual([]);
    expect(result.factors.find((factor) => factor.id === "positioning")?.evidence.join(" ")).toContain("A professional summary was found.");
  });
  it("recognises an uppercase skills heading merged with the adjacent PDF column", () => {
    const result = analyzeResume({
      text: `DEEPAK JOSEY
PROFILE
Service delivery and product leader with global experience.
SKILLS Software launch and account management highlights continue in the adjacent column.
• Product Management
• Program Management
• Digital Transformation
• Leadership & Conflict Management
SOCIAL EXPERIENCE
Community programme leadership.
PROFESSIONAL EXPERIENCE
Director | Example Commerce | 2016 - Present
Led product and service delivery programmes across global teams.
EDUCATION
Engineering | Example Institute | 2011`,
      targetKeywords: [],
      documentSignals: { extractionReliable: true, multiColumn: true },
    });
    const skills = result.factors.find((factor) => factor.id === "skills");
    expect(result.factors.find((factor) => factor.id === "structure")?.evidence.join(" ")).toContain("skills");
    expect(skills?.evidence.join(" ")).toContain("4 skills");
    expect(skills?.evidence.join(" ")).toContain("Product Management");
    expect(skills?.evidence.join(" ")).not.toContain("Community programme");
  });
  it("counts a short second-column skills list displaced before the first role date", () => {
    const result = analyzeResume({
      text: `Samira Example\nCORE SKILLS\n- Product strategy\n- Customer research\nPROFESSIONAL EXPERIENCE\nDirector of Product\nExample Company\n- Portfolio planning\n- Growth\n2022 - Present\n- Led a portfolio of six products across three regions.\nEDUCATION\nMBA | Example School | 2020`,
      targetKeywords: [], documentSignals: {},
    });
    const skills = result.factors.find((factor) => factor.id === "skills");
    expect(skills?.evidence[0]).toContain("4 skills");
    expect(skills?.evidence.join(" ")).not.toContain("Led a portfolio");
  });
});
