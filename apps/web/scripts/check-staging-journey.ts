import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { canonicalProfileSchema } from "@successpro/contracts";
import { baseProfile } from "./generate-document-goldens";
import { profileReviewQuestions } from "../src/lib/profile-review-questions";
import { coverLetterDocumentRequestSchema } from "../src/lib/document-request";

// Uses an isolated, synthetic QA identity, never an existing customer account.
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) process.loadEnvFile(".env.local");
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) throw new Error("The staging Firebase web key is not configured for the QA harness.");
const base = process.env.QA_BASE_URL?.replace(/\/$/, "");
const stagingHosts = new Set(["successpro-web-staging-913575819720.asia-south1.run.app", "successpro-web-staging-tjx6xu7doq-el.a.run.app", "journey-qa---successpro-web-staging-tjx6xu7doq-el.a.run.app", "release-ui-qa---successpro-web-staging-tjx6xu7doq-el.a.run.app", "salary-graceful-qa---successpro-web-staging-tjx6xu7doq-el.a.run.app", "pdf-flow-qa---successpro-web-staging-tjx6xu7doq-el.a.run.app"]);
stagingHosts.add("editorial-qa---successpro-web-staging-tjx6xu7doq-el.a.run.app");
stagingHosts.add("docs-qa---successpro-web-staging-tjx6xu7doq-el.a.run.app");
stagingHosts.add("pagination-qa---successpro-web-staging-tjx6xu7doq-el.a.run.app");
stagingHosts.add("ui-qa---successpro-web-staging-tjx6xu7doq-el.a.run.app");
stagingHosts.add("evidence-qa---successpro-web-staging-tjx6xu7doq-el.a.run.app");
stagingHosts.add("paginate-qa---successpro-web-staging-tjx6xu7doq-el.a.run.app");
stagingHosts.add("sample-qa---successpro-web-staging-tjx6xu7doq-el.a.run.app");
stagingHosts.add("long-career-qa---successpro-web-staging-tjx6xu7doq-el.a.run.app");
stagingHosts.add("consent-gate-qa---successpro-web-staging-tjx6xu7doq-el.a.run.app");
if (!base || new URL(base).protocol !== "https:" || !stagingHosts.has(new URL(base).host) || new URL(base).pathname !== "/") throw new Error("Set an approved staging QA URL explicitly.");
const uid = `qa-journey-${randomUUID()}`;
const email = `${uid}@example.com`;
const password = `${randomUUID()}-Aa9!`;
let cookie = "";
let created = false;
let identityToken = "";
const browser = await chromium.launch();
await mkdir("../../output/ui", { recursive: true });
await writeFile("../../output/ui/staging-journey-result.json", JSON.stringify({ checkedAt: new Date().toISOString(), base, syntheticUid: uid, result: "running" }, null, 2));
const qualityModels = new Set(["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash"]);
function verifyQualityModel(meta: { model?: string; validation?: string } | undefined, step: string) {
  if (meta?.validation !== "passed" || !qualityModels.has(meta.model ?? "")) throw new Error(`${step}: quality AI model was not used successfully`);
  console.log(JSON.stringify({ step, model: meta.model, validation: meta.validation }));
}
async function call(path: string, body?: unknown, method = "POST") {
  const response = await fetch(`${base}${path}`, { method, headers: { Cookie: cookie, Origin: base!, ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }) }, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(115_000) });
  const raw = await response.text();
  let value;
  try { value = JSON.parse(raw); }
  catch { throw new Error(`${path}: expected JSON, received HTTP ${response.status} (${response.headers.get("content-type") ?? "no content type"}, ${raw.length} characters)`); }
  if (!response.ok) throw new Error(`${path}: ${response.status} ${value.error ?? "Request failed"}`);
  return value;
}
function verifyCareerDates(draft: Partial<typeof baseProfile>, stage: string) {
  for (const expected of baseProfile.experience) {
    const role = draft.experience?.find((item) => item.employer.toLowerCase().includes(expected.employer.split(",")[0].toLowerCase()));
    if (!role || !role.startDate.includes(expected.startDate) || !role.endDate.toLowerCase().includes(expected.endDate.toLowerCase())) throw new Error(`${stage}: career dates were not preserved for synthetic role ${expected.id}`);
  }
  for (const expected of baseProfile.education) {
    const record = draft.education?.find((item) => item.institution.toLowerCase().includes(expected.institution.toLowerCase()));
    if (!record || !record.startDate.includes(expected.startDate) || !record.endDate.includes(expected.endDate) || record.qualification !== expected.qualification) throw new Error(`${stage}: education qualification or dates were not preserved for synthetic record ${expected.id}`);
  }
}

