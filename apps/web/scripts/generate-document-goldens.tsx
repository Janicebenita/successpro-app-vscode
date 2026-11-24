import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { canonicalProfileSchema } from "@successpro/contracts";
import { documentTemplates } from "@successpro/domain";
import { renderCoverLetterPdf, renderResumePdf } from "../src/lib/document-renderer";

const workspaceRoot = path.resolve(process.cwd(), "../..");
const outputRoot = path.join(workspaceRoot, "output/pdf");

export const baseProfile = canonicalProfileSchema.parse({
  fullName: "Aarav Mehta",
  headline: "Product and Growth Leader | Building trusted digital services",
  location: "Bengaluru, India",
  summary: "Product leader with 11 years of experience turning complex customer problems into clear, commercially successful digital products. Known for building strong cross-functional teams, improving customer retention, and creating practical operating systems that help teams deliver with confidence.",
  currentRole: "Director of Product",
  industry: "Technology",
  skills: ["Product strategy", "Growth", "Customer research", "Portfolio planning", "Experimentation", "Team leadership", "Analytics", "Go-to-market", "Platform products", "Executive communication"],
  experience: [
    {
      id: "role-1",
      title: "Director of Product",
      employer: "Northstar Technologies, Bengaluru",
      startDate: "2022",
      endDate: "Present",
      achievements: [
        "Led a portfolio of six customer-facing products serving 2.4 million users across India and Southeast Asia.",
        "Improved annual customer retention by 18% through a redesigned onboarding journey and a coordinated service recovery programme.",
        "Introduced quarterly portfolio reviews that reduced duplicated delivery work by 27% and focused investment on the highest-value opportunities.",
        "Built and coached a product team of 14, with four team members promoted into expanded roles within two years.",
      ],
    },
    {
      id: "role-2",
      title: "Senior Product Manager",
      employer: "Harbour Commerce, Mumbai",
      startDate: "2018",
      endDate: "2022",
      achievements: [
        "Launched a self-service merchant platform that reached 62% adoption in its first year and reduced support demand by 31%.",
        "Partnered with sales, operations, design, and engineering to grow annual recurring revenue from the product line by INR 38 crore.",
        "Established a research practice combining interviews, support evidence, and behavioural data to guide roadmap decisions.",
      ],
    },
    {
      id: "role-3",
      title: "Product Manager",
      employer: "CivicWorks Digital, Pune",
      startDate: "2015",
      endDate: "2018",
      achievements: [
        "Delivered mobile-first public service journeys used by more than 400,000 residents each year.",
        "Reduced average application completion time from 19 minutes to 11 minutes while improving accessibility compliance.",
      ],
    },
  ],
  education: [
    { id: "edu-1", qualification: "MBA, Strategy and Marketing", institution: "Indian School of Business", startDate: "2013", endDate: "2014" },
    { id: "edu-2", qualification: "B.E., Computer Science", institution: "Savitribai Phule Pune University", startDate: "2007", endDate: "2011" },
  ],
  projects: [
    { id: "project-1", name: "Customer trust programme", description: "Created a cross-product measurement framework for reliability, transparent communication, and complaint recovery; customer trust rose by 12 points in two quarters.", link: "https://example.com/customer-trust" },
    { id: "project-2", name: "Product leadership playbook", description: "Designed a practical operating guide for discovery, prioritisation, decision records, and launch readiness used by eight product teams.", link: "https://example.com/product-playbook" },
  ],
  certifications: [
    { id: "cert-1", name: "Product Strategy", issuer: "Reforge", date: "2023", credentialUrl: "https://example.com/credential" },
    { id: "cert-2", name: "Professional Scrum Product Owner", issuer: "Scrum.org", date: "2020", credentialUrl: "" },
  ],
  awards: [
    { id: "award-1", title: "Customer Impact Award", issuer: "Northstar Technologies", date: "2025", description: "Recognised for measurable improvements in customer retention and service recovery." },
  ],
  publications: [
    { id: "publication-1", title: "Making portfolio choices visible", publisher: "Product Practice Review", date: "2024", link: "https://example.com/portfolio-choices" },
  ],
  volunteerExperience: [
    { id: "volunteer-1", role: "Product career mentor", organization: "Women in Product India", startDate: "2021", endDate: "Present", description: "Mentor early-career product managers through structured monthly coaching." },
  ],
  languages: ["English - fluent", "Hindi - fluent", "Marathi - conversational"],
  links: [
    { id: "link-1", label: "Portfolio", url: "https://example.com/aarav" },
    { id: "link-2", label: "LinkedIn", url: "https://www.linkedin.com/in/aarav-mehta" },
  ],
  targetRoles: ["VP Product", "Head of Product"],
  openToWork: true,
  publicProfileEnabled: false,
});

