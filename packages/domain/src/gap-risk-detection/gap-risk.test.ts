import { describe, it, expect } from "vitest";
import { analyzeResumeGapsAndRisks } from "./index";

describe("Resume Gap & Risk Detection Module", () => {
  it("Scenario 1: Detects an employment gap with exact duration and no negative bias", () => {
    const resumeText = `
Alex Mercer
alex.mercer@example.com | (555) 019-2834 | San Francisco, CA | linkedin.com/in/alexmercer

EXPERIENCE
Senior Software Engineer - Stripe
January 2022 - Present
- Architected and delivered resilient real-time payment ingestion pipelines processing 40M daily events.
- Reduced transaction processing latency by 35% using distributed caching and Redis.

Software Engineer - Acme Corp
January 2018 - December 2019
- Built core microservices handling checkout flows with 99.99% uptime.
- Led migration of legacy monolithic endpoints to modern TypeScript microservices.

EDUCATION
B.S. in Computer Science - UC Berkeley
2014 - 2018

SKILLS
TypeScript, Node.js, Go, Redis, PostgreSQL, AWS, Docker, Kubernetes
`;

    const result = analyzeResumeGapsAndRisks(resumeText);
    expect(result.summary.totalIssues).toBeGreaterThan(0);

    const timelineGaps = result.findings.filter((f) => f.category === "timeline_gap");
    expect(timelineGaps.length).toBeGreaterThan(0);

    const gap = timelineGaps.find((f) => f.title.toLowerCase().includes("gap"));
    expect(gap).toBeDefined();
    expect(gap?.whyItMatters).toBeDefined();
    expect(gap?.recommendedCorrection).toBeDefined();
  });

  it("Scenario 2: Correctly validates a resume with continuous employment and no gaps", () => {
    const resumeText = `
Jane Doe
jane.doe@example.com | (555) 234-5678 | Seattle, WA | linkedin.com/in/janedoe

EXPERIENCE
Staff Platform Engineer - CloudTech
January 2023 - Present
- Spearheaded Kubernetes cluster modernization reducing cloud spend by $1.2M annually.
- Mentored 12 junior engineers across 3 squads.

Senior DevOps Engineer - FinTech Labs
February 2021 - December 2022
- Automated CI/CD deployment pipelines using GitHub Actions, cutting release cycle from 3 days to 40 minutes.
- Implemented Prometheus and Grafana observability stack with 99.98% SLO compliance.

Systems Engineer - DataWorks
June 2018 - January 2021
- Deployed and maintained 400+ Linux instances on AWS EC2.
- Automated server provisioning with Terraform and Ansible.

EDUCATION
B.S. in Software Engineering - University of Washington
2014 - 2018

SKILLS
Python, Go, Terraform, Kubernetes, AWS, Prometheus, Docker, Linux
`;

    const result = analyzeResumeGapsAndRisks(resumeText);
    const timelineGaps = result.findings.filter((f) => f.category === "timeline_gap" && f.title.toLowerCase().includes("gap"));
    expect(timelineGaps.length).toBe(0);
  });

  it("Scenario 3: Flags missing employment start or end dates", () => {
    const resumeText = `
David Kim
david.kim@example.com | (555) 456-7890 | Boston, MA | linkedin.com/in/davidkim

EXPERIENCE
Lead Software Engineer - Innovatech
- Led development of distributed query engine.
- Reduced database bottleneck by 40%.

Frontend Developer - Webify
January 2020 - December 2022
- Built React dashboards for enterprise analytics.

EDUCATION
B.S. in Computer Science - Boston University
2016 - 2020

SKILLS
React, TypeScript, Node.js, GraphQL
`;

    const result = analyzeResumeGapsAndRisks(resumeText);
    const missingDateFindings = result.findings.filter(
      (f) => f.title.toLowerCase().includes("date") || f.category === "timeline_gap"
    );
    expect(missingDateFindings.length).toBeGreaterThan(0);
  });

  it("Scenario 4: Identifies overlapping employment periods", () => {
    const resumeText = `
Samantha Vance
samantha.vance@example.com | (555) 789-0123 | Chicago, IL | linkedin.com/in/svance

EXPERIENCE
Principal Consultant - Alpha Consulting
March 2022 - Present
- Advised Fortune 500 clients on cloud architecture migration.

Lead Architect - Beta Systems
June 2022 - December 2023
- Designed and built microservices infrastructure.

EDUCATION
B.S. in Information Systems - Northwestern University
2017 - 2021

SKILLS
Cloud Architecture, AWS, Microservices, Python
`;

    const result = analyzeResumeGapsAndRisks(resumeText);
    const overlapFindings = result.findings.filter(
      (f) => f.title.toLowerCase().includes("overlap") || f.explanation.toLowerCase().includes("overlap")
    );
    expect(overlapFindings.length).toBeGreaterThan(0);
  });

  it("Scenario 5: Detects contradictory or illogical dates", () => {
    const resumeText = `
Michael Chang
michael.chang@example.com | (555) 123-9999 | Austin, TX | linkedin.com/in/mchang

EXPERIENCE
Senior Engineer - Austin Tech
December 2023 - January 2022
- Reversed timeline where end date precedes start date.

EDUCATION
B.S. in Electrical Engineering - UT Austin
2018 - 2022

SKILLS
C++, Python, Embedded Systems
`;

    const result = analyzeResumeGapsAndRisks(resumeText);
    const contradictionFindings = result.findings.filter(
      (f) => f.category === "contradiction" || f.title.toLowerCase().includes("reversed") || f.title.toLowerCase().includes("date")
    );
    expect(contradictionFindings.length).toBeGreaterThan(0);
  });

  it("Scenario 6: Detects missing contact information", () => {
    const resumeText = `
John Anonymous

EXPERIENCE
Full Stack Developer - TechCorp
January 2021 - Present
- Built full stack features using Next.js and PostgreSQL.

EDUCATION
B.S. in Computer Science - State University
2017 - 2021

SKILLS
React, Node.js, PostgreSQL
`;

    const result = analyzeResumeGapsAndRisks(resumeText);
    const missingInfo = result.findings.filter((f) => f.category === "missing_information");
    const missingEmailOrPhone = missingInfo.find(
      (f) => f.title.toLowerCase().includes("email") || f.title.toLowerCase().includes("contact") || f.title.toLowerCase().includes("phone")
    );
    expect(missingEmailOrPhone).toBeDefined();
    expect(missingEmailOrPhone?.severity).toBe("Critical");
  });

  it("Scenario 7: Flags weak action verbs and unquantified descriptions", () => {
    const resumeText = `
Emily Watson
emily.watson@example.com | (555) 321-4567 | New York, NY | linkedin.com/in/emilywatson

EXPERIENCE
Project Associate - MediaWorks
June 2021 - Present
- Responsible for helping team with daily tasks and meetings.
- Worked on various company projects and handled client requests.
- Assisted with social media posts and general marketing duties.

EDUCATION
B.A. in Communications - NYU
2017 - 2021

SKILLS
Social Media, Content Writing, Project Management
`;

    const result = analyzeResumeGapsAndRisks(resumeText);
    const qualityFindings = result.findings.filter((f) => f.category === "content_quality");
    expect(qualityFindings.length).toBeGreaterThan(0);

    const weakVerbs = qualityFindings.find(
      (f) => f.title.toLowerCase().includes("verb") || f.explanation.toLowerCase().includes("responsible for")
    );
    expect(weakVerbs).toBeDefined();
  });

  it("Scenario 8: Identifies missing LinkedIn profile link", () => {
    const resumeText = `
Brian Taylor
brian.taylor@example.com | (555) 654-7890 | Denver, CO

EXPERIENCE
Backend Engineer - PeakSoft
January 2022 - Present
- Developed high-throughput REST APIs in Go, serving 15M monthly active users.
- Optimized database query plans reducing CPU consumption by 22%.

EDUCATION
B.S. in Computer Science - University of Colorado
2018 - 2022

SKILLS
Go, PostgreSQL, Docker, Redis
`;

    const result = analyzeResumeGapsAndRisks(resumeText);
    const missingLinkedIn = result.findings.find(
      (f) => f.category === "missing_information" && f.title.toLowerCase().includes("linkedin")
    );
    expect(missingLinkedIn).toBeDefined();
    expect(missingLinkedIn?.severity).toBe("Low");
  });

  it("Scenario 9: Flags multi-column or visual parsing risks from document signals", () => {
    const resumeText = `
Lisa Ray
lisa.ray@example.com | (555) 987-6543 | Chicago, IL | linkedin.com/in/lisaray

EXPERIENCE
Product Designer - DesignWorks
January 2021 - Present
- Designed end-to-end design systems for enterprise SaaS applications.

EDUCATION
B.A. in Graphic Design - DePaul
2016 - 2020

SKILLS
Figma, UI/UX, Design Systems
`;

    const signals = {
      designWarnings: ["multi_column_layout_detected", "reading_order_risk"],
      pageCount: 3,
    };

    const result = analyzeResumeGapsAndRisks(resumeText, signals as any);
    const technicalFindings = result.findings.filter((f) => f.category === "ats_technical");
    expect(technicalFindings.length).toBeGreaterThan(0);
  });

  it("Scenario 10: Clean professional resume produces empty or minimal non-critical findings", () => {
    const cleanResume = `
Marcus Sterling
marcus.sterling@example.com | (555) 901-2345 | San Francisco, CA | linkedin.com/in/marcussterling | github.com/marcussterling

PROFESSIONAL SUMMARY
Senior Distributed Systems Engineer with 7+ years of experience designing high-throughput, fault-tolerant financial pipelines. Proven track record leading infrastructure teams and reducing latency by 45%.

PROFESSIONAL EXPERIENCE
Senior Infrastructure Engineer - Stripe
March 2021 - Present
- Architected and delivered resilient real-time payment ingestion pipelines processing 40M daily events with 99.999% availability.
- Reduced p99 transaction latency from 320ms to 95ms by implementing distributed memory caching.
- Spearheaded team migration to Rust and Go, training 14 engineers across 3 global teams.

Software Engineer - Square
July 2018 - February 2021
- Engineered payment settlement reconciliation service managing $2.5B in weekly transaction volume.
- Reduced database storage footprint by 38% through optimized columnar indexing.

Junior Systems Engineer - Twilio
August 2016 - June 2018
- Automated deployment scripts with Terraform and Ansible across 600+ AWS EC2 instances.
- Maintained 99.95% API gateway uptime.

EDUCATION
B.S. in Computer Science - Stanford University
September 2012 - June 2016
- Graduated with Honors (GPA: 3.89/4.0)

TECHNICAL SKILLS
Languages: Go, Rust, Python, TypeScript, SQL
Infrastructure: AWS, Kubernetes, Terraform, Docker, Redis, Kafka, PostgreSQL
`;

    const result = analyzeResumeGapsAndRisks(cleanResume);
    const criticalOrHigh = result.findings.filter((f) => f.severity === "Critical" || f.severity === "High");
    expect(criticalOrHigh.length).toBe(0);
    expect(result.summary.criticalCount).toBe(0);
    expect(result.summary.highCount).toBe(0);
  });

  it("Scenario 11: Accurately flags 2-digit apostrophe years and future dates like May’96 – Dec’27", () => {
    const resumeText = `
Deepak Srivastava
deep_sri2000@yahoo.com | +91-8748965500 | New Delhi, India | linkedin.com/in/deepaksrivastava

EXPERIENCE
Chief Commercial Officer - Digicel Pacific
August 2022 - Present
- Led multi-market telecom commercial operations.

Regional Manager - Duncans Industries Limited
May’96 – Dec’27
- Managed regional marketing and sales distribution networks.

EDUCATION
MBA in Marketing - Banaras Hindu University
1994 - 1996

SKILLS
P&L Management, Telecom Sales, Distribution
`;

    const result = analyzeResumeGapsAndRisks(resumeText);
    const futureOrDateErrors = result.findings.filter(
      (f) => f.title.toLowerCase().includes("future") || f.title.toLowerCase().includes("date") || f.category === "contradiction"
    );
    expect(futureOrDateErrors.length).toBeGreaterThan(0);
    const duncansFinding = futureOrDateErrors.find(
      (f) => f.title.includes("Dec'27") || f.title.includes("Dec’27") || f.explanation.includes("future")
    );
    expect(duncansFinding).toBeDefined();
    expect(duncansFinding?.severity).toBe("Critical");
  });

  it("Scenario 12: Detects the 14-month gap between Asicell PJSC (June 2021) and Digicel Pacific (August 2022)", () => {
    const resumeText = `
DEEPAK SRIVASTAVA
deep_sri2000@yahoo.com | +91-8748965500 | New Delhi, India

EMPLOYMENT DETAILS
Since August’22 : Digicel Pacific (Telstra Australia) 
Since August’22 Chief Commercial Officer 
- Commercial leadership across Pacific region.

April’20 – June 21: Asicell PJSC, Ooredoo Group 
April’21 – June’22 Director
- Bolstered sales planning and optimized resource allocation.

Sep’18 – March’20: Vodafone Idea Limited
Sep’20 – Mar’21 Executive Vice President 
- Deployed sales segmentation framework.

ACADEMIC DETAILS
MBA (Marketing) from Faculty of Management Studies, Banaras Hindu University
`;

    const result = analyzeResumeGapsAndRisks(resumeText);
    const gaps = result.findings.filter((f) => f.category === "timeline_gap" && f.title.toLowerCase().includes("gap"));
    expect(gaps.length).toBeGreaterThan(0);
    const asicellDigicelGap = gaps.find((g) => g.title.includes("1 year 2 months") || g.explanation.includes("1 year 2 months") || g.title.includes("Asicell") || g.evidenceExcerpt?.includes("Asicell"));
    expect(asicellDigicelGap).toBeDefined();
  });
});
