import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalProfileSchema, type CanonicalProfile } from "@successpro/contracts";
import { documentTemplates, type DocumentTemplateId, type PageSize } from "@successpro/domain";
import { renderCoverLetterPdf, renderResumePdf } from "../src/lib/document-renderer";
import { baseProfile, coverLetterFixture, documentContact, makePortrait } from "./generate-document-goldens";

const workspaceRoot = path.resolve(process.cwd(), "../..");
const outputRoot = path.join(workspaceRoot, "tmp/pdfs/release-matrix");

type Scenario = {
  id: string;
  pageSize: PageSize;
  photo: boolean;
  profile: CanonicalProfile;
  expectedResumePages?: { minimum: number; maximum: number };
};

function profile(overrides: Partial<CanonicalProfile>) {
  return canonicalProfileSchema.parse({ ...baseProfile, ...overrides });
}

const shortProfile = profile({
  fullName: "Maya Sen",
  headline: "Customer Success Manager",
  summary: "Customer success manager with six years of experience improving onboarding, adoption, and account health for growing software businesses.",
  skills: ["Customer onboarding", "Account planning", "Renewals", "Product adoption", "Stakeholder communication"],
  experience: [{ id: "short-role", title: "Customer Success Manager", employer: "Example Software", startDate: "2021", endDate: "Present", achievements: ["Improved first-year customer retention by 14% through clearer onboarding plans.", "Built a health-review rhythm used across 80 strategic accounts."] }],
  education: [{ id: "short-edu", qualification: "B.A., Economics", institution: "University of Delhi", startDate: "2014", endDate: "2017" }],
  projects: [], certifications: [], awards: [], publications: [], volunteerExperience: [], languages: [], links: [],
});

const longNameProfile = profile({
  fullName: "Alexandria Catherine Montgomery-Wellington",
  headline: "Senior Director of International Customer Experience and Digital Service Transformation",
  summary: `${baseProfile.summary} Experienced in presenting complex decisions to international leadership groups while preserving clarity, accountability, and customer trust.`,
  links: [{ id: "long-link", label: "Professional portfolio", url: "https://example.com/alexandria-montgomery-wellington-portfolio" }],
});

const multilingualProfile = profile({
  fullName: "आशा मेहता",
  headline: "उत्पाद नेतृत्व | Product Leadership",
  location: "नई दिल्ली, India",
  summary: "ग्राहक-केंद्रित डिजिटल सेवाओं के निर्माण में अनुभवी उत्पाद नेता। Product leader experienced in building clear, accessible services for multilingual communities.",
  skills: ["उत्पाद रणनीति", "Customer research", "टीम नेतृत्व", "Service design", "Analytics"],
  languages: ["हिन्दी - मातृभाषा", "English - fluent", "मराठी - conversational"],
});

const longExperiences = Array.from({ length: 8 }, (_, index) => ({
  id: `long-role-${index + 1}`,
  title: ["Director of Product", "Head of Product", "Senior Product Manager", "Product Manager"][Math.min(index, 3)],
  employer: `${["Northstar", "Harbour", "CivicWorks", "Atlas", "Meridian", "Summit", "Beacon", "Horizon"][index]} Technologies`,
  startDate: String(2026 - ((index + 1) * 2)),
  endDate: index === 0 ? "Present" : String(2026 - (index * 2)),
  achievements: [
    `Led cross-functional programme ${index + 1} across product, design, engineering, operations, and commercial teams with clear quarterly outcomes.`,
    `Improved a core customer measure by ${12 + index}% while reducing avoidable service demand through simpler journeys and clearer ownership.`,
    `Established an evidence review used by ${4 + index} teams to prioritise investments and communicate decisions to senior stakeholders.`,
    `Coached colleagues through delivery challenges and created reusable working practices that improved consistency across the portfolio.`,
  ],
}));

