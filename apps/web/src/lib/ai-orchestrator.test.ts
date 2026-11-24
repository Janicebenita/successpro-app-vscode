import { describe, expect, it } from "vitest";
import { analyzeResume, CONTENT_PARAMETER_IDS, JOB_MATCH_PARAMETER_IDS } from "@successpro/domain";
import { isReusableAiCache, runAiTask, resetAiCircuitBreakersForTests } from "@/lib/ai/orchestrator";
import type { AiProvider } from "@/lib/ai/providers";

const resumeText = `Samira Test\nsamira@example.com | +91 98765 43210\nProfessional summary\nProduct manager with eight years of experience improving customer services.\nExperience\nSenior Product Manager | Northstar | 2022 - Present\nLed a customer programme that improved retention by 18 percent.\nEducation\nMBA | Example School | 2020\nSkills: strategy, analytics, customer research, leadership, experimentation.`;
const review = analyzeResume({ text: resumeText, targetKeywords: ["strategy"], documentSignals: {} });
const workbookAssessments = [
  ...CONTENT_PARAMETER_IDS.map((id) => ({ id, status: "Pending", rating: null, naOrPendingReason: "This test isolates the top action." })),
  ...JOB_MATCH_PARAMETER_IDS.map((id) => ({ id, status: "N/A", rating: null, naOrPendingReason: "No job description provided" })),
];
const config = { policyVersion: "test-v1", cacheTtlHours: 0, providers: [] };

