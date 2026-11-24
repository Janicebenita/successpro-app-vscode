import { describe, expect, it } from "vitest";
import { canonicalProfileSchema } from "@successpro/contracts";

const baseProfile = {
  fullName: "Samira Test",
  headline: "Product leader",
  location: "Mumbai",
  summary: "Product leader with measurable experience across customer and platform work.",
  currentRole: "Senior Product Manager",
  industry: "Technology",
  skills: ["Strategy", "Analytics"],
  experience: [],
  education: [],
  targetRoles: ["Director of Product"],
  openToWork: false,
  publicProfileEnabled: false,
};

describe("canonical career profile", () => {
  it("keeps older profiles compatible by defaulting new career-detail collections", () => {
    const parsed = canonicalProfileSchema.parse(baseProfile);
    expect(parsed.projects).toEqual([]);
    expect(parsed.certifications).toEqual([]);
    expect(parsed.awards).toEqual([]);
    expect(parsed.publications).toEqual([]);
    expect(parsed.volunteerExperience).toEqual([]);
    expect(parsed.languages).toEqual([]);
    expect(parsed.links).toEqual([]);
  });

  it("preserves the complete structured career history", () => {
    const parsed = canonicalProfileSchema.parse({
      ...baseProfile,
      projects: [{ id: "project-1", name: "Retention model", description: "Built a model used by four product teams.", link: "https://example.com/project" }],
      certifications: [{ id: "cert-1", name: "Analytics Foundations", issuer: "Example Institute", date: "2026", credentialUrl: "https://example.com/certificate" }],
      awards: [{ id: "award-1", title: "Customer Impact Award", issuer: "Northstar", date: "2025", description: "Recognized for measurable improvements." }],
      publications: [{ id: "publication-1", title: "Practical Product Analytics", publisher: "Example Journal", date: "2024", link: "https://example.com/article" }],
      volunteerExperience: [{ id: "volunteer-1", role: "Mentor", organization: "Career Circle", startDate: "2023", endDate: "Present", description: "Supported early-career analysts." }],
      languages: ["English", "Hindi"],
      links: [{ id: "link-1", label: "Portfolio", url: "https://example.com" }],
    });
    expect(parsed.projects[0].name).toBe("Retention model");
    expect(parsed.certifications[0].issuer).toBe("Example Institute");
    expect(parsed.awards[0].title).toBe("Customer Impact Award");
    expect(parsed.publications[0].publisher).toBe("Example Journal");
    expect(parsed.volunteerExperience[0].organization).toBe("Career Circle");
    expect(parsed.languages).toEqual(["English", "Hindi"]);
    expect(parsed.links[0].url).toBe("https://example.com");
  });
});