export function makePortrait() {
  const canvas = createCanvas(240, 240);
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 240, 240);
  gradient.addColorStop(0, "#E7EEF7");
  gradient.addColorStop(1, "#CAD7E8");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 240, 240);
  context.fillStyle = "#526B89";
  context.beginPath();
  context.arc(120, 86, 45, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.ellipse(120, 210, 88, 79, 0, Math.PI, Math.PI * 2);
  context.fill();
  return canvas.toDataURL("image/png");
}

export const documentContact = {
  email: "aarav.mehta@example.com",
  phone: "+91 98765 43210",
  location: baseProfile.location,
  linkedIn: "https://www.linkedin.com/in/aarav-mehta",
  website: "https://example.com/aarav",
};

export const coverLetterFixture = {
  date: "23 September 2026",
  recipientName: "Hiring Committee",
  recipientTitle: "Executive Recruitment",
  company: "Meridian Digital Services",
  companyAddress: "Bengaluru, India",
  targetRole: "Vice President, Product",
  greeting: "Dear Hiring Committee,",
  paragraphs: [
    "I am writing to apply for the Vice President, Product position at Meridian Digital Services. Your focus on making essential services simpler and more trusted strongly matches the work I have led throughout my career. Over the past 11 years, I have built digital products, teams, and operating practices that connect customer needs with clear commercial outcomes.",
    "In my current role as Director of Product at Northstar Technologies, I lead six customer-facing products serving 2.4 million users. By redesigning onboarding and coordinating a service recovery programme across product, operations, and support, my teams improved annual customer retention by 18%. I also introduced quarterly portfolio reviews that reduced duplicated delivery work by 27% and gave senior leaders a clearer basis for investment decisions.",
    "I would bring Meridian a practical approach to product leadership: understand the customer evidence, make choices visible, give teams meaningful ownership, and measure whether the work creates lasting value. This approach helped me grow an earlier product line by INR 38 crore in annual recurring revenue and build a product organisation in which four colleagues progressed into larger roles within two years.",
    "I would welcome the opportunity to discuss how my experience in portfolio strategy, customer trust, and team development could support Meridian's next stage of growth. Thank you for considering my application.",
  ],
  closing: "Yours sincerely,",
};

export async function generateGoldenDocuments() {
  await mkdir(outputRoot, { recursive: true });
  for (const template of documentTemplates) {
    const photoDataUri = template.photo === "optional" && template.id !== "editorial" ? makePortrait() : undefined;
    const base = { profile: baseProfile, contact: documentContact, templateId: template.id, pageSize: "a4" as const, photoDataUri };
    const resumePath = path.join(outputRoot, `successpro-${template.id}-resume.pdf`);
    const coverLetterPath = path.join(outputRoot, `successpro-${template.id}-cover-letter.pdf`);
    await writeFile(resumePath, await renderResumePdf(base));
    await writeFile(coverLetterPath, await renderCoverLetterPdf({ ...base, letter: coverLetterFixture }));
    process.stdout.write(`${resumePath}\n${coverLetterPath}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await generateGoldenDocuments();
}
