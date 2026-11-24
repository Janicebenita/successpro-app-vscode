import { describe, it, expect } from "vitest";
import { analyzeResume, ALL_PARAMETER_IDS } from "@successpro/domain";
import { buildWorkbookReview } from "./successpro-v2-review";

const resumeText = `
Abhishek Agarwal
Email: abhishek@example.com | Phone: +91 9876543210 | Bengaluru, India
LinkedIn: linkedin.com/in/abhishek-agarwal

Professional Summary
Senior Full Stack Engineer with 7+ years of experience building high-scale distributed systems and web applications using Node.js, TypeScript, React, and AWS. Demonstrated expertise in improving system performance and leading agile teams.

Experience
Lead Software Engineer | Acme Corporation | 2021 – Present
• Architected and deployed microservices backend processing 15M daily requests with 99.99% uptime.
• Reduced API response latency by 42% through Redis caching and query optimization.
• Mentored a team of 8 engineers and conducted regular code reviews to ensure code quality.

Software Engineer | TechCorp Inc. | 2018 – 2021
• Developed customer-facing React web portal serving 200,000 monthly active users.
• Integrated Stripe and Razorpay payment gateways handling $2M in annual transactions.
• Collaborated with product designers to build responsive, accessible UI components.

Education
Bachelor of Technology in Computer Science
National Institute of Technology | 2014 – 2018

Skills
Languages: JavaScript, TypeScript, Python, SQL, HTML, CSS
Frameworks: React, Next.js, Node.js, Express, TailwindCSS
Databases & Cloud: PostgreSQL, MongoDB, Redis, AWS, Docker, Git
`;

