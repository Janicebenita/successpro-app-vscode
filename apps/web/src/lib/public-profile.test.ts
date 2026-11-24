import { describe, expect, it } from "vitest";
import { canonicalProfileSchema } from "@successpro/contracts";
import { publicProfileProjection } from "./public-profile";

const profile = canonicalProfileSchema.parse({ fullName: "Private Member", headline: "Product leader", location: "Mumbai", summary: "Private summary", currentRole: "Director", industry: "Technology", skills: ["Strategy"], experience: [{ id: "role-1", title: "Director", employer: "Example", startDate: "2024", endDate: "Present", achievements: ["Private achievement"] }], education: [{ id: "edu-1", qualification: "MBA", institution: "Example School", startDate: "2020", endDate: "2022" }], projects: [], certifications: [], awards: [], publications: [], volunteerExperience: [], languages: [], links: [], targetRoles: [], openToWork: true, publicProfileEnabled: true, publicProfileVisibility: { summary: false, location: false, currentRole: true, industry: false, skills: false, experience: false, education: true }, searchEngineIndexable: false });

describe("public profile projection", () => {
  it("publishes only the sections the member selected", () => {
    const result = publicProfileProjection(profile);
    expect(result).toMatchObject({ fullName: "Private Member", headline: "Product leader", location: "", summary: "", currentRole: "Director", industry: "", skills: [], experience: [], searchEngineIndexable: false });
    expect(result.education).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("Private summary");
    expect(JSON.stringify(result)).not.toContain("Private achievement");
  });

  it("keeps every optional section visible for older saved profiles", () => {
    const legacy = canonicalProfileSchema.parse({ ...profile, publicProfileVisibility: undefined });
    expect(publicProfileProjection(legacy)).toMatchObject({ location: "Mumbai", summary: "Private summary", skills: ["Strategy"] });
  });

  it("does not publish a private photograph unless the member explicitly selects it", () => {
    const withPhoto = canonicalProfileSchema.parse({ ...profile, profilePhotoUpdatedAt: "2026-09-29T09:00:00.000Z" });
    expect(publicProfileProjection(withPhoto).photoPublic).toBe(false);
    const optedIn = canonicalProfileSchema.parse({ ...withPhoto, publicProfileVisibility: { ...withPhoto.publicProfileVisibility, photo: true } });
    expect(publicProfileProjection(optedIn).photoPublic).toBe(true);
  });
});