function verifyExportContent(file: string, qualifications: string[], projects: Array<{ name: string; description: string }>) {
  execFileSync(process.env.QA_PYTHON_BIN || "python3", ["-c", `
import json, sys, re
from pypdf import PdfReader
pages = [re.sub(r"\\s+", " ", page.extract_text() or "") for page in PdfReader(sys.argv[1]).pages]
text = " ".join(pages)
expected = json.load(sys.stdin)
missing = [label for label in expected["qualifications"] if re.sub(r"\\s+", " ", label) not in text]
if missing:
    raise SystemExit("Export qualification fidelity check failed; do not promote this revision.")
for project in expected["projects"]:
    title = re.sub(r"\\s+", " ", project["name"])
    opening = re.sub(r"\\s+", " ", project["description"])[:40].strip()
    if opening and any(title in page for page in pages) and not any(title in page and opening in page for page in pages):
        raise SystemExit("Project title and opening description split across pages; do not promote this revision.")
`, file], { input: JSON.stringify({ qualifications, projects }), stdio: ["pipe", "pipe", "pipe"] });
}
try {
  // Use the same client-facing Firebase Identity endpoint as signup. This keeps
  // the harness independent from a developer's local ADC quota-project setting.
  const signup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const identity = await signup.json();
  if (!identity.idToken) throw new Error(`Synthetic signup failed: HTTP ${signup.status} ${String(identity.error?.message ?? "Unknown identity error").slice(0, 120)}`);
  created = true;
  identityToken = identity.idToken;
  // Only this newly created synthetic identity is verified through the staging
  // administrator API. The application's normal verification gate stays intact.
  const adminToken = execFileSync(process.env.GCLOUD_BIN || "gcloud", ["auth", "print-access-token"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const verified = await fetch("https://identitytoolkit.googleapis.com/v1/projects/successpro-staging-1706786b/accounts:update", {
    method: "POST", headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json", "x-goog-user-project": "successpro-staging-1706786b" },
    body: JSON.stringify({ localId: identity.localId, emailVerified: true }),
  });
  if (!verified.ok) {
    const failure = await verified.json();
    throw new Error(`Synthetic email verification failed: HTTP ${verified.status}; ${String(failure.error?.message ?? "No detail").slice(0, 350)}`);
  }
  const signedIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const refreshedIdentity = await signedIn.json();
  if (!signedIn.ok || !refreshedIdentity.idToken) throw new Error("Synthetic verified sign-in failed");
  identityToken = refreshedIdentity.idToken;
  const beforeConsent = await fetch(`${base}/api/session`, { method: "POST", headers: { Authorization: `Bearer ${identityToken}`, Origin: base } });
  if (beforeConsent.status !== 409 || (await beforeConsent.json()).code !== "registration_consent_required") throw new Error("An unconsented synthetic account was allowed to sign in");
  const registration = await fetch(`${base}/api/registration-consent`, {
    method: "POST",
    headers: { Authorization: `Bearer ${identityToken}`, Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ adultAndTermsAccepted: true, automatedCareerProcessingAccepted: true, externalAiDataUseAccepted: true, selectedPlan: "free", requestedCurrency: "INR" }),
  });
  if (!registration.ok) throw new Error(`Synthetic registration consent failed: HTTP ${registration.status}`);
  const session = await fetch(`${base}/api/session`, { method: "POST", headers: { Authorization: `Bearer ${identityToken}`, Origin: base } });
  if (!session.ok) throw new Error(`Session failed: ${session.status}`);
  cookie = session.headers.get("set-cookie")!.split(";")[0];
  await call("/api/account/ai-consent");
  const upload = new FormData();
  upload.set("resume", new Blob([await readFile("../../output/pdf/successpro-clarity-resume.pdf")], { type: "application/pdf" }), "synthetic-resume.pdf");
  const start = Date.now();
  const extracted = await call("/api/resumes", upload);
  verifyQualityModel(extracted.profileDraftAssistant, "extraction-model");
  console.log(JSON.stringify({ step: "upload", seconds: Math.round((Date.now() - start) / 1000), textLength: extracted.text?.length, skills: extracted.profileDraft?.skills?.length, roles: extracted.profileDraft?.experience?.length }));
  if (!extracted.text || !extracted.profileDraft?.skills?.length || !extracted.profileDraft?.experience?.length) throw new Error("Extraction incomplete");
  verifyCareerDates(extracted.profileDraft, "extraction");
  const extractionAnswers = profileReviewQuestions(extracted.profileDraft, extracted.profileDraftWarnings ?? []).map((question) => question.id);
  const transformed = await call("/api/resumes/transform", { draft: extracted.profileDraft, reviewAnswers: extractionAnswers, jobDescription: "Lead product strategy, customer research and cross-functional teams. Use verified outcomes to demonstrate fit.", mode: "initial" });
  verifyQualityModel(transformed.assistant, "transformation-model");
  if (!transformed.profileDraft?.summary || transformed.assistant?.validation !== "passed") throw new Error("Transformation unavailable");
  verifyCareerDates(transformed.profileDraft, "transformation");
  if (JSON.stringify(transformed.profileDraft).includes("\u2014")) throw new Error("Transformation contains an em dash");
  await writeFile("../../output/ui/staging-transformed-profile.json", JSON.stringify(transformed.profileDraft, null, 2));
  console.log(JSON.stringify({ step: "transform", validation: transformed.assistant.validation, skills: transformed.profileDraft.skills?.length }));
  const profile = canonicalProfileSchema.parse({ ...transformed.profileDraft, fullName: "Synthetic Journey Check", publicProfileEnabled: false });
  const transformedAnswers = profileReviewQuestions(profile, transformed.warnings ?? []).map((question) => question.id);
  await call("/api/profile", { ...profile, reviewAnswers: transformedAnswers }, "PUT");
  const savedProfile = await call("/api/profile", undefined, "GET");
  if (savedProfile.profile?.summary !== profile.summary || JSON.stringify(savedProfile.profile?.skills) !== JSON.stringify(profile.skills)) throw new Error("Confirmed profile changes were not preserved");
  const cover = await call("/api/ai/generateCoverLetter", { profile, targetRole: "Product Director", company: "Example Company", jobDescription: "Lead product strategy, customer research, analytics and cross-functional teams to improve customer outcomes.", tone: "executive" });
  verifyQualityModel(cover.meta, "cover-letter-model");
  if (cover.meta?.validation !== "passed") throw new Error("Expert cover-letter writing unavailable");
  const documentDraft = { templateId: "clarity", pageSize: "a4", contact: { email, phone: "", location: profile.location, linkedIn: "", website: "" }, role: "Product Director", company: "Example Company", focus: "", jobDescription: "", tone: "executive", recipientName: "Hiring Manager", recipientTitle: "", companyAddress: "", letterText: cover.output.paragraphs.join("\n\n") };
  const firstVersion = await call("/api/document-drafts", documentDraft, "PUT");
  await call("/api/document-drafts", { ...documentDraft, company: "Updated Example Company" }, "PUT");
  const history = await call("/api/document-drafts/versions", undefined, "GET");
  const priorVersion = history.versions?.find((version: { id: string }) => version.id === firstVersion.versionId);
  if (!priorVersion || priorVersion.draft.company !== "Example Company") throw new Error("Original document version was not retained");
  await call("/api/document-drafts", priorVersion.draft, "PUT");
  const reopened = await call("/api/document-drafts", undefined, "GET");
  if (reopened.draft?.letterText !== documentDraft.letterText || reopened.draft?.company !== "Example Company") throw new Error("Document restore or persistence failed");
  const linkedIn = await call("/api/ai/generateLinkedInMakeover", { profile, currentProfileText: "", targetRole: "Product Director" });
  verifyQualityModel(linkedIn.meta, "linkedin-model");
  if (linkedIn.meta?.validation !== "passed" || linkedIn.output?.headlines?.length < 2 || !linkedIn.output?.about) throw new Error("Expert LinkedIn preparation unavailable");
  await writeFile("../../output/ui/staging-linkedin.json", JSON.stringify(linkedIn.output, null, 2));
  const goal = { targetRole: "Product Director", targetDate: "2027-06", motivation: "Lead a broader verified product portfolio.", targetSalary: 6000000, currency: "INR", targetCompany: "", targetIndustry: "Technology", targetGeography: "Bengaluru", targetSkill: "Portfolio strategy", tasks: [] };
  verifyQualityModel((await call("/api/ai/careerGapPlan", { profile, goal })).meta, "career-plan-model");
  verifyQualityModel((await call("/api/ai/recommendUpskilling", { profile, targetRole: "Product Director", gaps: ["Portfolio strategy"], availableCourses: [{ id: "qa-course-1", title: "Product Portfolio Strategy", provider: "Example University", skills: ["Portfolio strategy"], free: true, url: "https://example.com/course", lastVerifiedOn: "2026-09-25" }] })).meta, "learning-model");
  const salarySource = { id: "qa-salary-1", name: "Synthetic verified market dataset", url: "https://example.com/salary", publishedOn: "2026-09-25", dateBasis: "published", low: 4500000, midpoint: 5500000, high: 6500000 };
  verifyQualityModel((await call("/api/ai/salaryNarrative", { research: { role: "Product Director", location: "Bengaluru, India", yearsExperience: 11, industry: "Technology", companySize: "large", skills: ["Product strategy"], education: "MBA", currentCompensation: 4000000, targetCompensation: 6000000, currency: "INR", sources: [salarySource] }, calculatedRange: { low: 4500000, midpoint: 5500000, high: 6500000 }, confidence: "medium" })).meta, "salary-model");
  verifyQualityModel((await call("/api/ai/researchJobs", { roleTitles: ["Product Director"], locations: ["Bengaluru"], skills: ["Product strategy"], workModes: ["hybrid"], approvedJobs: [{ id: "qa-job-1", title: "Product Director", employer: "Example Company", location: "Bengaluru", description: "Lead product strategy and customer research.", canonicalUrl: "https://example.com/job", sourceName: "Synthetic QA source", postedOn: "2026-09-24", lastSeenOn: "2026-09-25", salaryText: "" }] })).meta, "job-matching-model");
  const coverLetterRequest = { templateId: "clarity", pageSize: "a4", contact: { email, location: profile.location }, letter: { date: "25 September 2026", company: "Example Company", targetRole: "Product Director", greeting: cover.output.greeting, paragraphs: cover.output.paragraphs, closing: cover.output.closing } };
  const coverLetterValidation = coverLetterDocumentRequestSchema.safeParse(coverLetterRequest);
  if (!coverLetterValidation.success) throw new Error(`Generated cover letter fails export schema: ${JSON.stringify(coverLetterValidation.error.issues.map((issue) => ({ path: issue.path, code: issue.code, message: issue.message })))}`);
  for (const format of ["pdf", "docx"]) {
    const response = await fetch(`${base}/api/documents/cover-letter${format === "docx" ? "?format=docx" : ""}`, { method: "POST", headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" }, body: JSON.stringify(coverLetterRequest) });
    if (!response.ok) throw new Error(`Cover-letter download ${format}: ${response.status} ${await response.text()}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1000) throw new Error(`Empty cover-letter download: ${format}`);
    await writeFile(`../../output/ui/staging-cover-letter.${format}`, bytes);
  }
  console.log(JSON.stringify({ step: "cover-letter-and-linkedin", validation: "passed", coverLetterExports: ["pdf", "docx"] }));
  const review = await call("/api/reviews", { text: extracted.text, targetKeywords: [], documentSignals: extracted.signals ?? {} });
  verifyQualityModel(review.assistant?.meta, "review-model");
  console.log(JSON.stringify({ step: "review", validation: review.assistant?.meta?.validation, actions: review.assistant?.output?.topActions?.length }));
  if (review.assistant?.meta?.validation !== "passed") throw new Error("Review assistance unavailable");
  const report = await fetch(`${base}/api/reviews/${review.analysisId}/report`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(60_000) });
  if (!report.ok) throw new Error(`Review PDF download: ${report.status}`);
  await writeFile("../../output/ui/staging-review.pdf", Buffer.from(await report.arrayBuffer()));
  for (const format of ["pdf", "docx"]) {
    const response = await fetch(`${base}/api/documents/resume${format === "docx" ? "?format=docx" : ""}`, { method: "POST", headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ templateId: "clarity", pageSize: "a4", contact: { email, location: profile.location } }) });
    if (!response.ok) throw new Error(`Resume download ${format}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1000) throw new Error(`Empty resume download: ${format}`);
    await writeFile(`../../output/ui/staging-resume.${format}`, bytes);
    if (format === "pdf") verifyExportContent("../../output/ui/staging-resume.pdf", profile.education.map((item) => item.qualification), profile.projects);
    console.log(JSON.stringify({ step: "download", format, bytes: bytes.length }));
  }
  const context = await browser.newContext();
  await context.addCookies([{ name: "successpro_session", value: cookie.slice(cookie.indexOf("=") + 1), url: base, httpOnly: true, secure: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["dashboard", "profile?from=resume&next=/documents", "documents", "linkedin", "goals", "learning", "salary", "opportunities", "mentor", "recruiter"]) {
      let salaryAllAccessed = false;
      const automaticPath = ({ goals: "/api/ai/careerGapPlan", learning: "/api/ai/recommendUpskilling", salary: "/api/salary/market", opportunities: "/api/jobs" } as Record<string, string>)[route];
      const automatic = automaticPath ? page.waitForResponse((response) => new URL(response.url()).pathname === automaticPath, { timeout: 100_000 }) : null;
      const response = await page.goto(`${base}/${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      if (!response?.ok() || page.url().includes("/login")) throw new Error(`Page failed: ${route}; status=${response?.status() ?? "none"}; destination=${page.url()}`);
      if (route === "documents") await page.locator(".letter-editor textarea").waitFor({ state: "visible", timeout: 60_000 });
      if (automatic) {
        const generated = await automatic;
        const result = await generated.json();
        if (["goals", "learning"].includes(route)) verifyQualityModel(result.meta, `automatic-${route}-${width}`);
        if (route === "salary") {
          if (!generated.ok()) throw new Error(`Automatic regional salary benchmark unavailable: HTTP ${generated.status()}`);
          salaryAllAccessed = Array.isArray(result.sources) && result.sources.length > 0 && result.sources.every((source: { dateBasis?: string }) => source.dateBasis === "accessed");
          console.log(JSON.stringify({ step: "salary-research", width, verifiedSources: result.sources?.length ?? 0, searchSuggestionLength: result.searchSuggestionHtml?.length ?? 0 }));
        }
        if (route === "opportunities" && !generated.ok()) throw new Error(`Profile-first opportunities failed: HTTP ${generated.status()}`);
        console.log(JSON.stringify({ step: "automatic-recommendation", route, width, status: generated.status() }));
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow) {
        await page.screenshot({ path: `../../output/ui/staging-${route.split("?")[0]}-overflow-${width}.png`, fullPage: true });
        const offenders = await page.evaluate(() => [...document.querySelectorAll("*")]
          .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 12)
          .map((element) => ({ tag: element.tagName, className: String(element.className).slice(0, 100), right: Math.round(element.getBoundingClientRect().right) })));
        throw new Error(`Horizontal overflow: ${route} at ${width}; offenders=${JSON.stringify(offenders)}`);
      }
      if (["mentor", "recruiter"].includes(route) && await page.getByRole("navigation", { name: "Application navigation" }).count()) throw new Error("Partner workspace contains candidate navigation");
      if (route.startsWith("profile?")) {
        const skills = await page.getByLabel("Skills Comma-separated").inputValue();
        if (!skills.trim()) throw new Error("Extracted skills are missing from the visible form");
        if (!(await page.getByRole("button", { name: "Save and open resume builder" }).count())) throw new Error("Resume builder action is missing");
      }
      if (route === "documents") {
        const letter = page.locator(".letter-editor textarea");
        if (!(await letter.count())) {
          await page.screenshot({ path: `../../output/ui/staging-documents-missing-editor-${width}.png`, fullPage: true });
          throw new Error(`Documents editor absent: destination=${page.url()}; text=${(await page.locator("body").innerText()).slice(0, 700)}; pageErrors=${pageErrors.join(" | ")}`);
        }
        if (await letter.inputValue() !== documentDraft.letterText) throw new Error("Saved letter was not restored in the visible editor");
        const edited = `${documentDraft.letterText}\n\nSynthetic edit for save verification.`;
        const autosave = page.waitForResponse((response) => response.url().endsWith("/api/document-drafts") && response.request().method() === "PUT" && response.ok());
        await letter.fill(edited);
        await autosave;
        await page.reload({ waitUntil: "networkidle" });
        if (await letter.inputValue() !== edited) throw new Error("Customer text edit did not survive reload");
        const restoreSave = page.waitForResponse((response) => response.url().endsWith("/api/document-drafts") && response.request().method() === "PUT" && response.ok());
        await letter.fill(documentDraft.letterText);
        await restoreSave;
      }
      if (route === "salary") {
        if (salaryAllAccessed && (await page.locator(".confidence").innerText().catch(() => "")).toLowerCase().includes("high")) throw new Error("Access dates were incorrectly treated as high-confidence publications");
        const suggestion = page.locator("iframe.salary-search-suggestions");
        if (await suggestion.count()) console.log(JSON.stringify({ step: "salary-search-suggestion-display", width, visibleText: (await suggestion.contentFrame().locator("body").innerText().catch(() => "")).slice(0, 180) }));
      }
      await page.screenshot({ path: `../../output/ui/staging-${route.split("?")[0]}-${width}.png`, fullPage: true });
      console.log(JSON.stringify({ step: "page", route, width, status: response.status() }));
    }
  }
  if (pageErrors.length) throw new Error(`Browser runtime errors: ${pageErrors.join("; ")}`);
  await writeFile("../../output/ui/staging-journey-result.json", JSON.stringify({ checkedAt: new Date().toISOString(), base, syntheticUid: uid, result: "passed" }, null, 2));
} catch (error) {
  await writeFile("../../output/ui/staging-journey-result.json", JSON.stringify({ checkedAt: new Date().toISOString(), base, syntheticUid: uid, result: "failed", error: error instanceof Error ? error.message.slice(0, 500) : "Journey failed" }, null, 2));
  throw error;
} finally {
  try { await browser.close(); }
  finally {
    // Delete test data through the product's own privacy flow. If that flow is
    // unavailable, at least remove the Firebase Identity account immediately.
    if (created && identityToken) {
      const accountDelete = await fetch(`${base}/api/account`, { method: "DELETE", headers: { Cookie: cookie, Origin: base, Authorization: `Bearer ${identityToken}` } });
      if (!accountDelete.ok) {
        const identityDelete = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: identityToken }) });
        if (!identityDelete.ok) throw new Error(`Synthetic account cleanup needs attention: ${uid}`);
      }
    }
  }
}