describe("Content Quality Verification", () => {
  it("properly assesses and verifies Content Quality when signals have undefined extractionReliable", () => {
    const input = {
      text: resumeText,
      targetKeywords: ["TypeScript", "React", "Node.js", "AWS"],
      jobDescription: "",
      documentSignals: {
        pageCount: 1,
        hasVisualEvidence: true,
        geminiPageFindings: [{ page: 1, confidence: 0.95, observations: [], warnings: [] }],
        geminiVisualCriteria: ALL_PARAMETER_IDS.filter(id => id.startsWith("V")).map(code => ({
          code,
          rating: 4,
          confidence: 0.9,
          pages: [1],
          evidence: "Visual evidence grounded on page 1",
          recommendation: "Maintain consistent styling across headings.", anchorText: "Strong evidence with a limited shortfall", anchorJustification: "Rendered headings are visible with minor spacing issues.", nextAnchorGap: "Keep heading spacing uniform."
        }))
        // extractionReliable is intentionally left undefined as occurs during real uploads
      }
    };

    const output = {
      summary: "Comprehensive assessment of senior engineer resume.",
      topActions: [],
      limitations: [],
      meaningfulJd: false,
      workbookAssessments: [
        { id: "C01" as const, status: "Assessed" as const, rating: 4, evidence: { excerpt: "Senior Full Stack Engineer with 7+ years of experience building high-scale distributed systems", location: "Summary", rationale: "Clear role positioning" } },
        { id: "C02" as const, status: "Assessed" as const, rating: 5, evidence: { excerpt: "Architected and deployed microservices backend processing 15M daily requests with 99.99% uptime.", location: "Acme Corp", rationale: "Strong experience and capability" } },
        { id: "C03" as const, status: "Assessed" as const, rating: 5, evidence: { excerpt: "Reduced API response latency by 42% through Redis caching and query optimization.", location: "Acme Corp", rationale: "Quantified achievement" } },
        { id: "C04" as const, status: "Assessed" as const, rating: 4, evidence: { excerpt: "Languages: JavaScript, TypeScript, Python, SQL, HTML, CSS", location: "Skills", rationale: "Comprehensive domain skills" } },
        { id: "C05" as const, status: "Assessed" as const, rating: 4, evidence: { excerpt: "Bachelor of Technology in Computer Science", location: "Education", rationale: "Documented accredited degree" } },
        { id: "C06" as const, status: "Assessed" as const, rating: 5, evidence: { excerpt: "Email: abhishek@example.com | Phone: +91 9876543210 | Bengaluru, India", location: "Header", rationale: "Complete contact information" } },
        { id: "C07" as const, status: "Assessed" as const, rating: 4, evidence: { excerpt: "Mentored a team of 8 engineers and conducted regular code reviews to ensure code quality.", location: "Acme Corp", rationale: "Clear, concise professional phrasing" } },
        { id: "C08" as const, status: "Assessed" as const, rating: 4, evidence: { excerpt: "Lead Software Engineer | Acme Corporation | 2021 – Present", location: "Experience", rationale: "Consistent chronological career timeline" } },
        { id: "C09" as const, status: "Assessed" as const, rating: 4, evidence: { excerpt: "Developed customer-facing React web portal serving 200,000 monthly active users.", location: "TechCorp", rationale: "Selected high-impact evidence" } }
      ],
      jdRequirements: []
    };

    const base = analyzeResume(input);
    const result = buildWorkbookReview(base, input, output, true);

    // Verify Content Quality is properly evaluated and not stuck at 0% / Pending
    expect(result.contentQualityScore).toBeGreaterThanOrEqual(75);
    expect(result.v2?.pillars.content.state).toBe("Assessed");
    expect(result.v2?.pillars.content.confirmedEarned).toBeGreaterThan(45);
    expect(result.v2?.pillars.content.pendingMaxPoints).toBe(0);
    expect(result.v2?.scoreStatus).toBe("completed");
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it("keeps Visual Presentation pending when only standard document signals exist", () => {
    const input = {
      text: resumeText,
      targetKeywords: ["TypeScript", "React", "Node.js", "AWS"],
      jobDescription: "",
      documentSignals: {
        pageCount: 1,
        hasVisualEvidence: true,
        multiColumn: false,
        smallText: false,
        crowdedLayout: false,
        inconsistentMargins: false,
        // Standard upload without AI vision page findings
      }
    };

    const output = {
      summary: "Standard resume assessment.",
      topActions: [],
      limitations: [],
      meaningfulJd: false,
      workbookAssessments: [
        { id: "C01" as const, status: "Assessed" as const, rating: 4, evidence: { excerpt: "Senior Full Stack Engineer with 7+ years of experience building high-scale distributed systems", location: "Summary", rationale: "Clear role positioning" } },
        { id: "C02" as const, status: "Assessed" as const, rating: 5, evidence: { excerpt: "Architected and deployed microservices backend processing 15M daily requests with 99.99% uptime.", location: "Acme Corp", rationale: "Strong experience and capability" } },
        { id: "C03" as const, status: "Assessed" as const, rating: 5, evidence: { excerpt: "Reduced API response latency by 42% through Redis caching and query optimization.", location: "Acme Corp", rationale: "Quantified achievement" } },
        { id: "C04" as const, status: "Assessed" as const, rating: 4, evidence: { excerpt: "Languages: JavaScript, TypeScript, Python, SQL, HTML, CSS", location: "Skills", rationale: "Comprehensive domain skills" } },
        { id: "C05" as const, status: "Assessed" as const, rating: 4, evidence: { excerpt: "Bachelor of Technology in Computer Science", location: "Education", rationale: "Documented accredited degree" } },
        { id: "C06" as const, status: "Assessed" as const, rating: 5, evidence: { excerpt: "Email: abhishek@example.com | Phone: +91 9876543210 | Bengaluru, India", location: "Header", rationale: "Complete contact information" } },
        { id: "C07" as const, status: "Assessed" as const, rating: 4, evidence: { excerpt: "Mentored a team of 8 engineers and conducted regular code reviews to ensure code quality.", location: "Acme Corp", rationale: "Clear, concise professional phrasing" } },
        { id: "C08" as const, status: "Assessed" as const, rating: 4, evidence: { excerpt: "Lead Software Engineer | Acme Corporation | 2021 – Present", location: "Experience", rationale: "Consistent chronological career timeline" } },
        { id: "C09" as const, status: "Assessed" as const, rating: 4, evidence: { excerpt: "Developed customer-facing React web portal serving 200,000 monthly active users.", location: "TechCorp", rationale: "Selected high-impact evidence" } }
      ],
      jdRequirements: []
    };

    const base = analyzeResume(input);
    const result = buildWorkbookReview(base, input, output, true);

    expect(result.contentQualityScore).toBeGreaterThanOrEqual(75);
    expect(result.visualDesignScore).toBeNull();
    expect(result.v2?.pillars.content.state).toBe("Assessed");
    expect(result.v2?.pillars.visual.state).toBe("Pending");
    expect(result.v2?.pillars.visual.pendingMaxPoints).toBeCloseTo(35);
    expect(result.v2?.scoreStatus).toBe("score_pending");
    expect(result.score).toBeNull();
  });
});