describe("AI orchestration", () => {
  it("uses the next provider when the quality model is capacity-limited", async () => {
    resetAiCircuitBreakersForTests();
    const primary: AiProvider = { id: "capacity-primary", model: "quality", async generate() { throw new Error("PROVIDER_HTTP_429"); } };
    const backup: AiProvider = { id: "capacity-backup", model: "economy", async generate() { return { text: JSON.stringify({ observed: "The date is unclear", inference: "Tenure needs confirmation", suggestion: "Confirm the printed dates", whyItMatters: "The chronology should be credible", example: "Use only the verified date" }) }; } };
    const result = await runAiTask("explainResumeIssue", { factor: "Timeline", evidence: ["Date not shown"], issue: "Unclear tenure" }, { ownerId: "capacity-test-user", config, providers: [primary, backup], disablePersistence: true, generationBudgetMs: 5_000 });
    expect(result.meta).toMatchObject({ provider: "capacity-backup", validation: "passed", fallbackDepth: 1 });
  });
  it("preserves fallback time instead of repairing malformed primary output with the last budget", async () => {
    resetAiCircuitBreakersForTests();
    let primaryCalls = 0;
    const primary: AiProvider = { id: "repair-budget-primary", model: "test", async generate() { primaryCalls += 1; return { text: "{}" }; } };
    const fallback: AiProvider = { id: "repair-budget-fallback", model: "test", async generate() { return { text: JSON.stringify({ observed: "A date is missing", inference: "Timeline unclear", suggestion: "Confirm the date", whyItMatters: "Clarifies tenure", example: "Use the verified date" }) }; } };
    const result = await runAiTask("explainResumeIssue", { factor: "Timeline", evidence: ["Missing date"], issue: "Missing date" }, { ownerId: "test-user", config, providers: [primary, fallback], disablePersistence: true, generationBudgetMs: 5_000 });
    expect(primaryCalls).toBe(1);
    expect(result.meta).toMatchObject({ provider: "repair-budget-fallback", validation: "passed", fallbackDepth: 1 });
  });
  it("keeps UUID role references and career dates intact while redacting contact details", async () => {
    let prompt = "";
    const id = "12345678-1234-4567-8901-123456789012";
    const provider: AiProvider = { id: "reference-test", model: "test", async generate(args) {
      prompt = args.prompt;
      return { text: JSON.stringify({ profileDraft: { skills: ["Strategy"] }, improvements: [], warnings: [] }) };
    } };
    await runAiTask("extractResumeProfile", { resumeText, deterministicDraft: { experience: [{ id, employer: "Example", title: "Manager", startDate: "2022-01-01", endDate: "2024-12-31", achievements: [] }] } }, { ownerId: "test-user", config, providers: [provider], disablePersistence: true });
    expect(prompt).toContain(id);
    expect(prompt).toContain("2022-01-01");
    expect(prompt).toContain("2024-12-31");
    expect(prompt).not.toContain("+91 98765 43210");
    expect(prompt).not.toContain("samira@example.com");
  });
  it("passes detected resume language to the extraction provider without changing the source text", async () => {
    let prompt = "";
    const hindiSource = "अनुभव\nवरिष्ठ उत्पाद प्रबंधक\nकौशल: रणनीति, विश्लेषण";
    const provider: AiProvider = { id: "language-context", model: "test", async generate(args) {
      prompt = args.prompt;
      return { text: JSON.stringify({ profileDraft: { skills: ["रणनीति", "विश्लेषण"] }, improvements: [], warnings: [] }) };
    } };
    await runAiTask("extractResumeProfile", { resumeText: `${resumeText}\n${hindiSource}`, deterministicDraft: {}, sourceLanguage: "hi" }, { ownerId: "test-user", config, providers: [provider], disablePersistence: true });
    const data = JSON.parse(prompt.split("<DATA>")[1].split("</DATA>")[0]);
    expect(data.sourceLanguage).toBe("hi");
    expect(data.resumeText).toContain(hindiSource);
    expect(prompt).toContain("Do not translate or anglicize those facts");
  });
  it("bounds an overlong display excerpt without losing the extracted career draft", async () => {
    const observed = "Source passage with verified career information. ".repeat(50);
    const provider: AiProvider = { id: "long-display-excerpt", model: "test", async generate() { return { text: JSON.stringify({ profileDraft: { skills: ["Strategy"] }, improvements: [{ field: "summary", observed, inference: "", suggestion: "Keep this evidence concise." }], warnings: [] }) }; } };
    const result = await runAiTask("extractResumeProfile", { resumeText, deterministicDraft: {} }, { ownerId: "test-user", config, providers: [provider], disablePersistence: true });
    expect(result.meta.validation).toBe("passed");
    expect(result.meta.repairAttempts).toBe(0);
    expect(result.output.improvements[0].observed.length).toBeLessThanOrEqual(1500);
    expect(result.output.profileDraft.skills).toEqual(["Strategy"]);
  });
  it("keeps excerpt references stable when contact redaction changes source lengths", async () => {
    const longContact = `${"person".repeat(110)}@example.com`;
    const source = `${longContact}\nProduct manager with eight years of experience improving customer services.`;
    const provider: AiProvider = { id: "stable-evidence", model: "test", async generate({ prompt }) {
      const data = JSON.parse(prompt.split("<DATA>")[1].split("</DATA>")[0]);
      const excerpt = data.sourceExcerpts.find((item: { text: string }) => item.text.startsWith("Product manager"));
      expect(prompt).not.toContain(longContact);
      return { text: JSON.stringify({ workbookAssessments, summary: "Review", topActions: [{ observed: "Summary present", inference: "", suggestion: "Keep the experience clear", sourceExcerptId: excerpt.id, originalExcerpt: "", improvedExample: "" }], limitations: [] }) };
    } };
    const result = await runAiTask("analyzeResume", { resumeText: source, deterministicReview: review }, { ownerId: "test-user", config, providers: [provider], disablePersistence: true });
    expect(result.meta.validation).toBe("passed");
    expect(result.output.topActions[0].originalExcerpt).toBe(source.split("\n")[1]);
  });
  it("restores quoted redacted contact text only from the exact uploaded source span", async () => {
    const provider: AiProvider = { id: "quoted-redaction", model: "test", async generate() { return { text: JSON.stringify({ workbookAssessments, summary: "Review of the contact line.", topActions: [{ observed: "Contact information is present.", inference: "The reader can contact you.", suggestion: "Keep the contact line concise.", originalExcerpt: "[redacted email] | [redacted phone]", improvedExample: "" }], limitations: [] }) }; } };
    const result = await runAiTask("analyzeResume", { resumeText, deterministicReview: review }, { ownerId: "test-user", config, providers: [provider], disablePersistence: true });
    expect(result.meta.validation).toBe("passed");
    expect(result.output.topActions[0].originalExcerpt).toBe("samira@example.com | +91 98765 43210");
  });
  it("preserves year ranges while redacting phone numbers and normalizes printed web links", async () => {
    let prompt = "";
    const provider: AiProvider = { id: "printed-links", model: "test", async generate(args) {
      prompt = args.prompt;
      return { text: JSON.stringify({ profileDraft: { projects: [{ id: "p", name: "Portfolio", description: "Work samples", link: "example.com/work" }], links: [{ id: "l", label: "Profile", url: "www.linkedin.com/in/example" }] }, improvements: [], warnings: [] }) };
    } };
    const result = await runAiTask("extractResumeProfile", { resumeText: `${resumeText}\nEarlier role 2018 - 2022\nEducation 2013-2014`, deterministicDraft: {} }, { ownerId: "test-user", config, providers: [provider], disablePersistence: true });
    expect(prompt).toContain("2018 - 2022");
    expect(prompt).toContain("2013-2014");
    expect(prompt).not.toContain("+91 98765 43210");
    expect(result.meta.validation).toBe("passed");
    expect(result.output.profileDraft.projects?.[0].link).toBe("https://example.com/work");
    expect(result.output.profileDraft.links?.[0].url).toBe("https://www.linkedin.com/in/example");
  });
  it("aborts a stalled provider and stops the fallback chain at the shared deadline", async () => {
    let signal: AbortSignal | undefined;
    let backupCalls = 0;
    const stalled: AiProvider = { id: "stalled-budget", model: "test", generate(args) { signal = args.signal; return new Promise(() => {}); } };
    const backup: AiProvider = { id: "unused-backup", model: "test", async generate() { backupCalls += 1; return { text: "{}" }; } };
    const result = await runAiTask("extractResumeProfile", { resumeText, deterministicDraft: {} }, { ownerId: "test-user", config, providers: [stalled, backup], disablePersistence: true, generationBudgetMs: 20 });
    expect(signal?.aborted).toBe(true);
    expect(backupCalls).toBe(0);
    expect(result.meta.validation).toBe("fallback");
  });
  it("gives a workbook fallback time after a stalled primary assessment", async () => {
    let primaryAborted = false;
    const stalled: AiProvider = { id: "stalled-workbook", model: "test", generate({ signal }) {
      signal?.addEventListener("abort", () => { primaryAborted = true; });
      return new Promise(() => {});
    } };
    const backup: AiProvider = { id: "backup-workbook", model: "test", async generate() {
      return { text: JSON.stringify({
        workbookAssessments, summary: "Review", limitations: [],
        topActions: [{ observed: "Experience is documented.", inference: "", suggestion: "Clarify the scope." }],
      }) };
    } };
    const result = await runAiTask("analyzeResume", { resumeText, deterministicReview: review }, {
      ownerId: "test-user", config, providers: [stalled, backup], disablePersistence: true, generationBudgetMs: 200,
    });
    expect(primaryAborted).toBe(true);
    expect(result.meta).toMatchObject({ provider: "backup-workbook", fallbackDepth: 1, validation: "passed" });
  });

  it("gives the backup time to repair a workbook response after a primary failure", async () => {
    const timeouts: number[] = [];
    const primary: AiProvider = { id: "primary-workbook-503", model: "test", async generate() {
      throw new Error("PROVIDER_HTTP_503");
    } };
    const backup: AiProvider = { id: "backup-workbook-repair", model: "test", async generate({ timeoutMs }) {
      timeouts.push(timeoutMs);
      if (timeouts.length === 1) return { text: "{}" };
      return { text: JSON.stringify({
        workbookAssessments, summary: "Review", limitations: [],
        topActions: [{ observed: "Experience is documented.", inference: "", suggestion: "Clarify the scope." }],
      }) };
    } };
    const result = await runAiTask("analyzeResume", { resumeText, deterministicReview: review }, {
      ownerId: "test-user", config, providers: [primary, backup], disablePersistence: true,
    });
    expect(result.meta).toMatchObject({ provider: backup.id, fallbackDepth: 1, validation: "passed", repairAttempts: 1 });
    expect(timeouts).toHaveLength(2);
    expect(timeouts.every(timeout => timeout > 60_000 && timeout <= 105_000)).toBe(true);
  });

  it.each([
    ["Lead the team's cross-functional launch", true],
    ["Lead the team's international launch", false],
  ])("restores exact JD typography without accepting rewritten requirements (%s)", async (quote, matches) => {
    const sourceText = "Lead the team’s cross–functional\nlaunch";
    const evidence = { excerpt: "Led a customer programme that improved retention by 18 percent.", rationale: "The resume documents ownership of a customer programme." };
    const assessment = {
      workbookAssessments: workbookAssessments.map((row) => row.id === "J01" ? { id: row.id, status: "Assessed", rating: 3, evidence } : row),
      jdRequirements: [{ id: "req-1", owner: "J01", sourceText: quote, status: "Assessed", rating: 3, evidence, mandatory: true }],
      meaningfulJd: true,
      summary: "The resume documents ownership of a customer programme.",
      topActions: [{ observed: "The programme is documented.", inference: "", suggestion: "Clarify the scope." }],
      limitations: [],
    };
    const provider: AiProvider = { id: "jd-quote-test", model: "test", async generate() { return { text: JSON.stringify(assessment) }; } };
    const result = await runAiTask("analyzeResume", { resumeText, deterministicReview: review, jobDescription: sourceText }, {
      ownerId: "test-user", config, providers: [provider], disablePersistence: true,
    });
    expect(result.meta.validation).toBe(matches ? "passed" : "fallback");
    if (matches) {
      expect(result.meta.repairAttempts).toBe(0);
      expect(result.output.jdRequirements?.[0].sourceText).toBe(sourceText);
    }
  });

  it("strips JD markers and rejects a claim that an in-progress degree is held", async () => {
    const candidate = resumeText + "\nBachelor of Technology – Information Technology\n2023 – 2027 (expected completion: July 2027)";
    const jobDescription = "- **Bachelor's degree in a related field.**";
    const evidence = { excerpt: "Bachelor of Technology – Information Technology", rationale: "Holds a Bachelor of Technology degree." };
    let calls = 0;
    const provider: AiProvider = { id: "jd-degree", model: "test", async generate() {
      const cited = { ...evidence, rationale: calls++ ? "The candidate is pursuing the degree and has listed an expected completion date." : evidence.rationale };
      return { text: JSON.stringify({
        summary: "The resume shows an ongoing degree and relevant project work.", limitations: [], meaningfulJd: true,
        topActions: [{ observed: "The degree is dated.", inference: "", suggestion: "Keep the completion status clear." }],
        workbookAssessments: workbookAssessments.map(row => row.id === "J04" ? { id: row.id, status: "Assessed", rating: 2, evidence: cited } : row),
        jdRequirements: [{ id: "r1", owner: "J04", sourceText: jobDescription, status: "Assessed", rating: 2, evidence: cited, mandatory: true }],
      }) };
    } };
    const result = await runAiTask("analyzeResume", { resumeText: candidate, jobDescription, deterministicReview: review }, {
      ownerId: "test-user", config, providers: [provider], disablePersistence: true,
    });
    expect(result.meta).toMatchObject({ validation: "passed", repairAttempts: 1 });
    expect(result.output.jdRequirements?.[0].sourceText).toBe("Bachelor's degree in a related field.");
    expect(result.output.jdRequirements?.[0].evidence.rationale).toContain("pursuing");
  });

  it("does not call providers when the generation budget is already exhausted", async () => {
    let calls = 0;
    const provider: AiProvider = { id: "zero-budget", model: "test", async generate() { calls += 1; return { text: "{}" }; } };
    await runAiTask("extractResumeProfile", { resumeText, deterministicDraft: {} }, { ownerId: "test-user", config, providers: [provider], disablePersistence: true, generationBudgetMs: 0 });
    expect(calls).toBe(0);
  });
  it("accepts incomplete extracted identity fields and returns a safe draft when providers are unavailable", async () => {
    const result = await runAiTask("extractResumeProfile", { resumeText, deterministicDraft: { fullName: "", headline: "", skills: ["Strategy"] } }, { ownerId: "test-user", config, providers: [], disablePersistence: true });
    expect(result.output.profileDraft.skills?.map((skill) => skill.toLowerCase())).toContain("strategy");
    expect(result.meta.validation).toBe("fallback");
  });
  it("preserves an unpolished source when transformation is unavailable without throwing", async () => {
    const result = await runAiTask("transformResumeProfile", { resumeText, deterministicDraft: { summary: "CONTACT SKILLS source extraction", skills: ["Strategy"], experience: [{ id: "r", title: "Director", employer: "Example", startDate: "", endDate: "", achievements: Array.from({ length: 12 }, () => "Source editor says can be rephrased.") }] } }, { ownerId: "test-user", config, providers: [], disablePersistence: true });
    expect(result.meta.validation).toBe("fallback");
    expect(result.output.profileDraft.experience?.[0].achievements).toHaveLength(12);
  });
  it("never reuses a rules fallback as if provider availability were unchanged", () => {
    expect(isReusableAiCache({ task: "analyzeResume", provider: "successpro-rules", model: "deterministic-fallback-v1", promptVersion: "test", policyVersion: "test", fallbackDepth: 2, latencyMs: 0, cached: false, validation: "fallback", repairAttempts: 0 })).toBe(false);
    expect(isReusableAiCache({ task: "analyzeResume", provider: "vertex", model: "gemini", promptVersion: "test", policyVersion: "test", fallbackDepth: 0, latencyMs: 10, cached: false, validation: "passed", repairAttempts: 0 })).toBe(true);
  });
  it("constructs a Vertex provider without an API key", async () => {
    const { providerFromConfig } = await import("@/lib/ai/providers");
    expect(providerFromConfig({ id: "vertex", kind: "vertex-gemini", model: "gemini-2.5-flash-lite", enabled: true, approvedForPersonalData: true })).toMatchObject({ id: "vertex", model: "gemini-2.5-flash-lite" });
  });
  it("redacts direct identifiers before an approved provider receives data", async () => {
    let prompt = "";
    const provider: AiProvider = { id: "mock", model: "mock-v1", async generate(args) { prompt = args.prompt; return { text: JSON.stringify({ workbookAssessments, summary: "Grounded explanation.", topActions: [{ observed: "The summary is present.", inference: "It may be more specific.", suggestion: "Add one verified outcome.", originalExcerpt: "Product manager with eight years of experience improving customer services.", improvedExample: "Product manager with eight years of experience improving customer services." }], limitations: [] }) }; } };
    const result = await runAiTask("analyzeResume", { resumeText, deterministicReview: review, targetRole: "Product Director" }, { ownerId: "test-user", config, providers: [provider], disablePersistence: true });
    expect(result.meta.provider).toBe("mock");
    expect(prompt).not.toContain("samira@example.com");
    expect(prompt).not.toContain("+91 98765 43210");
    expect(prompt).toContain("[redacted email]");
  });

  it("rejects resume-review excerpts and numbers that are not supported by the uploaded resume", async () => {
    const invalid: AiProvider = { id: "invalid", model: "invalid", async generate() { return { text: JSON.stringify({ summary: "Review.", topActions: [{ observed: "Claim found.", inference: "It matters.", suggestion: "Use supported evidence.", originalExcerpt: "Invented source sentence", improvedExample: "Improved revenue by 77%." }], limitations: [] }) }; } };
    const result = await runAiTask("analyzeResume", { resumeText, deterministicReview: review, targetRole: "Product Director" }, { ownerId: "test-user", config, providers: [invalid], disablePersistence: true });
    expect(result.meta.validation).toBe("fallback");
    expect(result.output.topActions.every((action) => !action.improvedExample)).toBe(true);
  });

  it("falls through malformed and failed providers", async () => {
    resetAiCircuitBreakersForTests();
    const malformed: AiProvider = { id: "bad-json", model: "bad", async generate() { return { text: "not json" }; } };
    const failed: AiProvider = { id: "failed", model: "failed", async generate() { throw new Error("rate limited"); } };
    const valid: AiProvider = { id: "valid", model: "valid", async generate() { return { text: JSON.stringify({ observed: "A date is missing.", inference: "The timeline may be unclear.", suggestion: "Add the verified date.", whyItMatters: "Readers need a clear timeline.", example: "" }) }; } };
    const result = await runAiTask("explainResumeIssue", { factor: "Career timeline", evidence: ["End date not found"], issue: "Missing date", targetRole: "Product Director" }, { ownerId: "test-user", config, providers: [malformed, failed, valid], disablePersistence: true });
    expect(result.meta).toMatchObject({ provider: "valid", fallbackDepth: 2, validation: "passed" });
  });

  it("repairs one schema-invalid response with the same provider", async () => {
    resetAiCircuitBreakersForTests();
    let calls = 0;
    let repairPromptSeen = "";
    const repairable: AiProvider = { id: "repairable", model: "repairable-v1", async generate(args) {
      calls += 1;
      if (calls === 1) return { text: JSON.stringify({ observed: "A date is missing." }) };
      repairPromptSeen = args.prompt;
      return { text: JSON.stringify({ observed: "A date is missing.", inference: "The timeline may be unclear.", suggestion: "Add the verified date.", whyItMatters: "Readers need a clear timeline.", example: "" }) };
    } };
    const result = await runAiTask("explainResumeIssue", { factor: "Career timeline", evidence: ["End date not found"], issue: "Missing date", targetRole: "Product Director" }, { ownerId: "test-user", config, providers: [repairable], disablePersistence: true });
    expect(calls).toBe(2);
    expect(repairPromptSeen).toContain("REPAIR ATTEMPT (one attempt only)");
    expect(repairPromptSeen).toContain("VALIDATION_ISSUES");
    expect(repairPromptSeen).toContain("CHARACTER limit (not word count)");
    expect(repairPromptSeen).toContain("Preserve unaffected records");
    expect(result.meta).toMatchObject({ provider: "repairable", validation: "passed", repairAttempts: 1 });
  });

  it("keeps the rules-based review usable when every AI provider fails", async () => {
    resetAiCircuitBreakersForTests();
    const failed: AiProvider = { id: "failed-all", model: "failed", async generate() { throw new Error("unavailable"); } };
    const result = await runAiTask("analyzeResume", { resumeText, deterministicReview: review, targetRole: "Product Director" }, { ownerId: "test-user", config, providers: [failed], disablePersistence: true });
    expect(result.meta).toMatchObject({ provider: "successpro-rules", validation: "fallback" });
    expect(result.output.summary).toContain(`${review.score}/100`);
    expect(result.output.topActions.length).toBeGreaterThan(0);
  });

  it("repairs an invented resume transformation and accepts only source-grounded facts", async () => {
    resetAiCircuitBreakersForTests();
    let calls = 0;
    const base = {
      profileDraft: {
        headline: "Product Management Leader",
        summary: "Product manager with eight years of experience and a verified 18 percent retention improvement.",
        currentRole: "Senior Product Manager",
        skills: ["Strategy", "Analytics"],
        experience: [{ id: "role-1", title: "Senior Product Manager", employer: "Northstar", startDate: "2022", endDate: "Present", achievements: ["Improved customer retention by 18 percent through a focused product programme."] }],
        education: [{ id: "education-1", qualification: "MBA", institution: "Example School", startDate: "", endDate: "2020" }],
      },
      improvements: [{ field: "summary", observed: "improved retention by 18 percent", inference: "The verified result deserves prominence.", suggestion: "Lead with this evidence." }],
      warnings: [],
    };
    const provider: AiProvider = { id: "grounding-repair", model: "mock", async generate() {
      calls += 1;
      if (calls === 1) return { text: JSON.stringify({ ...base, profileDraft: { ...base.profileDraft, experience: [{ ...base.profileDraft.experience[0], employer: "Imaginary Labs", achievements: ["Raised revenue by 42%."] }] } }) };
      return { text: JSON.stringify(base) };
    } };
    const result = await runAiTask("transformResumeProfile", {
      resumeText,
      deterministicDraft: { fullName: "Samira Test", headline: "Senior Product Manager", location: "", summary: "Product manager with eight years of experience improving customer services.", currentRole: "Senior Product Manager", industry: "", skills: ["Strategy", "Analytics", "Customer Research", "Leadership", "Experimentation"], experience: [{ id: "role-1", title: "Senior Product Manager", employer: "Northstar", startDate: "2022", endDate: "Present", achievements: ["Led a customer programme that improved retention by 18 percent."] }], education: [{ id: "education-1", qualification: "MBA", institution: "Example School", startDate: "", endDate: "2020" }], targetRoles: [], openToWork: false, publicProfileEnabled: false, publicProfileVisibility: { summary: true, location: true, currentRole: true, industry: true, skills: true, experience: true, education: true }, searchEngineIndexable: false },
      targetRoles: ["Product Director"],
    }, { ownerId: "test-user", config, providers: [provider], disablePersistence: true });
    expect(calls).toBe(2);
    expect(result.meta).toMatchObject({ provider: "grounding-repair", validation: "passed", repairAttempts: 1 });
    expect(result.output.profileDraft.experience?.[0]?.employer).toBe("Northstar");
  });

  it("fails a resume transformation safely when every provider keeps inventing claims", async () => {
    resetAiCircuitBreakersForTests();
    const invented = {
      profileDraft: { headline: "Product Leader", summary: "Product leader who raised revenue by 42%.", skills: ["Strategy"], experience: [{ id: "role-1", title: "Senior Product Manager", employer: "Imaginary Labs", startDate: "2022", endDate: "Present", achievements: ["Raised revenue by 42%."] }] },
      improvements: [{ field: "summary", observed: "Product manager", inference: "Leadership can be clearer.", suggestion: "Use stronger positioning." }], warnings: [],
    };
    let calls = 0;
    const provider: AiProvider = { id: "inventing", model: "mock", async generate() { calls += 1; return { text: JSON.stringify(invented) }; } };
    const result = await runAiTask("transformResumeProfile", {
      resumeText,
      deterministicDraft: { fullName: "Samira Test", headline: "Senior Product Manager", location: "", summary: "Product manager with eight years of experience improving customer services.", currentRole: "Senior Product Manager", industry: "", skills: ["Strategy", "Analytics"], experience: [{ id: "role-1", title: "Senior Product Manager", employer: "Northstar", startDate: "2022", endDate: "Present", achievements: ["Led a customer programme that improved retention by 18 percent."] }], education: [{ id: "education-1", qualification: "MBA", institution: "Example School", startDate: "", endDate: "2020" }], targetRoles: [], openToWork: false, publicProfileEnabled: false, publicProfileVisibility: { summary: true, location: true, currentRole: true, industry: true, skills: true, experience: true, education: true }, searchEngineIndexable: false },
      targetRoles: [],
    }, { ownerId: "test-user", config, providers: [provider], disablePersistence: true });
    expect(calls).toBe(2);
    expect(result.meta).toMatchObject({ provider: "successpro-rules", validation: "fallback" });
    expect(result.output.profileDraft.experience?.[0]?.employer).toBe("Northstar");
  });
});
