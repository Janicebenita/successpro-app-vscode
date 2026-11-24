import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { canonicalProfileSchema } from "@successpro/contracts";
import { renderCoverLetterDocx, renderResumeDocx } from "./document-docx-renderer";
import { resumeSectionIds } from "./document-request";

const profile = canonicalProfileSchema.parse({ fullName: "Samira Test", headline: "Product leader", location: "Mumbai", summary: "Product leader with measurable experience across customer and platform work.", currentRole: "Senior Product Manager", industry: "Technology", skills: ["Strategy", "Analytics"], experience: [{ id: "role-1", title: "Senior Product Manager", employer: "Northstar", startDate: "2022", endDate: "Present", achievements: ["Improved customer retention by 18%."] }], education: [{ id: "edu-1", qualification: "MBA", institution: "Example School", startDate: "2019", endDate: "2020" }], projects: [{ id: "project-1", name: "Retention programme", description: "Built a measurable customer recovery programme.", link: "" }], certifications: [], awards: [], publications: [], volunteerExperience: [], languages: ["English"], links: [], targetRoles: ["Director of Product"], openToWork: false, publicProfileEnabled: false });
const shared = { profile, templateId: "signature" as const, pageSize: "a4" as const, contact: { email: "samira@example.com", location: "Mumbai" } };

describe("editable Word documents", () => {
  it("lists every earlier undated role compactly in the Word export", async () => {
    const roles = [
      profile.experience[0],
      { id: "earlier-1", title: "Regional Manager", employer: "Northstar", startDate: "", endDate: "", achievements: [] },
      { id: "earlier-2", title: "Country Manager", employer: "Northstar", startDate: "", endDate: "", achievements: [] },
    ];
    const zip = await JSZip.loadAsync(await renderResumeDocx({ ...shared, profile: { ...profile, experience: roles } }));
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Earlier roles");
    expect(xml).toContain("Regional Manager");
    expect(xml).toContain("Country Manager");
    expect(xml.match(/<w:t xml:space="preserve">Northstar<\/w:t>/g)).toHaveLength(2);
  });
  it("preserves run spacing and does not invent an unspecified recognition type", async () => {
    const zip = await JSZip.loadAsync(await renderResumeDocx({ ...shared, profile: { ...profile, awards: [{ id: "recognition", title: "Service recognition", issuer: "Northstar", date: "2024", description: "Recognised for customer service." }] } }));
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain('<w:t xml:space="preserve"> | Northstar | 2024</w:t>');
    expect(xml).not.toContain("Achievement | Northstar");
  });
  it("preserves supporting details in default and reordered exports", async () => {
    const detailed = canonicalProfileSchema.parse({ ...profile,
      projects: [{ id: "p", name: "Customer project", description: "Delivered the verified project scope.", link: "https://example.com/project" }],
      awards: [{ id: "a", kind: "award", title: "Team award", issuer: "Northstar", date: "2024", description: "Recognised for customer service improvements." }],
      certifications: [{ id: "c", name: "Product credential", issuer: "Institute", date: "2023", credentialUrl: "https://example.com/credential" }],
      publications: [{ id: "pub", title: "Product research", publisher: "Review", date: "2024", link: "https://example.com/research" }],
      links: [{ id: "l", label: "Portfolio", url: "https://example.com/portfolio" }],
    });
    for (const sectionOrder of [undefined, [...resumeSectionIds].reverse()]) {
      const zip = await JSZip.loadAsync(await renderResumeDocx({ ...shared, profile: detailed, sectionOrder }));
      const xml = await zip.file("word/document.xml")!.async("string");
      for (const text of ["PROFESSIONAL LINKS", "example.com/project", "example.com/credential", "example.com/research", "example.com/portfolio", detailed.awards[0].description]) expect(xml).toContain(text);
      expect(xml).toContain("<w:keepNext/><w:keepLines/>");
      expect(xml).toContain("<w:widowControl/>");
      expect(await zip.file("word/styles.xml")!.async("string")).toContain('w:line="302"');
    }
  });
  it("creates a valid themed resume package", async () => { const zip = await JSZip.loadAsync(await renderResumeDocx(shared)); const document = await zip.file("word/document.xml")!.async("string"); const styles = await zip.file("word/styles.xml")!.async("string"); expect(document).toContain("PROFESSIONAL EXPERIENCE"); expect(document).toContain("Improved customer retention by 18%."); expect(styles).toContain("Source Sans 3"); expect(Object.keys(zip.files)).toContain("word/numbering.xml"); });
  it("keeps a customer-selected section order in the editable document", async () => { const zip = await JSZip.loadAsync(await renderResumeDocx({ ...shared, sectionOrder: ["experience", "summary", "skills", "education"] })); const document = await zip.file("word/document.xml")!.async("string"); expect(document.indexOf("PROFESSIONAL EXPERIENCE")).toBeLessThan(document.indexOf("PROFESSIONAL SUMMARY")); expect(document.indexOf("PROFESSIONAL SUMMARY")).toBeLessThan(document.indexOf("CORE SKILLS")); });
  it("creates a matching cover letter package", async () => { const output = await renderCoverLetterDocx({ ...shared, letter: { date: "24 September 2026", company: "Example Company", targetRole: "Director of Product", greeting: "Dear Hiring Manager,", paragraphs: ["A".repeat(250), "B".repeat(250), "C".repeat(250)], closing: "Yours sincerely," } }); const zip = await JSZip.loadAsync(output); const document = await zip.file("word/document.xml")!.async("string"); expect(document).toContain("Director of Product"); expect(document).toContain("Yours sincerely"); });
});
