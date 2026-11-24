import { NextResponse } from "next/server";
import { analyzeResume } from "@successpro/domain";
import type { AiTaskName } from "@successpro/contracts/ai";
import { verifyInternalAutomation } from "@/lib/internal-automation";
import { runAiTask } from "@/lib/ai/orchestrator";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const resumeText = `SAMIRA TEST\nProduct leader with eight years of experience improving customer services and digital products.\nEXPERIENCE\nNorthstar | 2022 - Present | Senior Product Manager\nLed a customer retention programme that improved retention by 18 percent.\nBuilt an analytics workflow used by four teams.\nEDUCATION\nMBA | Example School | 2020\nSKILLS\nProduct strategy, analytics, customer research, leadership, experimentation.`;
const profile = { fullName: "Samira Test", headline: "Senior Product Manager", location: "Mumbai, India", summary: "Product leader with eight years of experience improving customer services and digital products.", currentRole: "Senior Product Manager", industry: "Technology", skills: ["Product strategy", "Analytics", "Customer research", "Leadership"], experience: [{ id: "role-1", title: "Senior Product Manager", employer: "Northstar", startDate: "2022", endDate: "Present", achievements: ["Led a customer retention programme that improved retention by 18 percent."] }], education: [{ id: "edu-1", qualification: "MBA", institution: "Example School", startDate: "2019", endDate: "2020" }], projects: [], certifications: [], awards: [], publications: [], volunteerExperience: [], languages: ["English"], preferredLanguage: "en", links: [], targetRoles: ["Product Director"], openToWork: false, publicProfileEnabled: false, publicProfileVisibility: { summary: true, location: true, currentRole: true, industry: true, skills: true, experience: true, education: true }, searchEngineIndexable: false };
const review = analyzeResume({ text: resumeText, targetKeywords: ["product", "strategy"], documentSignals: {} });
const goal = { targetRole: "Product Director", targetDate: "2027-06", motivation: "Lead a larger product organization.", targetSalary: 6000000, currency: "INR", targetCompany: "", targetIndustry: "Technology", targetGeography: "Mumbai", targetSkill: "Portfolio strategy", tasks: [] };
const inputs: Record<AiTaskName, unknown> = {
  extractResumeProfile: { resumeText, deterministicDraft: profile, transform: true },
  transformResumeProfile: { resumeText, deterministicDraft: profile, targetRoles: ["Product Director"] },
  analyzeResume: { resumeText, deterministicReview: review, targetRole: "Product Director" },
  explainResumeIssue: { factor: "Measurable impact", evidence: ["improved retention by 18 percent"], issue: "Only one achievement is quantified.", targetRole: "Product Director" },
  rewriteResumeSection: { sectionName: "Professional summary", originalText: profile.summary, targetRole: "Product Director", verifiedFacts: ["Eight years of experience", "Improved retention by 18 percent"] },
  generateCoverLetter: { profile, targetRole: "Product Director", company: "Example Company", jobDescription: "Lead product strategy, customer research, analytics, stakeholder alignment, and a cross-functional product team to improve measurable customer outcomes.", tone: "direct" },
  generateLinkedInMakeover: { profile, currentProfileText: "Senior Product Manager at Northstar", targetRole: "Product Director" },
  careerGapPlan: { profile, goal },
  recommendUpskilling: { profile, targetRole: "Product Director", gaps: ["Portfolio strategy"], availableCourses: [{ id: "course-1", title: "Product Portfolio Strategy", provider: "Example University", skills: ["Portfolio strategy"], free: true, url: "https://example.com/course", lastVerifiedOn: "2026-09-24" }] },
  salaryNarrative: { research: { role: "Product Director", location: "Mumbai, India", yearsExperience: 8, industry: "Technology", companySize: "large", skills: ["Product strategy"], education: "MBA", currentCompensation: 4000000, targetCompensation: 6000000, currency: "INR", sources: [{ id: "source-1", name: "Example market dataset", url: "https://example.com/salary", publishedOn: "2026-09-24", dateBasis: "published", low: 4500000, midpoint: 5500000, high: 6500000 }] }, calculatedRange: { low: 4500000, midpoint: 5500000, high: 6500000 }, confidence: "medium" },
  researchJobs: { roleTitles: ["Product Director"], locations: ["Mumbai"], skills: ["Product strategy"], workModes: ["hybrid"], approvedJobs: [{ id: "job-1", title: "Product Director", employer: "Example Company", location: "Mumbai", description: "Lead product strategy and analytics.", canonicalUrl: "https://example.com/job", sourceName: "Example careers", postedOn: "2026-09-20", lastSeenOn: "2026-09-24", salaryText: "" }] },
  supportResponse: { question: "How do I update my resume?", helpArticles: [{ title: "Resume help", content: "Open My resume, upload a supported file, review the extracted text, and run the checker.", url: "https://example.com/help" }], accountContext: [] },
};

type ValidationFailure = { task: string; provider: string; stage: "initial" | "repair"; issues: Array<{ path: string; code: string }> };

export async function POST(request: Request) {
  if (!(await verifyInternalAutomation(request))) return NextResponse.json({ error: "Unauthorized automation request." }, { status: 401 });
  const results: Array<{ task: string; provider: string; model: string; validation: string; latencyMs: number; repairAttempts: number; failures: ValidationFailure[] }> = [];
  for (const task of Object.keys(inputs) as AiTaskName[]) {
    const failures: ValidationFailure[] = [];
    const result = await runAiTask(task, inputs[task], { ownerId: "system-ai-validation", sensitivity: "public", disablePersistence: true, onValidationFailure: (failure) => failures.push(failure) });
    results.push({ task, provider: result.meta.provider, model: result.meta.model, validation: result.meta.validation, latencyMs: result.meta.latencyMs, repairAttempts: result.meta.repairAttempts ?? 0, failures: failures.slice(0, 12) });
  }
  const providerPassed = results.filter((result) => result.validation === "passed").length;
  await adminDb.collection("system_status").doc("ai_lifecycle_validation").set({ ok: providerPassed === results.length, providerPassed, total: results.length, results, policyVersion: "vertex-primary-v3", checkedAt: FieldValue.serverTimestamp(), schemaVersion: 1 });
  return NextResponse.json({ ok: providerPassed === results.length, providerPassed, total: results.length, results }, { status: providerPassed === results.length ? 200 : 503 });
}
