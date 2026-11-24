import type { ResumeAnalysisInput } from "@successpro/contracts";

export type ResumeGoldenCase = {
  id: string;
  description: string;
  input: ResumeAnalysisInput;
  expectedScore: { minimum: number; maximum: number };
  expectedFactorCeilings?: Record<string, number>;
};

const contact = "samira.test@example.com | +91 98765 43210 | linkedin.com/in/samiratest";
const education = "Education\nBachelor of Technology, State University, 2014 - 2018";
const skills = "Skills: Product strategy, SQL, analytics, communication, stakeholder management, delivery";
const detailedExperience = `Experience
Senior Product Manager | Northstar Systems | 2022 - Present
Led a cross-functional launch across 3 markets and increased activation by 24%.
Built an analytics workflow that reduced weekly reporting time by 12 hours.
Product Manager | Orbit Labs | 2018 - 2022
Developed customer research practices used by 4 teams and improved completion by 18%.
Managed product delivery with engineering, design, sales, and support stakeholders.`;

function completeResume(summary: string, experience = detailedExperience, extra = "") {
  return `Samira Test\n${contact}\nProfessional Summary\n${summary}\n${experience}\n${education}\n${skills}\nProjects\nCreated a retention model used by 4 teams.\nCertifications\nAnalytics Foundations\n${extra}`;
}

