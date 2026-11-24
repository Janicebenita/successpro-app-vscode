import { describe, expect, it } from "vitest";
import { canonicalProfileSchema } from "@successpro/contracts";
import { buildCareerMilestones, detectCareerRegions, industryTheme } from "./career-visualization";

const profile = canonicalProfileSchema.parse({ fullName: "Test Person", headline: "Cloud leader", location: "Hyderabad, India", summary: "Led teams across EMEA and APAC.", currentRole: "Director", industry: "Cloud software", skills: ["Strategy"], experience: [{ id: "r1", title: "Director", employer: "Example", startDate: "2022", endDate: "Present", achievements: ["Expanded work in Canada."] }], education: [{ id: "e1", qualification: "MBA", institution: "School", startDate: "2018", endDate: "2020" }], projects: [], certifications: [{ id: "c1", name: "Cloud", issuer: "Institute", date: "2021", credentialUrl: "" }], awards: [{ id: "a1", title: "Leader award", issuer: "Example", date: "2023", description: "" }], publications: [], volunteerExperience: [], languages: [], links: [], targetRoles: [], openToWork: false, publicProfileEnabled: false });

describe("career visualization", () => {
  it("derives only named geographic exposure, including broad profile regions", () => {
    expect(detectCareerRegions(profile).map((item) => item.id)).toEqual(expect.arrayContaining(["north-america", "europe", "middle-east", "africa", "south-asia", "east-asia", "southeast-asia", "oceania"]));
  });
  it("builds a compact career road with the current chapter first", () => {
    expect(buildCareerMilestones(profile).map((item) => item.kind)).toEqual(["role", "recognition", "credential", "education"]);
  });
  it("orders abbreviated career dates from present backward", () => {
    const dated = { ...profile, experience: [
      { ...profile.experience[0], id: "current", startDate: "Jan’22", endDate: "Present" },
      { ...profile.experience[0], id: "prior", startDate: "Apr’18", endDate: "Dec’21" },
    ], education: [{ ...profile.education[0], startDate: "", endDate: "2016" }] };
    expect(buildCareerMilestones(dated).map((item) => item.id)).toEqual(["role-current", "recognition-a1", "role-prior", "credential-c1", "education-e1"]);
  });
  it("selects a restrained industry theme", () => expect(industryTheme(profile.industry)).toBe("technology"));
  it("keeps education even when a long career has more than fourteen milestones", () => {
    const extensive = { ...profile, experience: Array.from({ length: 18 }, (_, index) => ({ ...profile.experience[0], id: `role-${index}`, startDate: String(2021 + index) })) };
    expect(buildCareerMilestones(extensive)).toHaveLength(21);
    expect(buildCareerMilestones(extensive).some((item) => item.kind === "education")).toBe(true);
  });
});
