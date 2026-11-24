import { describe, expect, it } from "vitest";
import { extractCanonicalProfile } from "./profile-extraction";

describe("canonical profile extraction", () => {
  it("builds a reviewable draft from labelled resume text", () => {
    const result = extractCanonicalProfile(`Avery Patel
Product Analyst
avery@example.com | +91 98765 43210
Professional Summary
Product analyst focused on measurable activation and retention improvements.
Experience
Senior Product Analyst | Northstar Systems | 2023 - Present
Improved activation by 24% across three markets.
Education
B.Tech Information Technology | Example University | 2016 - 2020
Skills: SQL, Product analytics, Experimentation`);

    expect(result.draft.fullName).toBe("Avery Patel");
    expect(result.draft.currentRole).toBe("Senior Product Analyst");
    expect(result.draft.skills).toContain("SQL");
    expect(result.draft.experience).toHaveLength(1);
    expect(result.draft.education).toHaveLength(1);
    expect(result.confidence).not.toBe("low");
  });

  it("flags sparse unstructured text instead of inventing fields", () => {
    const result = extractCanonicalProfile("Resume content without labelled sections and very little structure.");
    expect(result.draft.experience).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("recovers compact two-column headings, skill bullets, employer-first roles, education, and credentials", () => {
    const result = extractCanonicalProfile(`PROFILE
IT Service Delivery Professional with over 10 years of experience in SaaS, Cloud and E-commerce.
DEEPAK JOSEY
CONTACT
Hyderabad
9941266601
d@example.com
SKILLS
• Product Management
• Program Management
• Digital Transformation
SOCIALEXPERIENCE
• AIESEC - Association internationale
EDUCATION
• Engineering in Metallurgy and Material Technology
• Mahatma Gandhi Institute of Technology - JNTU, INDIA 2011
• Project Management Prince 2 Certified practitioner
PROFESSIONALEXPERIENCE
Avetti Commerce | 2016 – Present | Director
• Generated $0.5M USD in 28 months and reduced project costs by 60%.
Amazon | 2011 – 2015 | Sr. Technical Account Manager
• Led a team of 40 employees across five markets.
PASTWORKEXPERIENCE
Amazon | Advisor Seller Support`);
    expect(result.draft.fullName).toBe("DEEPAK JOSEY");
    expect(result.draft.location).toBe("Hyderabad");
    expect(result.draft.skills).toEqual(expect.arrayContaining(["Product Management", "Program Management", "Digital Transformation"]));
    expect(result.draft.experience?.[0]).toMatchObject({ employer: "Avetti Commerce", title: "Director", startDate: "2016", endDate: "Present" });
    expect(result.draft.experience?.[1]).toMatchObject({ employer: "Amazon", title: "Sr. Technical Account Manager" });
    expect(result.draft.education?.[0]).toMatchObject({ qualification: "Engineering in Metallurgy and Material Technology", endDate: "2011" });
    expect(result.draft.certifications?.[0]?.name).toContain("Prince 2");
  });

  it("keeps concise competency rows when a resume labels them as core competencies", () => {
    const result = extractCanonicalProfile(`PRIYA EXAMPLE
CORE COMPETENCIES
Go-to-market strategy and market activation
Sales planning and execution excellence
Revenue and margin optimization
Professional Certifications
Advanced management programme`);

    expect(result.draft.skills).toEqual(expect.arrayContaining([
      "Go-to-market strategy and market activation",
      "Sales planning and execution excellence",
      "Revenue and margin optimization",
    ]));
  });
});
