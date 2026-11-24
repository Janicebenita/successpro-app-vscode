import { describe, expect, it } from "vitest";
import { canonicalProfileSchema } from "@successpro/contracts";
import { createLinkedInMakeover } from "@successpro/domain";

const profile = canonicalProfileSchema.parse({ fullName: "Samira Test", headline: "Product leader", location: "Mumbai", summary: "Product leader with measurable experience across customer and platform work.", currentRole: "Senior Product Manager", industry: "Technology", skills: ["Strategy", "Analytics"], experience: [{ id: "role-1", title: "Senior Product Manager", employer: "Northstar", startDate: "2022", endDate: "Present", achievements: ["Improved customer retention by 18%."] }], education: [{ id: "edu-1", qualification: "MBA", institution: "Example School", startDate: "2019", endDate: "2020" }], projects: [{ id: "project-1", name: "Retention programme", description: "Built a measurable customer recovery programme.", link: "" }], certifications: [], awards: [], publications: [], volunteerExperience: [], languages: ["English"], links: [], targetRoles: ["Director of Product"], openToWork: false, publicProfileEnabled: false });

describe("LinkedIn makeover", () => {
  it("creates complete copy-ready guidance from confirmed profile evidence", () => {
    const result = createLinkedInMakeover(profile);
    expect(result.headlines.length).toBeGreaterThanOrEqual(2);
    expect(result.about).toContain("Improved customer retention by 18%");
    expect(result.experience[0].copy).toContain("Improved customer retention by 18%");
    expect(result.featuredSuggestions[0]).toContain("Retention programme");
    expect(result.searchKeywords).toContain("Director of Product");
    expect(result.visibilityChecklist.length).toBeGreaterThanOrEqual(4);
  });
});
