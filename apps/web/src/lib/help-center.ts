export const helpArticles = [
  { id: "resume-upload", title: "My resume will not upload", category: "Resume Checker", body: "Use a PDF, Word .doc or .docx, or TXT file up to 10 MB. Password-protected, damaged, macro-enabled, or unusually long documents may be rejected. Scanned PDFs need clear pages." },
  { id: "resume-score", title: "How the Resume Checker score works", category: "Resume Checker", body: "The checker reviews content, structure, length, readability, layout, and presentation. It applies the same published criteria to every resume and shows what to improve. Job matching is separate from the main score." },
  { id: "profile-import", title: "Correct details found in my resume", category: "Profile", body: "Resume details are a draft. Open My profile, correct anything inaccurate or missing, and save only after you have checked every field. Importing never turns on public sharing." },
  { id: "public-profile", title: "Control or revoke my public profile", category: "Privacy", body: "Public sharing is off by default. In My profile you can choose each visible section, keep search-engine listing off, disable the profile, or create a new link that immediately revokes the previous one." },
  { id: "data-rights", title: "Download or delete my data", category: "Privacy", body: "Open Privacy & account to download your portable JSON export, withdraw automated career processing, or permanently delete the account. Sensitive actions require you to confirm your identity again." },
  { id: "jobs", title: "Why no jobs are appearing", category: "Opportunities", body: "Save target roles and up to five locations first. SuccessPro only shows roles from approved sources; it does not invent listings or scrape restricted sites. A source may temporarily have no suitable role." },
  { id: "salary", title: "Understand salary confidence", category: "Salary", body: "Salary ranges depend on current, dated evidence for the selected role and geography. Sparse evidence produces a low-confidence result or no range instead of a guessed number." },
  { id: "payments", title: "Writing-service payment or project issue", category: "Payments", body: "Do not retry an uncertain payment repeatedly. Send a support request with the approximate time, currency, service selected, and provider reference if one was shown. Never send card details or passwords." },
  { id: "security", title: "Report a security or privacy concern", category: "Safety", body: "Use the support form and choose Security concern or Privacy/data-rights grievance. Do not include passwords, authentication codes, government IDs, card numbers, or unnecessary resume content." },
  { id: "messages", title: "Block or report a member", category: "Messages", body: "Open the conversation to pause messages or submit a report. Reports include only the reason and details you choose to provide; the first moderation view does not automatically expose private messages." },
] as const;

export const supportCategories = ["product-help", "privacy-grievance", "security-concern", "payment-dispute", "data-correction", "abuse", "mentor-conflict", "other"] as const;
export type SupportCategory = typeof supportCategories[number];

export const mandatoryHumanEscalation = new Set<SupportCategory>(["privacy-grievance", "security-concern", "payment-dispute", "data-correction", "abuse", "mentor-conflict"]);

export function supportPriority(category: SupportCategory) {
  return category === "security-concern" ? "urgent" : mandatoryHumanEscalation.has(category) ? "high" : "normal";
}
