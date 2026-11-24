import { describe, expect, it } from "vitest";
import { aiTaskSchemas } from "@successpro/contracts/ai";
import { sanitizeAiOutput, validateAiSemantics } from "./semantic-validation";
import { reviewEvidence } from "./review-evidence";

describe("source metric normalization", () => {
  it("keeps confirmed skills when a resume rewrite proposes a shorter list", () => {
    const input = { resumeText: "Skills: Sales Leadership, B2B, Relationship Management", deterministicDraft: { skills: ["Sales Leadership", "B2B", "Relationship Management"] } } as never;
    const output = { profileDraft: { skills: ["Sales Leadership", "Invented market analytics"] }, improvements: [], warnings: [] } as never;
    expect(sanitizeAiOutput("transformResumeProfile", input, output).profileDraft.skills).toEqual(["Sales Leadership", "B2B", "Relationship Management"]);
  });
  it("does not turn an exact quantity into a larger lower bound", () => {
    const input = { resumeText: "Served 150 corporate clients", deterministicDraft: {} } as never;
    const output = { profileDraft: { summary: "Served over 150 corporate clients" }, improvements: [], warnings: [] } as never;
    expect(validateAiSemantics("transformResumeProfile", input, output).map((issue) => issue.code)).toContain("unsupported_metric_qualifier");
    expect(validateAiSemantics("transformResumeProfile", { resumeText: "Served 150+ corporate clients", deterministicDraft: {} } as never, output).map((issue) => issue.code)).not.toContain("unsupported_metric_qualifier");
  });
  it("requests repair for generic transformed summaries rather than accepting polished boilerplate", () => {
    const input = { resumeText: "Operations manager at Example", deterministicDraft: {} } as never;
    const output = { profileDraft: { summary: "Results-focused leader with a proven track record." }, improvements: [], warnings: [] } as never;
    expect(validateAiSemantics("transformResumeProfile", input, output).map((issue) => issue.code)).toContain("generic_professional_summary");
  });
  it("removes a stock preface while preserving the sourced accomplishment", () => {
    const input = { resumeText: "Turned category growth from -8% to 20% at Example Company.", deterministicDraft: {} } as never;
    const output = { profileDraft: { summary: "Proven track record of turning category growth from -8% to 20% at Example Company." }, improvements: [], warnings: [] } as never;
    const cleaned = sanitizeAiOutput("transformResumeProfile", input, output);
    expect(cleaned.profileDraft.summary).toBe("Notable work includes turning category growth from -8% to 20% at Example Company.");
    expect(validateAiSemantics("transformResumeProfile", input, cleaned)).toEqual([]);
  });
  it("retains an explicit extracurricular medal in extracted awards", () => {
    const input = { resumeText: "Extracurricular Achievements\nSilver Medal in Inter-State Taekwondo Championship\nMember of the Placement Cell" } as never;
    const output = { profileDraft: { awards: [] }, improvements: [], warnings: [] } as never;
    expect(validateAiSemantics("extractResumeProfile", input, output).map((issue) => issue.code)).toContain("explicit_medal_omitted");
    const withMedal = { profileDraft: { awards: [{ id: "medal-1", kind: "award", title: "Silver Medal in Inter-State Taekwondo Championship", issuer: "", date: "", description: "" }] }, improvements: [], warnings: [] } as never;
    expect(validateAiSemantics("extractResumeProfile", input, withMedal)).toEqual([]);
  });
  it("classifies founder membership as an activity rather than an award", () => {
    const input = { resumeText: "Extracurricular Achievements\nFounder Member of YUVA Chapter (2009)" } as never;
    const misplaced = { profileDraft: { awards: [{ title: "Founder Member", issuer: "YUVA Chapter", date: "2009", description: "" }], volunteerExperience: [] } } as never;
    expect(validateAiSemantics("extractResumeProfile", input, misplaced).map((issue) => issue.code)).toEqual(expect.arrayContaining(["membership_is_not_award", "founder_membership_omitted"]));
    const classified = { profileDraft: { awards: [], volunteerExperience: [{ role: "Founder Member", organization: "YUVA Chapter", startDate: "", endDate: "2009", description: "" }] } } as never;
    expect(validateAiSemantics("extractResumeProfile", input, classified)).toEqual([]);
  });
  it("does not silently drop a separately headed internship", () => {
    const input = { resumeText: "Work Experience\nManager at Example\nSummer Internship- TATA Teleservices Ltd, Bhopal & Indore\nTitle: Exploring Institutional Segment" } as never;
    const omitted = { profileDraft: { experience: [{ title: "Manager", employer: "Example" }] } } as never;
    expect(validateAiSemantics("extractResumeProfile", input, omitted).map((issue) => issue.code)).toContain("explicit_internship_omitted");
    const retained = { profileDraft: { experience: [{ title: "Manager", employer: "Example" }, { title: "Summer Intern", employer: "TATA Teleservices Ltd" }] } } as never;
    expect(validateAiSemantics("extractResumeProfile", input, retained)).toEqual([]);
  });
  it("preserves separately listed earlier roles at one employer without inventing role dates", () => {
    const input = { resumeText: "EXPERIENCE\nExample Company\t2011 - Present\nDirector\t2024 - Present\nOther Key Roles at Example Company:\nRegional Manager - North\nCountry Distribution Lead\nOutside Example Company Experience\nEarlier Company\t2009 - 2011" } as never;
    const role = (title: string, startDate = "", endDate = "") => ({ title, employer: "Example Company", startDate, endDate, achievements: [] });
    const omitted = { profileDraft: { experience: [role("Director", "2024", "Present"), role("Regional Manager - North", "2011", "2024")] }, warnings: [], improvements: [] } as never;
    const issues = validateAiSemantics("extractResumeProfile", input, omitted).map((issue) => issue.code);
    expect(issues).toContain("nested_role_omitted");
    expect(issues).toContain("nested_role_dates_inferred");
    const preserved = { profileDraft: { experience: [role("Director", "2024", "Present"), role("Regional Manager - North"), role("Country Distribution Lead")] }, warnings: [], improvements: [] } as never;
    expect(validateAiSemantics("extractResumeProfile", input, preserved)).toEqual([]);
  });
  it("asks customers to resolve a stated current role with an ended tenure", () => {
    const input = { resumeText: "Currently Director at Example Company. Director | Jan 2015 - Jul 2020" } as never;
    const output = { profileDraft: { currentRole: "Director", experience: [{ id: "role-1", title: "Director", employer: "Example Company", startDate: "Jan 2015", endDate: "Jul 2020", achievements: [] }] }, improvements: [], warnings: [] };
    const result = sanitizeAiOutput("extractResumeProfile", input, output as never);
    expect(result.warnings).toEqual([expect.stringContaining("Confirm whether this is still your present position")]);
    expect(result.profileDraft.experience?.[0].endDate).toBe("Jul 2020");
    const alreadyAsked = sanitizeAiOutput("extractResumeProfile", input, { ...output, warnings: ["Confirm whether the candidate is currently active in this role."] } as never);
    expect(alreadyAsked.warnings).toHaveLength(1);
    const active = { ...output, profileDraft: { ...output.profileDraft, experience: [{ ...output.profileDraft.experience[0], endDate: "Present" }] } } as never;
    expect(sanitizeAiOutput("extractResumeProfile", { resumeText: "Director | Jan 2015 - Present" } as never, active).warnings).toEqual([]);
  });
  it("keeps achievements under their printed award-section dates", () => {
    const input = { resumeText: "AWARDS & ACHIEVEMENTS\n2024 - 25 – Example Co\n▪ Made leader of Chairman's club to drive adoption\n2023 – Example Co\n▪ Promoted to COO with consolidation of operations\nWORK EXPERIENCE\nChief Operating Officer | Jun 2022 - Present" } as never;
    const merged = { profileDraft: { awards: [{ title: "Chairman's club leader and COO promotion", description: "Made leader of Chairman's club to drive adoption. Promoted to COO with consolidation of operations.", date: "2023" }] } } as never;
    expect(validateAiSemantics("extractResumeProfile", input, merged).map((issue) => issue.code)).toContain("dated_achievement_misattributed");
    const separated = { profileDraft: { awards: [
      { kind: "award", title: "Chairman's club leader", description: "Made leader of Chairman's club to drive adoption.", date: "2024 - 25" },
      { kind: "award", title: "COO promotion", description: "Promoted to COO with consolidation of operations.", date: "2023" },
    ] } } as never;
    expect(validateAiSemantics("extractResumeProfile", input, separated)).toEqual([]);
  });
  it("rejects privacy placeholders even in extraction advice", () => {
    const input = { resumeText: "AWARDS & ACHIEVEMENTS\n2024 - 25 – Example Co" } as never;
    const output = { profileDraft: { awards: [] }, improvements: [{ observed: "[redacted phone] – Example Co", inference: "The year is unclear.", suggestion: "Confirm the year.", field: "awards" }], warnings: [] } as never;
    expect(validateAiSemantics("extractResumeProfile", input, output).map((issue) => issue.code)).toContain("unresolved_placeholder");
  });
  it("does not invent a named organization for a college activity", () => {
    const input = { resumeText: "Extracurricular Achievements\nMember of the Placement Cell in college (2008)" } as never;
    const invented = { profileDraft: { volunteerExperience: [{ role: "Member", organization: "College Placement Cell", startDate: "", endDate: "2008" }] } } as never;
    expect(validateAiSemantics("extractResumeProfile", input, invented).map((issue) => issue.code)).toContain("activity_organization_not_in_source");
    const sourced = { profileDraft: { volunteerExperience: [{ role: "Member", organization: "Placement Cell", startDate: "", endDate: "2008" }] } } as never;
    expect(validateAiSemantics("extractResumeProfile", input, sourced)).toEqual([]);
  });
  it("rejects an uncurated list of more than 40 extracted competencies", () => {
    const input = { resumeText: "Sales and channel leadership" } as never;
    const output = { profileDraft: { skills: Array.from({ length: 41 }, (_, index) => `Skill ${index}`) } } as never;
    expect(validateAiSemantics("extractResumeProfile", input, output).map((issue) => issue.code)).toContain("too_many_extracted_skills");
  });
  it("asks for confirmation when source education wording combines institution names", () => {
    const input = { resumeText: "M&A & Competitive Strategies | Wharton (Kellogg School of Management – USA 2016" } as never;
    const output = { profileDraft: { education: [{ id: "e", qualification: "M&A & Competitive Strategies", institution: "Wharton (Kellogg School of Management – USA)", startDate: "", endDate: "2016" }] }, improvements: [], warnings: [] } as never;
    const result = sanitizeAiOutput("extractResumeProfile", input, output);
    expect(result.profileDraft.education?.[0].institution).toBe("Wharton (Kellogg School of Management – USA)");
    expect(result.warnings).toEqual([expect.stringContaining("Confirm the exact awarding institution")]);
  });
  it("rejects an extracted degree missing its printed leading initial", () => {
    const input = { resumeText: "EDUCATION\nB.E., Computer Science\nSavitribai Phule Pune University\n2007 - 2011" } as never;
    const output = { profileDraft: { education: [{ id: "edu-1", qualification: "E., Computer Science", institution: "Savitribai Phule Pune University", startDate: "2007", endDate: "2011" }] }, improvements: [], warnings: [] };
    expect(validateAiSemantics("extractResumeProfile", input, output as never).map((issue) => issue.code)).toContain("truncated_qualification");
    output.profileDraft.education[0].qualification = "B.E., Computer Science";
    expect(validateAiSemantics("extractResumeProfile", input, output as never)).toEqual([]);
  });
  it("preserves customer-confirmed factual labels when transforming prose", () => {
    const degree = { id: "edu-1", qualification: "B.E., Computer Science", institution: "Savitribai Phule Pune University", startDate: "2007", endDate: "2011" };
    const input = { resumeText: "EDUCATION\nB.E., Computer Science\nSavitribai Phule Pune University\n2007 - 2011", deterministicDraft: { education: [degree] } } as never;
    const output = { profileDraft: { education: [{ ...degree, qualification: "E., Computer Science" }] }, improvements: [], warnings: [] } as never;
    const cleaned = sanitizeAiOutput("transformResumeProfile", input, output);
    expect(cleaned.profileDraft.education?.[0].qualification).toBe("B.E., Computer Science");
  });
  it("cleans only source-evidenced spacing inside abbreviated PDF dates", () => {
    const input = { resumeText: "Sr. Manager | Feb ’ 1 2 – June ’ 16\nTeam Lead | July ‘ 16 – Mar’20" } as never;
    const output = { profileDraft: { experience: [
      { id: "role-1", title: "Sr. Manager", employer: "Example", startDate: "Feb ’ 1 2", endDate: "June ’ 16", achievements: [] },
      { id: "role-2", title: "Team Lead", employer: "Example", startDate: "July ‘ 16", endDate: "Mar’20", achievements: [] },
    ] }, improvements: [], warnings: [] } as never;
    const result = sanitizeAiOutput("extractResumeProfile", input, output);
    expect((result.profileDraft.experience ?? []).map((role) => [role.startDate, role.endDate])).toEqual([["Feb’12", "June’16"], ["July‘16", "Mar’20"]]);
    expect(result.warnings).toEqual([]);
  });
  it("keeps a shared range year with both months only when the role heading and source line match", () => {
    const input = { resumeText: "Example Motor Works\nSummer Intern - Corporate Strategy\nApril - May, 2017\nOther Internship\nMarch - May, 2016" } as never;
    const role = { id: "intern-1", title: "Summer Intern - Corporate Strategy", employer: "Example Motor Works", startDate: "April", endDate: "May, 2017", achievements: [] };
    const output = { profileDraft: { experience: [role] }, improvements: [], warnings: ["Start date for Example Motor Works internship lacks a year."] } as never;
    const cleaned = sanitizeAiOutput("extractResumeProfile", input, output);
    expect(cleaned.profileDraft.experience?.[0].startDate).toBe("April 2017");
    expect(cleaned.warnings).toEqual([]);
    const unmatched = sanitizeAiOutput("extractResumeProfile", input, { profileDraft: { experience: [{ ...role, title: "Unrelated Intern" }] }, improvements: [], warnings: [] } as never);
    expect(unmatched.profileDraft.experience?.[0].startDate).toBe("April");
    const yearBoundary = sanitizeAiOutput("extractResumeProfile", { resumeText: "Example Motor Works\nSummer Intern - Corporate Strategy\nDecember - January, 2017" } as never,
      { profileDraft: { experience: [{ ...role, startDate: "December", endDate: "January, 2017" }] }, improvements: [], warnings: [] } as never);
    expect(yearBoundary.profileDraft.experience?.[0].startDate).toBe("December");
  });
  it("retains both printed parts of abbreviated education year ranges", () => {
    const input = { resumeText: "Master's in Business Administration\nJaipuria Institute of Management, Lucknow, 2003-05\nBachelor Of Commerce\nLucknow University Lucknow, 1999-02" } as never;
    const output = { profileDraft: { education: [
      { id: "edu-1", qualification: "MBA", institution: "Jaipuria Institute of Management, Lucknow", startDate: "2003", endDate: "" },
      { id: "edu-2", qualification: "B.Com", institution: "Lucknow University Lucknow", startDate: "1999", endDate: "" },
    ] }, improvements: [], warnings: [] } as never;
    const result = sanitizeAiOutput("extractResumeProfile", input, output);
    expect((result.profileDraft.education ?? []).map((item) => [item.startDate, item.endDate])).toEqual([["2003", "05"], ["1999", "02"]]);
  });
  it("requires the AI to classify non-prize participation rather than silently relabelling it", () => {
    const input = { resumeText: "ABOUT ME\nTCS Sydney Marathon (Aug’25)\n42.2 Kms – Sydney, Australia" } as never;
    const award = { id: "race-1", title: "TCS Sydney Marathon", issuer: "TCS Sydney Marathon", date: "Aug’25", description: "Completed the 42.2 Kms marathon." };
    const output = (kind?: "award" | "achievement") => ({ profileDraft: { awards: [{ ...award, ...(kind ? { kind } : {}) }] }, improvements: [], warnings: [] }) as never;
    expect(validateAiSemantics("extractResumeProfile", input, output()).map((issue) => issue.code)).toContain("achievement_type_missing");
    expect(validateAiSemantics("extractResumeProfile", input, output("award")).map((issue) => issue.code)).toContain("participation_is_not_award");
    expect(validateAiSemantics("extractResumeProfile", input, output("achievement"))).toEqual([]);
  });
  it("also flags ambiguous credential issuers and removes generic education start-year advice", () => {
    const input = { resumeText: "M&A & Competitive Strategies | Wharton (Kellogg School of Management – USA 2016\nBachelor of Business | Delhi University, 1995" } as never;
    const output = { profileDraft: { certifications: [{ id: "c", name: "M&A & Competitive Strategies", issuer: "Wharton (Kellogg School of Management – USA", date: "2016", credentialUrl: "" }] }, improvements: [{ field: "education", observed: "Delhi University, 1995", inference: "The graduation year is present, but start dates are missing.", suggestion: "Consider adding the start years for your educational qualifications." }], warnings: [] } as never;
    const result = sanitizeAiOutput("extractResumeProfile", input, output);
    expect(result.warnings).toEqual([expect.stringContaining("Confirm the exact awarding institution")]);
    expect(result.improvements).toEqual([]);
  });
  it("grounds non-Latin employer names rather than treating them as empty text", () => {
    const role = { id: "r", employer: "東京会社", title: "営業部長", startDate: "", endDate: "", achievements: [] };
    const input = { resumeText: "東京会社 営業部長", deterministicDraft: { experience: [role] } } as never;
    const output = { profileDraft: { experience: [role] }, improvements: [], warnings: [] };
    expect(validateAiSemantics("transformResumeProfile", input, output)).toEqual([]);
    output.profileDraft.experience = [{ ...role, employer: "大阪会社" }];
    expect(validateAiSemantics("transformResumeProfile", input, output).map((issue) => issue.code)).toContain("unsupported_claim");
  });
  it("does not accept an empty or token role rewrite when the source has substantive achievements", () => {
    const role = { id: "r", employer: "Example", title: "Director", startDate: "", endDate: "", achievements: [
      "Led a regional service team across multiple offices and improved customer response times.",
      "Launched a new enterprise offering with sales and engineering partners in three markets.",
      "Rebuilt the onboarding process for major accounts and coached the delivery managers.",
    ] };
    const input = { resumeText: `Director at Example. ${role.achievements.join(" ")}`, deterministicDraft: { experience: [role] } } as never;
    const result = { profileDraft: { experience: [{ ...role, achievements: ["Managed a team."] }] }, improvements: [], warnings: [] };
    expect(validateAiSemantics("transformResumeProfile", input, result as never).map((issue) => issue.code)).toContain("substantive_role_underwritten");
    result.profileDraft.experience[0].achievements = [
      "Led a regional service team across multiple offices and improved customer response times.",
      "Launched an enterprise offering with sales and engineering partners in three markets.",
    ];
    expect(validateAiSemantics("transformResumeProfile", input, result as never)).toEqual([]);
  });
  it("does not present invented learning courses as verified recommendations", () => {
    const input = { availableCourses: [{ id: "verified-course" }] } as never;
    const output = { priorities: [{ skill: "Portfolio strategy", reason: "Relevant to the target role.", practiceProject: "Document one real portfolio decision.", courseIds: ["made-up-course"] }] };
    expect(validateAiSemantics("recommendUpskilling", input, output as never).map((issue) => issue.code)).toContain("unknown_course");
    output.priorities[0].courseIds = ["verified-course"];
    expect(validateAiSemantics("recommendUpskilling", input, output as never)).toEqual([]);
  });
  it("limits job advice to unique listings in the approved current result set", () => {
    const input = { approvedJobs: [{ id: "approved-1" }] } as never;
    const output = { matches: [{ jobId: "approved-1" }, { jobId: "approved-1" }, { jobId: "invented" }] } as never;
    expect(validateAiSemantics("researchJobs", input, output).map((issue) => issue.code)).toEqual(expect.arrayContaining(["duplicate_job", "unknown_job"]));
  });
  it("allows concise descriptions when the source gives only sparse role evidence", () => {
    const role = { id: "r", employer: "Example", title: "Intern", startDate: "", endDate: "", achievements: ["Assisted the team."] };
    const input = { resumeText: "Intern at Example. Assisted the team.", deterministicDraft: { experience: [role] } } as never;
    const result = { profileDraft: { experience: [{ ...role, achievements: [] }] }, improvements: [], warnings: [] };
    expect(validateAiSemantics("transformResumeProfile", input, result as never)).toEqual([]);
  });
  it("rejects privacy placeholders in transformation explanations, not just career records", () => {
    const input = { resumeText: "Operations manager", deterministicDraft: {} } as never;
    const output = { profileDraft: {}, improvements: [{ field: "contact", observed: "[redacted phone]", inference: "", suggestion: "Keep contact details together" }], warnings: [] };
    expect(validateAiSemantics("transformResumeProfile", input, output).map((issue) => issue.code)).toContain("unresolved_placeholder");
    output.improvements[0].observed = "Contact details appear in more than one location.";
    expect(validateAiSemantics("transformResumeProfile", input, output)).toEqual([]);
  });
  it("rejects privacy placeholders in customer-facing review examples", () => {
    const input = { resumeText: "Led customer operations and improved the service process." } as never;
    const output = { summary: "Review", limitations: [], topActions: [{ observed: "Contact details", inference: "", suggestion: "Use a concise contact line", originalExcerpt: "", improvedExample: "[redacted phone] | [redacted email]" }] };
    expect(validateAiSemantics("analyzeResume", input, output).map((issue) => issue.code)).toContain("unresolved_placeholder");
  });
  it("drops a provider caveat that only repeats a private-data marker", () => {
    const input = { resumeText: "Led customer operations and improved the service process." } as never;
    const output = { summary: "The resume has relevant operations experience but needs clearer impact.", limitations: ["Confirm every claim.", "The source included [redacted phone]."], topActions: [] } as never;
    const result = sanitizeAiOutput("analyzeResume", input, output);
    expect(result.limitations).toEqual(["Confirm every claim."]);
    expect(validateAiSemantics("analyzeResume", input, result)).toEqual([]);
  });
  it("does not accuse a candidate of a PDF text-extraction split as a resume typo", () => {
    const input = { resumeText: "Build ing Community and Loyalty program through Partnerships" } as never;
    const output = { summary: "The resume has a useful partnership example but needs clearer outcomes.", limitations: [], topActions: [{ observed: "The phrase Build ing contains a spacing typo.", inference: "This weakens the presentation.", suggestion: "Fix the typo.", originalExcerpt: "Build ing Community and Loyalty program through Partnerships", improvedExample: "Built community and loyalty programs through partnerships." }] } as never;
    expect(validateAiSemantics("analyzeResume", input, output).map((issue) => issue.code)).toContain("possible_extraction_artifact");
  });
  it("rejects an ATS column warning that contradicts the authoritative layout finding", () => {
    const input = { resumeText: "Core skills\nProduct strategy and analytics\nExperience\nLed portfolio delivery.", deterministicReview: { score: 78, factors: [{ id: "formatting", earned: 8, maximum: 10, issues: [] as Array<{ severity: string; message: string }>, evidence: ["No obvious visual-layout concern was detected."] }] } };
    const output = { summary: "The resume has strong results, but side-by-side columns are its main ATS parsing weakness.", limitations: [], topActions: [{ observed: "The skills are arranged in two columns.", inference: "ATS parsing may scramble them.", suggestion: "Use a single-column list.", originalExcerpt: "", improvedExample: "" }] } as never;
    expect(validateAiSemantics("analyzeResume", input as never, output).map((issue) => issue.code)).toEqual(expect.arrayContaining(["unsupported_layout_priority", "unsupported_layout_risk"]));
    const confirmedInput = { ...input, deterministicReview: { ...input.deterministicReview, factors: [{ ...input.deterministicReview.factors[0], issues: [{ severity: "Medium", message: "A confirmed reading-order concern." }] }] } } as never;
    expect(validateAiSemantics("analyzeResume", confirmedInput, output)).toEqual([]);
  });
  it("requires substantive review depth and recognizes a nonstandard skills heading", () => {
    const resumeText = `Executive Profile\nKey Impact Areas\nBusiness Development\nChannel Management\nSoft Skills\nCommunicator\n${"Led regional sales and customer operations. ".repeat(100)}`;
    expect(reviewEvidence(resumeText).map((span) => span.text)).toEqual(expect.arrayContaining(["Key Impact Areas", "Business Development", "Soft Skills"]));
    const input = { resumeText } as never;
    const action = { observed: "The resume lacks a dedicated skills section.", inference: "Skills are missing.", suggestion: "Add skills.", originalExcerpt: "", improvedExample: "" };
    const output = { summary: "Performance-oriented sales leader with experience in regional management.", limitations: [], topActions: [action, { ...action, observed: "Improve the profile summary." }] };
    expect(validateAiSemantics("analyzeResume", input, output).map((issue) => issue.code)).toContain("summary_is_candidate_bio");
    expect(validateAiSemantics("analyzeResume", input, output).map((issue) => issue.code)).toEqual(expect.arrayContaining(["insufficient_review_depth", "misread_skills_section"]));
    output.summary = "The resume lists valuable regional experience, but the impact evidence needs clearer grouping and context.";
    output.topActions = [
      { ...action, observed: "The existing Key Impact Areas list can be grouped by relevance.", inference: "Its strengths are hard to scan." },
      { ...action, observed: "Clarify the profile summary.", inference: "The opening is broad." },
      { ...action, observed: "Show outcomes for leadership work.", inference: "The evidence is brief." },
    ];
    expect(validateAiSemantics("analyzeResume", input, output)).toEqual([]);
  });
  it("does not treat record ID digits as evidence for a new achievement", () => {
    const role = { id: "role-998877", employer: "Example", title: "Manager", startDate: "", endDate: "", achievements: [] };
    const input = { resumeText: "Manager at Example", deterministicDraft: { experience: [role] } } as never;
    const output = { profileDraft: { experience: [{ ...role, achievements: ["Generated 998877 in revenue"] }] }, improvements: [], warnings: [] } as never;
    expect(validateAiSemantics("transformResumeProfile", input, output).map((issue) => issue.code)).toContain("unsupported_numeric_claim");
  });
  it("resolves short LinkedIn references only to the current profile records", () => {
    const input = { profile: { fullName: "Test Candidate", experience: [{ id: "uuid-a" }, { id: "uuid-b" }] } } as never;
    const output = { experience: [{ roleId: "career_record_2", text: "Role B" }, { roleId: "career_record_99", text: "Unknown" }] } as never;
    expect(sanitizeAiOutput("generateLinkedInMakeover", input, output).experience.map((role) => role.roleId)).toEqual(["uuid-b", "career_record_99"]);
  });
  it("rejects old transformed drafts with corrupted or missing career references", () => {
    const role = { id: "original-role", employer: "Example", title: "Manager", startDate: "", endDate: "", achievements: [] };
    const input = { resumeText: "Manager at Example", deterministicDraft: { experience: [role] } } as never;
    const output = { profileDraft: { experience: [{ ...role, id: "[redacted phone]" }] }, improvements: [], warnings: [] } as never;
    expect(validateAiSemantics("transformResumeProfile", input, output).map((issue) => issue.code)).toEqual(expect.arrayContaining(["invalid_record_reference", "missing_record_reference"]));
  });
  it("requires LinkedIn copy to cover known roles once and rejects invented metrics", () => {
    const input = { profile: { experience: [{ id: "a", achievements: ["Led 12 people"] }, { id: "b", achievements: [] }] } } as never;
    const output = { headlines: ["Manager", "Team leader"], about: "Led 12 people", experience: [{ roleId: "a", text: "Led 12 people" }, { roleId: "b", text: "Supported operations" }] } as never;
    expect(validateAiSemantics("generateLinkedInMakeover", input, output)).toEqual([]);
    const invalid = { ...output as object, experience: [{ roleId: "a", text: "Led 99 people" }, { roleId: "a", text: "Other" }, { roleId: "unknown", text: "Other" }] } as never;
    expect(validateAiSemantics("generateLinkedInMakeover", input, invalid).map((issue) => issue.code)).toEqual(expect.arrayContaining(["duplicate_role", "unknown_role", "missing_role", "unsupported_numeric_claim"]));
  });
  it("preserves confirmed chronology when rewriting the same identified role", () => {
    const role = { id: "r", employer: "Example", title: "Manager", startDate: "", endDate: "Present", achievements: [] };
    const input = { resumeText: "Manager at Example", deterministicDraft: { experience: [role] } } as never;
    const output = { profileDraft: { experience: [{ ...role, startDate: "2020-01-01", endDate: "2026-09-25" }] }, improvements: [], warnings: [] } as never;
    const result = sanitizeAiOutput("transformResumeProfile", input, output);
    expect(result.profileDraft.experience?.[0].startDate).toBe("");
    expect(result.profileDraft.experience?.[0].endDate).toBe("Present");
  });
  it("does not accept invented precise extraction dates while retaining career records", () => {
    const input = { resumeText: "Example Manager September 2023 - Present. MBA completed 2010." } as never;
    const output = { profileDraft: { experience: [{ id: "r", employer: "Example", title: "Manager", startDate: "2023-09-25", endDate: "2026-09-25", achievements: [] }], education: [{ id: "e", institution: "School", qualification: "MBA", startDate: "", endDate: "2010" }] }, warnings: [], improvements: [] };
    const result = sanitizeAiOutput("extractResumeProfile", input, output);
    expect(result.profileDraft.experience?.[0].startDate).toBe("");
    expect(result.profileDraft.experience?.[0].endDate).toBe("");
    expect(result.profileDraft.education?.[0].endDate).toBe("2010");
    expect(result.warnings).toHaveLength(1);
  });
  it("does not turn job-description numbers into candidate cover-letter achievements", () => {
    const input = { profile: { summary: "Led a team of 14." }, jobDescription: "Grow revenue by 80%." } as never;
    const output = { paragraphs: ["I grew revenue by 80%."], closing: "Yours sincerely" } as never;
    expect(validateAiSemantics("generateCoverLetter", input, output).map((issue) => issue.code)).toContain("unsupported_numeric_claim");
  });
  it("rejects a generated letter that passes word count but cannot be exported", () => {
    const input = { profile: { summary: "Product leader" } } as never;
    const longParagraph = Array.from({ length: 260 }, () => "verified").join(" ");
    const output = { greeting: "Dear Hiring Manager", paragraphs: [longParagraph, "Brief."], closing: "Yours sincerely" } as never;
    const codes = validateAiSemantics("generateCoverLetter", input, output).map((issue) => issue.code);
    expect(codes).toContain("letter_paragraph_count");
    expect(codes).toContain("letter_paragraph_size");
    expect(codes).not.toContain("letter_length");
  });
  it("resolves selected review evidence to the exact source and rejects invented IDs", () => {
    const resumeText = "Created a customer measurement framework.         Built the product leadership playbook.\nCustomer trust rose by 12 points in two quarters.";
    const input = { resumeText } as never;
    const output = { summary: "Review", limitations: [], topActions: [{ observed: "Project evidence", inference: "", suggestion: "Clarify the outcome", originalExcerpt: "", sourceExcerptId: reviewEvidence(resumeText)[0].id, improvedExample: "" }] };
    const resolved = sanitizeAiOutput("analyzeResume", input, output);
    expect(resolved.topActions[0].originalExcerpt).toBe(resumeText.split("\n")[0]);
    expect(validateAiSemantics("analyzeResume", input, resolved)).toEqual([]);
    resolved.topActions[0].sourceExcerptId = "q999";
    expect(validateAiSemantics("analyzeResume", input, resolved).map((issue) => issue.code)).toContain("unknown_evidence");
  });
  it("removes duplicate letter paragraphs and keeps a clean signoff while restoring only the confirmed name", () => {
    const input = { profile: { fullName: "Confirmed Candidate" } } as never;
    const output = { paragraphs: ["First paragraph.", "Second paragraph.", "Final paragraph.", "Final paragraph."], closing: "Sincerely, [redacted fullName]", subject: "Application from [redacted fullName]" } as never;
    const result = sanitizeAiOutput("generateCoverLetter", input, output);
    expect(result.paragraphs).toHaveLength(3);
    expect(result.closing).toBe("Sincerely");
    expect(result.subject).toContain("Confirmed Candidate");
    expect(validateAiSemantics("generateCoverLetter", input, result).map((issue) => issue.code)).toContain("letter_length");
  });
  it("accepts decimal and percentage spacing introduced by PDF extraction", () => {
    const input = aiTaskSchemas.transformResumeProfile.input.parse({ resumeText: "Director at Example: Delivered $ 0 . 5 M revenue and saved 60 % in costs through better planning.", deterministicDraft: {} });
    const output = aiTaskSchemas.transformResumeProfile.output.parse({ profileDraft: { headline: "Director", summary: "Delivered $0.5M revenue and saved 60% in costs.", experience: [{ id: "role", title: "Director", employer: "Example", startDate: "", endDate: "", achievements: [] }] }, improvements: [{ field: "summary", observed: "Delivered revenue", inference: "", suggestion: "Clarified the wording." }], warnings: [] });
    expect(validateAiSemantics("transformResumeProfile", input, output)).toEqual([]);
    output.profileDraft.summary = "Delivered $0.8M revenue and saved 70% in costs.";
    expect(validateAiSemantics("transformResumeProfile", input, output).filter((issue) => issue.code === "unsupported_numeric_claim")).toHaveLength(2);
  });
});
