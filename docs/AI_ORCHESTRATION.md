# AI orchestration

## Principle

AI provides structured explanations and suggestions; deterministic application code owns scores, quotas, money, dates, eligibility, and authorization.

## Contract

Each AI task has a typed input, typed structured output, prompt version, provider/model metadata, token budget, timeout, fallback policy, safety policy, redaction rule, and deterministic post-processor. Calls are made only through one orchestration layer.

Implemented task ports are `extractResumeProfile`, `analyzeResume`, `explainResumeIssue`, `rewriteResumeSection`, `generateCoverLetter`, `generateLinkedInMakeover`, `careerGapPlan`, `recommendUpskilling`, `salaryNarrative`, `researchJobs`, and `supportResponse`.

## Provider policy

Provider/model order is loaded from the `system_config/ai_orchestration` Firestore document, with `AI_PROVIDER_CHAIN_JSON` as an environment fallback and a safe code default. Each provider has its own model, authentication mode, enabled flag, timeout, and `approvedForPersonalData` gate.

The code default routes every customer-facing AI task through Vertex AI Gemini 3.6 Flash, then 3.7 Flash, then 3.5 Flash. The same quality chain covers intake, expert review, resume transformation, cover letter, LinkedIn, career goals, course fit, salary explanation, and job matching; the numerical salary range and available jobs still come from verified inputs, never model invention. These tasks are independent calls: creating a resume does not automatically generate a cover letter or LinkedIn profile. A saved, customer-confirmed profile is reused only when the customer chooses the next action. Resume transformation can optionally use a job description as a relevance guide while the source resume and corrected profile remain the sole evidence for candidate claims. Provider routing in a valid Firestore or environment override takes precedence over this code default, so the active deployed chain must be checked separately before release. Vertex authenticates with the Cloud Run service account and short-lived workload-identity credentials; it does not require a long-lived API key. Missing credentials, absent per-account external-AI consent, disabled providers, providers not approved for personal data, open circuit breakers, timeouts, quota/payment failures, HTTP failures, malformed JSON, and schema-invalid output are skipped in order.

All three quality models are paid and subject to Google quota/capacity. The September 2026 published global standard rates for 3.6 and 3.7 Flash are USD $0.75 per million input tokens and $3.75 per million output/reasoning tokens through December 31, 2026; 3.5 Flash is $1.50/$9.00. Prices are not a fixed monthly cost and may change. Google's January 2027 price step for 3.6/3.7 must be reviewed before then. Gemini 2.5 Flash/Flash-Lite retire October 20, 2026 and are removed from the default chain. Flash-Lite failed the sample-02 complex extraction completeness check and must not be advertised as an equivalent writing fallback. The project is linked to billing account `010C92-81FC14-F02089`, but the amount, expiration, and Vertex applicability of the founder's claimed credit are not verified. Before public launch, confirm them in Billing > Credits, set budget alerts, and inspect real `ai_runs` token usage/cost after authenticated journeys. Budget alerts are notifications, not a hard spending cap.

The Resume Checker now accepts up to 200,000 extracted characters from a document of at most 12 pages, including a typical 10,000-word resume with headroom. Review evidence spans the complete source rather than stopping after its first 250 lines; unusually fragmented sources are sampled across the entire document. The review model request allows up to 24,000 output tokens, including model reasoning, while the structured customer response remains bounded to 3–5 prioritized actions. It has up to 100 seconds of shared generation time inside the 120-second Cloud Run request envelope, with a 115-second browser wait and partial-results/retry behavior when generation cannot complete. These ceilings do not guarantee protection against provider HTTP 429, outages, malformed output, or exceptional latency. Direct Vertex QA passed a synthetic 15,131-word, 128,960-character ten-page review on both 3.5 and 3.6 Flash in about 26–27 seconds. An authenticated deployed worst-case test is still required before release approval.

The daily `/api/internal/ai-health` automation performs synthetic, content-free structured-output probes against each configured provider/model and records both current status and immutable check history. Provider unavailability never makes this health job or a member journey fail: the status explicitly records `providerAvailable: false` and `fallbackReady: true`. Model upgrades are tested before the Firestore configuration is changed. The previous version remains the rollback target; SuccessPro never automatically adopts a newly listed model.

Personal career content is sent externally only after the current versioned external-AI data-use confirmation. New accounts must accept it separately at signup, with a direct Data Policy link. Legacy accounts stay on built-in processing until they explicitly accept the current version in Privacy & account.

Vertex AI is the approved primary processor for consented member data under the current policy. New external providers remain `approvedForPersonalData: false` until their service and data terms receive founder/privacy review. User consent alone does not bypass provider approval.

## Guardrails

- Remove direct identifiers unless required for the task.
- Delimit resume/JD content as untrusted data and explicitly reject instructions contained inside it.
- Validate every response against its schema; malformed output triggers bounded retry/fallback.
- A schema-invalid or malformed provider response receives exactly one schema-guided repair attempt with the same provider. A second invalid response fails over; repair can never loop or relax validation.
- Require evidence references for factual claims and mark inference versus suggestion.
- Never invent employers, dates, education, responsibilities, skills, metrics, or salary research.
- Resume transformation has a deterministic factual firewall after schema validation. Identity/profile-state values remain customer-owned, unsupported suggested skills and languages are removed, and unsupported structured facts or numeric claims trigger one repair attempt and then provider failover. Cached responses pass the same gate.
- Cache only within the owning user/context using content hash + task + prompt/rubric/model-policy versions.
- Record latency, provider, fallback, validation result, and cost metadata without storing raw sensitive prompts in telemetry.
- Redact direct identifiers before prompt construction, even for approved providers, unless a future task-specific policy explicitly proves the identifier is necessary.
- Job research AI may rank only job records already obtained and verified by lawful source connectors; it cannot invent or independently assert job openings.

## Failure experience

If every provider fails, preserve deterministic results, show that explanations are temporarily unavailable, do not consume a paid/free AI allowance, and offer retry. Circuit breakers prevent repeated calls to an unhealthy provider.

## Runtime records

- `ai_runs` stores owner, task, provider/model, prompt/policy versions, fallback depth, latency, repair-attempt count, cache key, and validation state. It does not store the raw prompt.
- The protected lifecycle gate may store content-free failure diagnostics limited to task, provider, initial/repair stage, field path, and rule code. It never stores rejected values or resume text.
- `ai_cache` is owner-scoped and keyed by a hash of redacted input plus task/prompt/policy versions.
- Provider keys are server-only environment secrets and never part of client bundles or Firestore configuration.