const longProfile = profile({
  summary: `${baseProfile.summary} Brings deep experience across regulated services, platform products, international growth, operating-model design, and large-scale organisational change.`,
  experience: longExperiences,
  projects: Array.from({ length: 8 }, (_, index) => ({ id: `long-project-${index + 1}`, name: `Strategic transformation programme ${index + 1}`, description: `Led discovery, prioritisation, delivery governance, and outcome measurement for a multi-team initiative serving customer segment ${index + 1}.`, link: `https://example.com/programme-${index + 1}` })),
  certifications: [...baseProfile.certifications, { id: "long-cert-3", name: "Leading Organisational Change", issuer: "Example Institute", date: "2024", credentialUrl: "" }],
  awards: [...baseProfile.awards, { id: "long-award-2", title: "Leadership Excellence Award", issuer: "Example Group", date: "2023", description: "Recognised for building a supportive, accountable product culture." }],
  publications: [...baseProfile.publications, { id: "long-publication-2", title: "A practical guide to customer trust", publisher: "Service Design Review", date: "2023", link: "https://example.com/customer-trust-guide" }],
});

const scenarios: Scenario[] = [
  { id: "short-a4-photo-off", pageSize: "a4", photo: false, profile: shortProfile, expectedResumePages: { minimum: 1, maximum: 1 } },
  { id: "short-letter-photo-on", pageSize: "letter", photo: true, profile: shortProfile, expectedResumePages: { minimum: 1, maximum: 1 } },
  { id: "medium-a4-photo-off", pageSize: "a4", photo: false, profile: baseProfile, expectedResumePages: { minimum: 1, maximum: 2 } },
  { id: "long-letter-photo-on", pageSize: "letter", photo: true, profile: longProfile, expectedResumePages: { minimum: 2, maximum: 7 } },
  { id: "long-name-a4-photo-off", pageSize: "a4", photo: false, profile: longNameProfile, expectedResumePages: { minimum: 1, maximum: 2 } },
  { id: "multilingual-letter-photo-on", pageSize: "letter", photo: true, profile: multilingualProfile, expectedResumePages: { minimum: 1, maximum: 2 } },
];

const manifest: Array<Record<string, unknown>> = [];
await mkdir(outputRoot, { recursive: true });

for (const template of documentTemplates) {
  for (const scenario of scenarios) {
    const photoEnabled = scenario.photo && template.photo === "optional";
    const photoDataUri = photoEnabled ? makePortrait() : undefined;
    const stem = `${template.id}--${scenario.id}`;
    const contact = scenario.profile === baseProfile
      ? documentContact
      : { email: "candidate@example.com", phone: "", location: scenario.profile.location, linkedIn: "", website: "" };
    const shared = { profile: scenario.profile, contact, templateId: template.id as DocumentTemplateId, pageSize: scenario.pageSize, photoDataUri };
    const resumeFile = `${stem}--resume.pdf`;
    const coverFile = `${stem}--cover-letter.pdf`;
    await writeFile(path.join(outputRoot, resumeFile), await renderResumePdf(shared));
    await writeFile(path.join(outputRoot, coverFile), await renderCoverLetterPdf({
      ...shared,
      letter: {
        ...coverLetterFixture,
        targetRole: scenario.profile.targetRoles[0] ?? coverLetterFixture.targetRole,
        paragraphs: multilingualProfile === scenario.profile ? [
          `मैं ${coverLetterFixture.targetRole} पद के लिए आवेदन कर रही हूँ। I am applying for this role because it combines meaningful customer outcomes with responsible product leadership. My experience includes building accessible digital services for communities that communicate in more than one language, while keeping delivery goals clear for every colleague involved.`,
          coverLetterFixture.paragraphs[1],
          coverLetterFixture.paragraphs[2],
          coverLetterFixture.paragraphs[3],
        ] : coverLetterFixture.paragraphs,
      },
    }));
    for (const [kind, file] of [["resume", resumeFile], ["cover-letter", coverFile]] as const) {
      manifest.push({
        file,
        kind,
        templateId: template.id,
        scenarioId: scenario.id,
        pageSize: scenario.pageSize,
        photoExpected: photoEnabled,
        fullName: scenario.profile.fullName,
        namePt: template.typography.namePt,
        sectionHeadingPt: template.typography.sectionHeadingPt,
        expectedTexts: kind === "resume" ? [
          ...scenario.profile.experience.map((role) => role.employer),
          ...scenario.profile.projects.map((project) => project.name),
          ...scenario.profile.education.map((education) => education.institution),
        ] : [],
        expectedPages: kind === "resume" ? scenario.expectedResumePages : { minimum: 1, maximum: 1 },
      });
    }
  }
}

await writeFile(path.join(outputRoot, "matrix-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`Generated ${manifest.length} PDFs in ${outputRoot}\n`);