export const resumeGoldenDataset: ResumeGoldenCase[] = [
  {
    id: "junior",
    description: "Early-career applicant with education, internship, projects, and transferable evidence",
    input: {
      text: completeResume(
        "Early-career analyst with internship and project experience using data to explain customer behaviour.",
        `Experience
Data Analyst Intern | Bright Labs | 2025 - 2026
Built a weekly dashboard for 2 teams and reduced manual checks by 20%.
Projects
Created a SQL portfolio that analysed 10,000 public records and documented the findings.`,
      ),
      targetKeywords: ["sql", "analytics", "dashboard"],
      documentSignals: {},
    },
    expectedScore: { minimum: 65, maximum: 100 },
  },
  {
    id: "mid-career",
    description: "Mid-career professional with clear progression and measurable results",
    input: { text: completeResume("Product professional with eight years of experience delivering measurable customer and business outcomes."), targetKeywords: ["strategy", "analytics", "stakeholder"], documentSignals: {} },
    expectedScore: { minimum: 75, maximum: 100 },
  },
  {
    id: "executive",
    description: "Executive resume with leadership scope, strategy, and enterprise outcomes",
    input: {
      text: completeResume(
        "Executive technology leader with 18 years of experience in strategy, leadership, transformation, and responsible growth.",
        `Experience
Chief Product Officer | Meridian Group | 2020 - Present
Led a 120-person organization across 6 markets and delivered ₹400 crore in annual portfolio revenue.
Designed a three-year strategy that increased retention by 16% and reduced operating cost by 11%.
Vice President, Product | Northstar Systems | 2012 - 2020
Built 5 product lines, managed senior stakeholders, and developed 14 leaders.`,
      ),
      targetKeywords: ["strategy", "leadership", "transformation"],
      documentSignals: {},
    },
    expectedScore: { minimum: 75, maximum: 100 },
  },
  {
    id: "career-gap",
    description: "Resume that openly explains a career break without hiding chronology",
    input: {
      text: completeResume(
        "Operations professional returning after a planned caregiving break, with current analytics training and prior delivery experience.",
        `Experience
Career Break | Family caregiving and professional study | 2023 - 2025
Completed 3 current courses and delivered a volunteer reporting project.
Operations Manager | Careline Services | 2017 - 2023
Led 18 colleagues and reduced customer wait time by 22%.`,
      ),
      targetKeywords: ["operations", "analytics"],
      documentSignals: {},
    },
    expectedScore: { minimum: 65, maximum: 100 },
  },
  {
    id: "career-switch",
    description: "Career changer who connects transferable achievements to a new target role",
    input: {
      text: completeResume(
        "Teacher moving into customer success, bringing facilitation, communication, planning, and evidence-led problem solving.",
        `Experience
Teacher and Program Lead | City School | 2018 - 2026
Led adoption of a digital learning service for 600 users and improved completion by 28%.
Resolved parent and student issues, managed stakeholder expectations, and trained 35 colleagues.
Projects
Built a customer onboarding case study using support and product data.`,
      ),
      targetKeywords: ["customer", "stakeholder", "onboarding"],
      documentSignals: {},
    },
    expectedScore: { minimum: 65, maximum: 100 },
  },
  {
    id: "technical",
    description: "Technical resume with delivery, reliability, and scale evidence",
    input: {
      text: completeResume(
        "Software engineer specializing in TypeScript, distributed services, cloud reliability, and measurable delivery improvements.",
        `Experience
Senior Software Engineer | Atlas Cloud | 2021 - Present
Developed TypeScript services handling 8 million requests per day and improved availability to 99.95%.
Optimized database queries and reduced p95 latency by 38%.
Software Engineer | Delta Works | 2018 - 2021
Built automated tests that reduced escaped defects by 31%.`,
        "Skills: TypeScript, Node.js, SQL, Google Cloud, testing, distributed systems, observability",
      ),
      targetKeywords: ["typescript", "sql", "cloud", "testing"],
      documentSignals: {},
    },
    expectedScore: { minimum: 70, maximum: 100 },
  },
  {
    id: "nontechnical",
    description: "Nontechnical operations resume with service and people outcomes",
    input: {
      text: completeResume(
        "Customer operations specialist with experience improving service quality, coaching teams, and resolving complex cases.",
        `Experience
Customer Operations Lead | Harbor Services | 2020 - Present
Managed 22 advisers and improved first-contact resolution by 19%.
Created coaching sessions that reduced repeat complaints by 14%.
Service Adviser | Harbor Services | 2017 - 2020
Resolved high-priority cases and delivered clear updates to stakeholders.`,
      ),
      targetKeywords: ["operations", "customer", "coaching"],
      documentSignals: {},
    },
    expectedScore: { minimum: 65, maximum: 100 },
  },
  {
    id: "academic",
    description: "Academic CV-style content with research, teaching, and publications",
    input: {
      text: completeResume(
        "Researcher and lecturer with expertise in public policy evaluation, quantitative methods, publication, and teaching.",
        `Experience
Assistant Professor | National Institute | 2020 - Present
Designed 6 courses, taught 420 students, and improved module completion by 12%.
Research Fellow | Policy Centre | 2016 - 2020
Led 3 funded studies and presented results to government stakeholders.
Publications
Published 8 peer-reviewed articles on evidence-led public services.`,
      ),
      targetKeywords: ["research", "teaching", "publication"],
      documentSignals: {},
    },
    expectedScore: { minimum: 65, maximum: 100 },
  },
  {
    id: "multilingual",
    description: "Resume containing English and Hindi content while preserving names and facts",
    input: {
      text: completeResume(
        "Bilingual customer research professional working in English and Hindi. ग्राहक अनुसंधान और संचार में अनुभवी।",
        `${detailedExperience}
Languages
English — professional | हिन्दी — मातृभाषा`,
      ),
      targetKeywords: ["research", "communication"],
      documentSignals: {},
    },
    expectedScore: { minimum: 60, maximum: 100 },
  },
  {
    id: "scanned-pdf",
    description: "Image-only scan whose visible content cannot be reliably extracted",
    input: { text: completeResume("A visually complete resume supplied as a scan but without a reliable selectable text layer."), targetKeywords: [], documentSignals: { imageOnly: true, extractionReliable: false } },
    expectedScore: { minimum: 45, maximum: 90 },
    expectedFactorCeilings: { parseability: 1 },
  },
  {
    id: "two-column",
    description: "Two-column resume with otherwise strong content",
    input: { text: completeResume("Product leader with measurable experience presented in a two-column design."), targetKeywords: [], documentSignals: { multiColumn: true } },
    expectedScore: { minimum: 60, maximum: 95 },
    expectedFactorCeilings: { formatting: 7 },
  },
  {
    id: "table-heavy",
    description: "Table-heavy resume with otherwise strong content",
    input: { text: completeResume("Product leader with measurable experience presented through multiple layout tables."), targetKeywords: [], documentSignals: { tableHeavy: true } },
    expectedScore: { minimum: 60, maximum: 95 },
    expectedFactorCeilings: { formatting: 7 },
  },
  {
    id: "poor-formatting",
    description: "Complex layout with columns, tables, and important header/footer content",
    input: { text: completeResume("Product leader whose strong content is placed in a risky document layout."), targetKeywords: [], documentSignals: { multiColumn: true, tableHeavy: true, criticalContentInHeaderFooter: true, extractionReliable: false } },
    expectedScore: { minimum: 40, maximum: 85 },
    expectedFactorCeilings: { parseability: 6, formatting: 2 },
  },
  {
    id: "excellent-formatting",
    description: "Single-column resume with reliable extraction and complete evidence",
    input: { text: completeResume("Product leader with clear positioning, measurable impact, reliable structure, and concise evidence."), targetKeywords: ["strategy", "analytics", "stakeholder"], documentSignals: { extractionReliable: true } },
    expectedScore: { minimum: 75, maximum: 100 },
    expectedFactorCeilings: { parseability: 12, formatting: 10 },
  },
  {
    id: "missing-dates",
    description: "Resume whose roles omit usable chronology",
    input: {
      text: `Samira Test
${contact}
Professional Summary
Product specialist with useful achievements but incomplete employment dates.
Experience
Product Specialist | Northstar Systems
Led a launch for 3 teams and improved activation by 24%.
Analyst | Orbit Labs
Built reporting that reduced preparation time by 12 hours.
Education
Bachelor of Technology, State University
${skills}
Projects
Created a customer research report used by 4 product teams.
Certifications
Analytics Foundations`,
      targetKeywords: [],
      documentSignals: {},
    },
    expectedScore: { minimum: 50, maximum: 95 },
    expectedFactorCeilings: { chronology: 4 },
  },
  {
    id: "inconsistent-chronology",
    description: "Resume with explicitly detected overlapping or inconsistent dates",
    input: { text: completeResume("Product professional with strong achievements but chronology requiring clarification."), targetKeywords: [], documentSignals: { inconsistentChronology: true } },
    expectedScore: { minimum: 50, maximum: 95 },
    expectedFactorCeilings: { chronology: 2 },
  },
];
