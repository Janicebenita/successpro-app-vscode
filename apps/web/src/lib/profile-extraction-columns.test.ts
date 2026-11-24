import { describe, expect, it } from "vitest";
import { extractCanonicalProfile, reconcileExtractedProfile } from "@successpro/domain";

describe("multi-column profile extraction", () => {
  it("does not treat qualification text after a year as an end date", () => {
    const result = extractCanonicalProfile("EXAMPLE NAME\nEDUCATION\n2024 - Postgraduate Diploma in Marketing Leadership | Example School\nEXPERIENCE\nDirector | Example | June 2022 - Present\nLed delivery.");
    expect(result.draft.education?.[0].endDate).toBe("");
    expect(result.draft.experience?.[0]).toMatchObject({ startDate: "June 2022", endDate: "Present" });
  });
  it("uses assisted section records instead of preferring a larger set of noisy parsed lines", () => {
    const credential = { id: "c1", name: "Product Strategy", issuer: "Reforge", date: "2023", credentialUrl: "" };
    const result = reconcileExtractedProfile({ skills: ["Strategy - Leadership"], certifications: [credential, { ...credential, id: "noise", name: "Volunteer experience" }] }, { skills: ["Strategy", "Leadership"], certifications: [credential] });
    expect(result.skills).toEqual(["Strategy", "Leadership"]);
    expect(result.certifications).toEqual([credential]);
  });
  it("preserves parsed skills and work history when assistance returns empty sections", () => {
    const source = { skills: ["Product Management", "Program Management"], experience: [{ id: "role-1", title: "Director", employer: "Example", startDate: "2020", endDate: "Present", achievements: ["Led delivery."] }] };
    const result = reconcileExtractedProfile(source, { skills: [], experience: [], summary: "Experienced leader." });
    expect(result.skills).toEqual(source.skills);
    expect(result.experience).toEqual(source.experience);
    expect(result.summary).toBe("Experienced leader.");
  });
  it("recovers bullet skills below a heading fused with the adjacent column", () => {
    const result = extractCanonicalProfile(`DEEPAK JOSEY\nPROFILE\nService delivery leader.\nSKILLS Software launch narrative from the adjacent column.\n• Product Management\n• Program Management\n• Digital Transformation\nSOCIAL EXPERIENCE\nCommunity programme leadership.\nPROFESSIONAL EXPERIENCE\nDirector | Example | 2016 - Present\nLed delivery.\nEDUCATION\nEngineering | Example Institute | 2011`);
    expect(result.draft.skills).toEqual(["Product Management", "Program Management", "Digital Transformation"]);
    expect(result.draft.skills).not.toContain("Software launch narrative from the adjacent column.");
  });
});
