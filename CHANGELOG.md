# Changelog

## Unreleased — Career journey and partner workspace repairs

- Separated mentor/recruiter sign-in and workspaces from candidate navigation, retaining publication approval gates.
- Contained sidebar overflow and regrouped footer links; prioritized identity, education-inclusive career chronology, recognition and sharing in the portrait.
- Preserved extracted fields against empty assisted output, corrected the latest-resume handoff, and normalized spaced PDF metrics during transformation validation.
- Added grounded source/rewrite comparisons and flowing branded report cards; clarified editor-to-builder navigation.
- Added synthetic authenticated staging QA with explicit field, download, layout and runtime-error checks. This harness is prepared, not yet executed against the unreleased revision.
- Release evidence and limitations are recorded in `docs/QA_CAREER_JOURNEY_2026-09-25.md`. Cloud build was submitted; no staging promotion or production deployment has occurred.

## 2026-09-25 — Resume Checker interaction and report redesign

- Reworked the Resume Checker into a two-column workspace with one clearly numbered primary review action, a separate profile-details action, and job-description matching beside those controls. Results now use full-width responsive card grids instead of one narrow, indefinitely growing column.
- Added real byte-based upload progress followed by document-reading stages, plus an animated four-stage resume-check visualization. Expert resume transformation now has the same visible staged progress, preserves the existing editable draft on failure, and moves to the completed fields when a usable draft returns.
- Strengthened multi-column skills recovery for extracted PDF text by preserving bullet boundaries, preferring actual bullet skills, and filtering headings or adjacent narrative from the skills field.
- Rebuilt the private detailed-review PDF as a branded three-page A4 report with a visible SuccessPro mark, executive score summary, prioritized action cards, balanced two-column finding cards, page furniture, and no clipped or nearly blank page.
- Removed internal product language such as “evidence-led” from the customer-facing review and report.
- Verified 52 test files / 189 tests, focused PDF generation, TypeScript, lint, and the production build.
- Deployed immutable digest `sha256:7d471476…` as `successpro-web-staging-review-experience-77` with 100% staging traffic. Root/health return 200, authenticated route boundaries redirect correctly, and the revision has no error-level logs.

## 2026-09-25 — Resume Checker fallback recovery

- Fixed a production-blocking retry defect where a temporary rules-based fallback was cached for 24 hours and could be replayed after Gemini had recovered. Only provider-validated outputs are now reusable; fallback runs remain auditable but are never cached.
- Added content-free provider-attempt diagnostics with task, provider, model, failure code, and fallback depth so operations can distinguish transport, model, timeout, and validation failures without logging resume content.
- Reproduced the reported skills failure against the exact uploaded multi-column test PDF. The scorer now recognises uppercase section headings fused with adjacent-column text, treats social/volunteer headings as section boundaries, and recovers the actual bullet skills rather than reporting zero.
- Confirmed the live provider-health record currently has five configured providers and two healthy providers; the visible banner was stale fallback state, not current provider unavailability.
- Verified 51 test files / 188 tests, TypeScript, lint, and the production build.
- Deployed immutable digest `sha256:eab07e2…` as `successpro-web-staging-review-recovery-76` with 100% traffic. Root/health return 200, protected review access redirects correctly, and the revision has no error-level logs.
- Triggered fresh authenticated health and lifecycle gates on the deployed revision: both Vertex providers are healthy and all 12/12 career tasks passed provider validation. `analyzeResume` passed on the primary Vertex Gemini route without repair or fallback.

## 2026-09-25 — Visual career portrait dashboard

- Replaced the plain profile snapshot with a polished, high-resolution career portrait whose restrained accent treatment responds to the member's confirmed industry.
- Added an evidence-based world exposure map. It highlights only countries, cities, named regions, and broad APAC/EMEA signals present in the confirmed profile, and explicitly explains that provenance instead of implying travel or work history.
- Added a horizontally scrollable career journey with distinct flags for roles, education, credentials, and recognition, plus a visual profile-signal orb and dedicated awards/credentials gallery.
- Kept the dashboard useful for incomplete profiles with honest empty states and direct edit actions, while retaining detailed experience, education, projects, goals, and job feed sections below the visual overview.
- Added deterministic geographic, chronology, and industry-theme regression coverage. Verified 50 test files / 186 tests, TypeScript, lint, and the production build.
- Deployed immutable digest `sha256:086159a…` as `successpro-web-staging-career-portrait-75` with 100% staging traffic. Root/health return 200, the anonymous dashboard boundary redirects to sign-in, and the revision has no error-level logs.
- Corrected the release procedure for this service's intentionally revision-pinned traffic: releases now verify the pushed digest, create an explicitly named revision from that digest, then explicitly route 100% traffic and confirm the serving revision. This prevents a successful build from appearing deployed while the earlier revision remains active.

## 2026-09-25 — Iterative editable resume transformation

- Made the transformed candidate profile an iterative working draft: every field remains editable, members can save their corrections without leaving the page, or transform again using the edited fields as authoritative input.
- Added optional refinement instructions for emphasis and writing preferences. Factual changes must remain in the structured fields and continue through the source-grounding firewall.
- The second and later passes preserve section/role order, factual anchors, and effective wording where practical instead of rebuilding the draft unnecessarily.
- Kept document presentation independent from content refinement, so the selected resume theme, page size, contact block, and photograph are not reset by another transformation.
- Added immutable `resume_transform_versions` for each AI pass, included it in account export/deletion, and applied the existing 180-day draft-history retention policy.
- Verified 49 test files / 183 tests, TypeScript, lint, production build, secret scan, static security scan, root/health/authentication boundaries, and the authenticated 12/12 AI lifecycle gate.
- Deployed `iterative-resume-transform-20260925-74` as revision `successpro-web-staging-00071-r7b` with 100% traffic. Gemini 2.5 Flash rejected and repaired one unsupported numeric claim before the transform passed.

## 2026-09-24 — Legacy-account consent recovery

- Fixed the legacy-account dead end where an expert-tool request could require the current data-use terms without presenting a nearby way to accept them.
- Added a private no-store consent-state endpoint and a workspace-wide action banner that appears only when the signed-in account lacks the current external-processing confirmation. Newly registered users who accepted during signup do not see it.
- Moved the Resume Checker confirmation beside its action button, reopens it automatically after any server-side `428` consent response, and synchronizes acceptance immediately across every open career tool in the workspace.
- Replaced the legacy-only wording and button with a clear checkbox, Data Policy link, and `Accept and continue` action.
- Verified 49 test files / 182 tests, TypeScript, lint, anonymous GET/POST denial, root/health probes, and zero error-level logs.
- Deployed `legacy-consent-recovery-20260924-73` as revision `successpro-web-staging-00070-rkj` with 100% traffic.

## 2026-09-24 — Source-grounded AI resume transformation

- Added a semantic factual firewall after structured-output validation for expert resume transformation. Every employer, role title, date, institution, qualification, certification, project, award, publication, volunteer organization, language, and numeric claim must be supported by the uploaded resume or its extracted profile.
- Customer-owned identity and profile-state fields can no longer be replaced by redacted or rewritten provider values. Unsupported suggested skills/languages are removed deterministically; unsupported employers, dates, qualifications, or metrics reject the full response.
- Applied the same grounding check to cached AI responses and advanced the transform prompt/cache version so older ungrounded results cannot bypass the new rules.
- Added content-free lifecycle diagnostics containing only provider, validation stage, field path, and rule code—never resume text or rejected values.
- Added regression coverage for invented employers, titles, dates, certifications, skills, and metrics; one bounded repair; all-provider failure; and safe preservation of the original extracted profile. Verified 49 test files / 182 tests, TypeScript, lint, production build, secret scan, and static security scan.
- Deployed `grounded-transform-firewall-20260924-72` as revision `successpro-web-staging-00069-pbl` with 100% traffic. The authenticated live lifecycle gate passed 12/12; Gemini 2.5 Flash's initially unsupported numeric claim was rejected, repaired once, and then passed the grounding rules.

## 2026-09-24 — Tested Cloud Run rollback and restore

- Added a guarded one-command Cloud Run rollback utility that requires the exact target revision as confirmation, refuses split traffic, validates revision readiness, moves 100% traffic without rebuilding, probes the root and health endpoints, and writes timestamped evidence.
- Added the rollback and restoration procedure to the deployment runbook and shell-syntax validation to CI.
- Rehearsed the full path on staging: revision `successpro-web-staging-00065-9c4` was rolled back to `successpro-web-staging-00064-glh`, then restored to revision 65. Both directions finished at 100% traffic with HTTP 200 responses from `/` and `/api/health`.
- Evidence is recorded under `output/rollback-evidence/`; staging remains on revision `successpro-web-staging-00065-9c4`.

## 2026-09-24 — Audited failed-webhook recovery

- Added a separate least-privilege billing-recovery console for super, operations, finance, and read-only auditor roles; finance staff do not receive access to moderation or support queues.
- The queue shows only minimal signed-event metadata and excludes raw payment payloads and card data.
- Replay requires a specific recorded reason, rechecks eligibility transactionally, caps attempts at five, applies the existing monotonic add-on/subscription state rules, restores paid-through entitlement when supported, and records immutable actor/role/before/after/outcome evidence.
- Attempts that remain unmatched are now counted and audited too, preventing an unresolved record from bypassing the replay limit.
- Added validation for blank provider identifiers and invalid attempt counts, anonymous route/page access checks, and focused desktop/mobile browser coverage.
- Verified TypeScript, lint, the production build, 3 focused unit tests, and 4 focused desktop/mobile browser tests.
- Deployed `webhook-replay-20260924-68` as revision `successpro-web-staging-00065-9c4` with 100% traffic. Live health is 200, anonymous billing-recovery navigation is denied, unauthorized replay returns 403, and the revision has no error-level logs.

## 2026-09-24 — Expert resume transformation and production-quality documents

- Separated faithful résumé extraction from expert transformation so unpolished source text can be retained safely without satisfying the stricter professional-writing contract.
- Added a dedicated target-aware senior resume-writer task that requires a focused headline and executive summary, curated skills, concise action-led role achievements, correct evidence-to-role attribution, removal of source-editor notes, and traceable change explanations without inventing facts.
- Added schema gates that reject contact/skills/highlight contamination in the summary, missing transformed work history, more than 24 priority skills, more than eight bullets per role, and residual editor instructions. An unavailable or invalid AI response now leaves the existing draft unchanged instead of presenting extraction as a finished rewrite.
- Reworked all four resume themes with restrained professional palettes, 8 pt body text, 9–10 pt headings, 13.5–14 pt names, justified narrative content, real bullet hierarchy, two-column skills/projects/supporting evidence, optional portraits, and matching cover-letter themes.
- Fixed page balancing and a cover-letter pagination condition; a content-rich baseline now renders cleanly on one A4 page in every style without orphaned or nearly blank overflow pages.
- Verified TypeScript, lint, the production build, 48 test files / 177 tests, and all 48 PDF matrix variants. Page-by-page visual review covered every final resume and matching cover letter.
- Deployed `expert-transform-20260924-66` as revision `successpro-web-staging-00064-glh` with 100% traffic. The live authenticated lifecycle gate returned HTTP 200 and persisted 12/12 provider-validated tasks; `transformResumeProfile` passed on Gemini 2.5 Flash with no repair attempt.

## 2026-09-24 — Required legacy-account AI consent at the point of use

- Diagnosed the reported generic Resume Checker result: the verified legacy account had no `registration_consents` document, so personal résumé content was correctly withheld from Vertex and the fixed-rule fallback was used.
- Added the mandatory, versioned external-AI data-use confirmation directly to Resume Checker for legacy accounts, with a Data Policy link and immediate in-page activation after acceptance.
- The review API now returns `428` before rate-limit, allowance, scoring, persistence, or AI work when the current acceptance is missing; a legacy user can no longer unknowingly spend a review and receive the lower-value fallback.
- Verified 47 test files / 174 tests, TypeScript, lint, and the 61-page production build.
- Deployed `review-consent-gate-20260924-65` as revision `successpro-web-staging-00063-49b` with 100% traffic. Live health is 200 and anonymous review submission remains denied with 401.

## 2026-09-24 — Auditable Resume Checker test exemption

- Added a server-only, exact-email allowlist for verified staging test accounts to bypass only the calendar-month Resume Checker allowance.
- Exempt reviews keep the ordinary burst limit and create a distinct zero-consumption usage-ledger entry instead of silently disappearing from operational evidence.
- Added a clear testing-access quota badge after the first successful exempt review and regression coverage for normalization, exact matching, and verified-email enforcement.
- Verified 46 test files / 171 tests, TypeScript, lint, and the 61-page production build.
- Deployed `test-review-exemption-20260924-64` as revision `successpro-web-staging-00062-q2l` with 100% traffic. Live health is 200 and the server configuration contains only `deepakjosey@gmail.com` in the exemption allowlist.

## 2026-09-24 — Audited learning-source management

- Added a Firestore-backed course catalog that safely merges active admin-managed records with the vetted built-in fallback; inactive overrides can remove a source from customer recommendations immediately.
- Added content/operations-admin publishing and activation controls with strict URLs, bounded taxonomy fields, verification dates, required affiliate disclosure, reason-required state changes, and append-only audit evidence.
- Kept recommendation ranking independent of commercial status: the AI sees source-grounded course IDs and relevance fields, while customers see any partner-link disclosure directly on the course card.
- Added contract tests for every built-in source, mandatory affiliate disclosure, safe identifiers, and executable-URL rejection. Verified 45 test files / 169 tests, TypeScript, and lint.
- Deployed `learning-admin-20260924-63` as revision `successpro-web-staging-00061-rhv` with 100% traffic. Health returns 200, member learning redirects anonymous visitors to sign-in, the admin console redirects non-admin visitors, and anonymous catalog mutations fail closed with 403.

## 2026-09-24 — Working Vertex AI across the career lifecycle

- Added one bounded, schema-guided repair attempt for malformed or schema-invalid provider responses. The repair reuses the original grounded prompt, includes concise validation failures, preserves the same strict output schema, and fails over after one unsuccessful attempt.
- Persisted repair-attempt counts in AI run metadata and lifecycle validation evidence, with regression coverage proving successful repair and bounded provider failover.
- Deployed `ai-schema-repair-20260924-62` as revision `successpro-web-staging-00060-zng` with 100% traffic. The authenticated release gate completed with HTTP 200 and persisted 11/11 provider-validated tasks; ten used Gemini 2.5 Flash and support used the Flash-Lite fallback, with no repair needed for already-valid first responses.
- Enabled Vertex AI and granted the Cloud Run runtime the standard Vertex AI User role, using workload identity instead of another shared API key.
- Added Gemini 2.5 Flash as the quality-first primary and Gemini 2.5 Flash-Lite as the low-cost fallback ahead of the Developer API and deterministic final fallback.
- Disabled optional thinking tokens for bounded structured career tasks, kept per-task output ceilings/timeouts, added per-member task rate limits, and retained response caching and circuit breaking.
- Upgraded prompts from top-level key hints to the full nested JSON schema, resolving live validation failures for complex profile, review, LinkedIn, goal, learning, salary, job, and support outputs.
- Added a protected lifecycle release gate with representative, synthetic data for all 11 tasks. Revision 58 passed 11/11: resume understanding, expert review, issue explanation, section rewriting, cover letters, LinkedIn, career plans, learning, salary, jobs, and support.
- Connected the support assistant to the customer Help Center while preserving mandatory human escalation for high-stakes categories.
- Deployed image `vertex-ai-customer-journey-20260924-61` as revision `successpro-web-staging-00059-smv` with 100% staging traffic; health and policy/help pages return 200, while anonymous AI and internal-validation calls fail closed with 401.
- Verified 166 tests, TypeScript, lint, and the production build before the repair release.

## 2026-09-24 — Public policy suite and consented Gemini foundation

- Added public Terms and Conditions, Data Management and Privacy, Cookie, Cancellation, Refund, Digital Delivery, and Contact/Grievance pages, linked permanently from the site footer.
- Added direct signup links to the Data Policy and Terms, plus a separate mandatory, versioned provider-neutral confirmation disclosing external AI processing and free-tier provider data use.
- Added a legacy-account consent control in Privacy & account; personal data cannot enter the external provider chain until that account has accepted the current version.
- Enabled the Google Generative Language and API Keys services, created a Gemini-only service-account-bound credential, stored it in Secret Manager, and granted access only to the staging runtime identity.
- Configured Gemini primary and model fallbacks with schema validation, circuit breaking, deterministic final fallback, and a daily synthetic provider health endpoint that records availability without breaking member journeys.
- Live quota probes currently return Google HTTP 402 (`prepayment credits are depleted`) for both service-account-bound and unbound restricted keys. The unusable candidate key was deleted; deterministic fallback remains functional until Google generation quota is available.

## 2026-09-24 — Full-resume understanding and column-safe extraction

- Replaced narrow profile drafting with whole-resume extraction for identity, location, headline, summary, skills, employment chronology and achievements, education, certifications, volunteering, and languages.
- Added an expert `extractResumeProfile` task for evidence-grounded structured drafting and an explicit member-triggered transformation step; privacy-sensitive visibility flags remain off and every draft still requires member confirmation.
- Added customer-visible honesty when the configured AI provider is unavailable instead of presenting deterministic guidance as expert AI output.
- Reworked PDF reading order to detect column clusters and read each column top-to-bottom rather than mixing sidebar skills with the main profile narrative.
- Validated the implementation against the exact `Deepak Josey - Test.pdf`: 20 skills, five career entries, one degree, three certifications, name, location, summary, and current role now populate in their corresponding fields.
- Added regression coverage for compact headings, employer-first work-history lines, plain Skills sections, and two-column PDF reading order.
- Verified 164 tests, TypeScript, lint, and the production build.

## 2026-09-24 — Test subscription creation and entitlement sync

- Added authenticated server-only Razorpay test-subscription creation from validated per-currency plan IDs and the current trusted monthly price book.
- Uses bounded one-year terms—12 monthly, 4 quarterly, or 1 annual charge—with customer notification disabled and only opaque internal references sent to the provider.
- Added subscription webhook normalization for authenticated, active, past-due, paused, cancelled, and completed states.
- Subscription activation/charge now atomically persists the webhook, subscription paid-through period, and account entitlement; a failed transaction remains safely retryable.
- Cancellation/completion events disable renewal while preserving already-paid future access.
- Added subscription records to account export and financial-record anonymization on account deletion.
- Verified 163 tests, TypeScript, and lint.

## 2026-09-24 — Payment webhook integrity and ordering

- Upgraded Razorpay webhook persistence to a dedicated event ledger with raw-body SHA-256, provider event ID/type/time, receipt time, processing attempt/result, normalized state, and matched internal record.
- Made duplicate handling transactional and added a monotonic state reducer so delayed authorization or failure events cannot regress a paid or refunded order.
- Added recovery behavior for captured payments following an earlier failure, plus refund and dispute normalization.
- Verified 157 tests, TypeScript, and lint.
- Deployed image `webhook-integrity-20260924-54` as revision `successpro-web-staging-00052-qnc` with 100% staging traffic; health is 200 and unsigned webhook/automation mutations both fail closed with 401.

## 2026-09-24 — Versioned pricing and signup locks

- Added authoritative INR plan prices, 13 supported billing currencies, monthly price-book versions, local charm rounding, and safe stale/missing/unsupported FX handling.
- Added an authenticated ingestion endpoint that converts the official ECB EUR-base daily reference file into INR-base reference records and persisted per-currency monthly price books.
- Added immutable-at-signup price locks recording the selected plan, currency, server price, FX rate/date, lock timestamp, price-book version, and pricing-rule version.
- Added strict per-currency Razorpay plan-ID configuration validation without enabling live payments.
- Included signup price locks in account export and permanent deletion handling.
- Deployed the corrected price-book image `versioned-price-book-20260924-53` as Cloud Run revision `successpro-web-staging-00051-z25` with 100% staging traffic.
- Created enabled `successpro-daily-fx-refresh` at 01:30 UTC with the dedicated automation identity and bounded retries. A manual run returned HTTP 200 from revision 51 in 7.80 seconds; anonymous invocation returns 401.

## 2026-09-24 — Evidence-led expert Resume Checker

- Replaced narrow section detection with common professional heading variants, including Executive Profile, Professional Experience, Academic Background, Core Skills, competencies, and career-history labels.
- Added short exact résumé excerpts to achievement, measurable-impact, and professional-positioning evidence so recommendations are grounded in the member's own content.
- Reworked expert guidance and deterministic fallbacks to explain strengths, recruiting impact, and specific improvements without generic provider/fallback language.
- Removed all customer-facing references to the internal score calibration while preserving it as an internal scoring control.
- Repaired the Poppler PDF fallback to use bounded private temporary files instead of an unreliable stdin invocation, with guaranteed cleanup.
- Verified 148 tests, lint, TypeScript, and the production build; deployed image `expert-resume-review-20260924-51` as revision `successpro-web-staging-00049-m5j` with 100% staging traffic. Health and anonymous review/upload authorization probes pass.

## 2026-09-24 — Audited moderation access

- Added append-only audit evidence whenever an authorized staff member opens the operations/moderation console, including actor roles, bounded queue counts, fixed policy purpose, outcome, and explicit proof that private conversation content was not included.
- Preserved deny-by-default role checks and separately reason-required, state-transition audit records for moderation decisions.
- Verified 147 tests, lint, TypeScript, production build, secret scan, and static security scan; deployed image `audited-moderation-access-20260924-50` as revision `successpro-web-staging-00048-m9r` with 100% staging traffic. Health, anonymous admin redirect, and moderation-mutation denial pass.

## 2026-09-24 — Complete private career story

- Extended the private dashboard with confirmed skill-growth history derived from immutable profile versions, including profile-update number and saved date.
- Confirmed the existing career highlights already surface projects, certifications, awards, publications, volunteering, languages, and professional links alongside experience, education, goals, reviews, and statistics.
- Added an explicit empty state for members whose skill history begins with the current profile.
- Verified 147 tests, lint, TypeScript, production build, secret scan, and static security scan; deployed image `complete-career-story-20260924-49` as revision `successpro-web-staging-00047-s7g` with 100% staging traffic. Health, Dashboard redirect, and preserved contact-match authorization pass.

## 2026-09-24 — Private contact matching

- Added optional contact matching to Professional network with explicit purpose-specific consent and a 100-address maximum.
- Normalizes addresses in memory, compares only SHA-256 hashes against indexed member account hashes, and returns only already-published professional profiles.
- Never stores submitted plaintext contact addresses; retained hashes carry a 30-day expiry and are included in scheduled deletion, account export, and permanent account deletion.
- Rate-limits matching and avoids bulk reading account email addresses.
- Added normalization, deduplication, consent, and input-bound tests; 147 tests, lint, and TypeScript checks pass.
- Production build, secret scan, and static security scan pass; deployed image `private-contact-matching-20260924-48` as revision `successpro-web-staging-00046-kpx` with 100% staging traffic. Health, Network redirect, and anonymous contact-match authorization pass.

## 2026-09-24 — Mentor booking and test-ledger lifecycle

- Added participant-only mentorship booking lists and rate-limited booking requests for future sessions with verified mentors.
- Added mentor confirmation, secure external meeting links, dual session-completion confirmation, customer review, either-party cancellation, customer no-show, and participant dispute flows.
- Added status notifications plus append-only booking events containing actor role, state transition, and required reasons without exposing records to nonparticipants.
- Added atomic test-mode payment authorization, server-calculated configurable platform commission, mentor earnings, and append-only payout hold/release-review entries; no live charge or payout occurs.
- Added mentorship bookings/payments/payout records to portable export and account deletion coverage.
- Added booking-action and ledger calculation coverage; 144 tests, lint, TypeScript, production build, secret scan, and static security scan pass.
- Deployed image `mentor-bookings-test-ledger-20260924-47` as revision `successpro-web-staging-00045-r68` with 100% staging traffic; health, Mentorship-page redirect, booking-list/create, and lifecycle-mutation authorization boundaries pass.

## 2026-09-24 — Mentor applications and due diligence

- Added a signed-in mentorship marketplace with approved mentor discovery and clear booking/payment gating until test-mode and business approvals are complete.
- Added rate-limited mentor applications covering category, skills, relevant experience, mentoring evidence, session rate/currency/duration, timezone-aware availability, external-meeting mode, and accuracy confirmation.
- Prevented self-publication: mentor and operations admins must approve or reject with a substantive reason; decisions are transactional, audited, and notified to the applicant.
- Approval atomically creates a deliberately bounded public mentor profile; private application review data remains outside the public projection.
- Added mentor applications and profiles to member export and deletion coverage.
- Added due-diligence validation tests; 142 tests, lint, TypeScript, production build, secret scan, and static security scan pass.
- Deployed image `mentor-due-diligence-20260924-46` as revision `successpro-web-staging-00044-6hp` with 100% staging traffic; health, Mentorship-page redirect, mentor discovery/application, and admin-decision authorization boundaries pass.

## 2026-09-24 — PDF text extraction resilience

- Reproduced `Deepak Josey - Test.pdf` locally: 8,794 readable characters across two pages are available from its embedded-text layer.
- Confirmed the corresponding live upload returned HTTP 422 because optional visual-layout inspection could invalidate already-successful PDF text extraction in the Cloud Run environment.
- Changed PDF processing to preserve and return readable embedded text with neutral layout signals when optional visual inspection fails; true low-text/image-only failures still use OCR or return a clear error.
- Added regression tests covering both the readable-text fallback and genuine total-failure path.
- Verified 139 tests, lint, TypeScript, production build, secret scan, and static security scan; deployed image `pdf-text-fallback-20260924-43` as revision `successpro-web-staging-00041-g6j` with 100% staging traffic and a healthy live service.
- After the exact attachment still returned 422, traced the remaining pre-extraction difference to the Alpine Cloud Run container's native canvas runtime and installed the required glibc/C++ compatibility libraries in build and runtime stages.
- Added privacy-safe extraction failure classification (file kind plus error type/code only; no name, text, or account data) so future native failures are diagnosable without exposing résumé content.
- Deployed image `pdf-native-runtime-20260924-44` as revision `successpro-web-staging-00042-gsx` with 100% staging traffic; live health is 200 and the protected Review route serves normally.
- A subsequent authenticated upload proved revision 42 still returned 422. Added an independent, bounded Poppler fallback (`pdftotext`) to the runtime image so embedded text no longer depends on PDF.js/native canvas initialization or cleanup; primary visual inspection remains available when healthy.
- Deployed image `pdf-poppler-fallback-20260924-45` as revision `successpro-web-staging-00043-xtl` with 100% staging traffic after 139 tests, lint, TypeScript, production build, secret scan, and static security scan passed.

## 2026-09-24 — Professional activity feed

- Added a connections-only professional feed for member-shared new roles, certifications, career milestones, goal progress, and awards.
- Added a mostly chronological timeline, Celebrate/Support/Insightful reactions, reasoned reports, reversible member muting, and connection removal as unfollow.
- Kept comments deliberately disabled until the required moderation controls are ready.
- Enforced event-level access checks before reactions and reports, and required a published professional profile before sharing.
- Added feed events/reactions and recruiter applications to portable account exports; feed records are deleted with the member account.
- Added feed validation and chronology tests; 137 tests, lint, TypeScript, production build, and the high-severity production dependency audit pass.
- Deployed image `professional-feed-20260924-42` as revision `successpro-web-staging-00040-4bc` with 100% staging traffic; health, Feed-page redirect, feed read/publish, reaction, report, and connection-mute authorization boundaries pass.

## 2026-09-24 — Privacy-safe professional network

- Added signed-in member search across only public name, employer, role, industry, and location fields with international text normalization and bounded results.
- Added explainable professional suggestions using shared industry, location, role, or skill signals while excluding private contact details, résumé text, and sensitive traits.
- Added connection request, accept, decline, withdraw, remove, notification, and blocked-relationship prevention flows.
- Added a Network workspace with public-profile links and accepted-connection messaging entry points.
- Added connections to portable account exports and account-deletion cleanup.
- Added network normalization/search/suggestion tests; 134 tests, lint, TypeScript, production build, secret scan, and static security scan pass.
- Deployed image `professional-network-20260924-41` as revision `successpro-web-staging-00039-dm8` with 100% staging traffic; health, Network-page redirect, search, connection-list, mutation, and request authorization boundaries pass.

## 2026-09-24 — Recruiter due diligence and job management

- Added recruiter-access applications with organization website, work identity, registration jurisdiction/number, hiring purpose, and explicit authority confirmation.
- Added operations-admin-only approval/rejection with mandatory reasons, transactional state changes, append-only audit events, and applicant notifications; auditor access remains read-only.
- Added verified recruiter navigation, pending/rejected/approved status handling, first-party job lifecycle controls, applicant profile and career-timeline review, and messaging continuation.
- Added recruiter records to account deletion/export policy foundations and recruiter jobs to owner-scoped cleanup.
- Added due-diligence validation tests; 132 tests, lint, TypeScript, production build, secret scan, and static security scan pass.
- Deployed image `recruiter-due-diligence-20260924-40` as revision `successpro-web-staging-00038-q7n` with 100% staging traffic; health, member recruiter routes, applicant routes, lifecycle mutations, and admin-decision authorization boundaries pass.

## 2026-09-24 — Editable Word application documents

- Added editable DOCX export for all four résumé styles and their theme-matched cover letters alongside existing PDF downloads.
- Preserved A4/Letter sizing, 8–9 pt body text, 9–10 pt section headings, 12–14 pt names, theme fonts, accents, contact order, section hierarchy, bullet structure, and cover-letter word rules.
- Added valid-OOXML package tests for résumé and cover-letter content and styling.
- Generated representative résumé and cover-letter DOCX files, rendered both through LibreOffice to PDF and page PNGs, corrected inline role/date spacing, and visually approved the second render for clipping, overlap, wrapping, gaps, and page breaks.
- Full release evidence: 130 tests, lint, TypeScript, security scans, and production build pass.
- Deployed image `editable-docx-20260924-39` as revision `successpro-web-staging-00037-2pf` with 100% staging traffic; health and DOCX-route authentication boundaries pass.

## 2026-09-24 — Resilient multi-source jobs and verified recruiter board

- Added Bright Data as an optional Google Jobs results channel with original HTTPS application URLs, explicit source-approval gating, and a shared monthly ceiling below its free allowance.
- Kept Google-derived results nonessential: approved public feeds, government sources, employer career pages, and verified recruiter postings continue when any connector fails or reaches its allowance.
- Added due-diligence-gated recruiter posting, a master recruiter-job board with role/department/location/experience/CTC filters, and SuccessPro-profile-only applications.
- Added recruiter applicant views with career timeline data, duplicate application prevention, notifications, and automatically created private message threads.
- Added normalization and recruiter-board tests; 128 tests, lint, TypeScript, security scans, and production build pass.
- Deployed image `resilient-jobs-recruiter-board-20260924-38` as revision `successpro-web-staging-00036-pvb` with 100% staging traffic; health, authentication redirects, and recruiter API authorization boundaries pass.

## 2026-09-24 — Free preview entitlements and 30-day regional jobs

- Added a server-resolved, Firestore-configurable entitlement service spanning reviews, detailed reports, resume/cover-letter builders, LinkedIn guidance, job search/alerts, salary tools, contacts, and rewrite credits.
- Kept every feature enabled in the current free-preview environment; paid enforcement activates only through the later controlled billing-live switch.
- Replaced hard-coded review/contact monthly limits with plan-resolved values and added an immutable idempotent ledger record for each new-contact entitlement use.
- Added an official Adzuna regional API connector with country, keyword, location, and provider-side 30-day filters, supporting approved India coverage without board scraping.
- Enforced a second server-side 30-calendar-day cutoff so undated, future, and older postings never reach customer feeds, regardless of provider behavior.
- Documented the source policy for regional jobs, salary benchmarking, future de-identified customer benchmarks, and profile-aware learning research.
- Added on-demand regional advertised-salary research using Adzuna's official histogram endpoint; the result retains source/date/sample size and a market-research disclaimer before entering the member's editable evidence.
- Added entitlement, Adzuna, job-age, and weighted salary-distribution coverage; 123 tests and TypeScript checks pass.
- Added experience and functional/technical keyword preferences plus precise Google Jobs discovery links for each role/location combination; Google result cards remain in Google's interface because automated Search scraping is not authorized.
- Added Google Jobs query coverage and keyword-aware approved-source ranking; 124 tests pass.
- Added independent regional API searches for every member's own saved role/location/keyword combinations, with cross-query deduplication before profile-aware ranking; no example role is shared across customers. Added customer-specific search coverage; 125 tests pass.

## 2026-09-24 — Privacy-safe operational telemetry

- Added a server-only, allowlisted product-event service that cannot accept resume text, free-form member content, URLs, email addresses, or arbitrary metadata.
- Added bounded events for sign-in, resume upload/review, AI provider/cache/fallback use and latency, job search/feed, payment webhook state, and support intake.
- Added role-gated 24-hour upload, review, job-search, payment, AI fallback, and latency aggregates to the admin console without displaying member content.
- Added product events to portable account export, permanent deletion, and the enforced 730-day retention schedule.
- Added telemetry sanitization and time-window aggregation coverage; 119 tests and TypeScript checks pass.
- Deployed image `privacy-telemetry-20260924-34` as Cloud Run revision `successpro-web-staging-00034-6sb` with 100% staging traffic; live health and admin/export/retention authorization boundaries pass.

## 2026-09-24 — In-app notifications and preferences

- Added a central signed-in notification inbox with unread state, individual acknowledgement, and mark-all-read support.
- Connected notification producers for new contacts/messages, daily job matches, and support receipts without allowing notification failure to break the primary workflow.
- Added per-category preferences while keeping payment, privacy, and security notices mandatory.
- Included notification preferences and notification records in account export and permanent account deletion.
- Avoided composite-index dependencies by sorting each member's bounded notification result in memory.
- Added notification-preference coverage; 116 tests and TypeScript checks pass.
- Deployed image `notifications-20260924-32` as Cloud Run revision `successpro-web-staging-00032-pf7` with 100% staging traffic; live health, notification-login redirect, and anonymous API boundaries pass.
- Connected completed Resume Checker reports, Razorpay payment states, new sign-ins, and public-profile-link changes to the inbox, using idempotent event keys so retries cannot revive an already-read notice.
- Added payment-state language coverage; 117 tests pass.
- Deployed image `notification-events-20260924-33` as Cloud Run revision `successpro-web-staging-00033-lth` with 100% staging traffic; live health and notification/review/payment authorization boundaries pass.

## 2026-09-24 — Help center and human grievance queue

- Added a searchable public help center covering resume upload/scoring, profile correction/sharing, data rights, jobs, salary, payments, security, and messages.
- Added authenticated, daily rate-limited support intake with private reference IDs and explicit warnings against submitting secrets or unnecessary sensitive data.
- Forced privacy/data-rights, security, payment dispute, correction, abuse, and mentor-conflict categories to human review; security receives urgent priority and the other high-stakes cases receive high priority.
- Connected the newest 100 support requests to the role-gated admin console with reason-required assignment/resolution and append-only audit events.
- Included support requests in portable export and permanent account deletion, and anonymized retained staff assignment identifiers on deletion.
- Added escalation-policy coverage; 115 tests, lint, TypeScript, static security scan, and production build pass.
- Deployed image `support-help-20260924-31` as Cloud Run revision `successpro-web-staging-00031-v67` with 100% traffic; the public help center returns 200, ticket intake returns 401 without sign-in, and unauthorized admin support writes return 403.

## 2026-09-24 — Role-gated moderation and audit trail

- Replaced the public admin preview with a dynamic deny-by-default admin console recognizing the documented eight-role vocabulary.
- Added a bounded queue of the newest 100 member reports that shows submitted report evidence without opening private conversation messages.
- Restricted moderation writes to super/ops/support roles, while allowing auditor read access.
- Required a 10–1,000 character decision reason and wrote an append-only audit event containing actor, roles, target, before/after status, reason, outcome, and timestamp.
- Prevented terminal resolved/dismissed reports from being reopened through the moderation endpoint.
- Extended account deletion to anonymize retained reviewer and admin-audit actor identifiers.
- Added role-filter and transition regression tests; 113 tests, lint, TypeScript, static security scan, and production build pass.
- Deployed image `admin-moderation-20260924-30` as Cloud Run revision `successpro-web-staging-00030-vc7` with 100% traffic; anonymous admin navigation redirects and unauthorized moderation writes return 403.

## 2026-09-24 — Bounded message history and safety velocity

- Added server-side cursor pagination that reads at most 51 message records and returns 50 at a time, with an explicit “Load older messages” action.
- Validated each cursor against the authorized conversation and reject missing or stale cursor records instead of broadening the query.
- Added transaction-backed daily report limits and minute-level block/unblock safety-action limits with clear 429 and `Retry-After` responses.
- Added cursor-boundary regression coverage; 111 tests, lint, TypeScript, static security scan, and production build pass.
- Deployed image `message-pagination-20260924-29` as Cloud Run revision `successpro-web-staging-00029-swj` with 100% staging traffic; live message-page, conversation, and report authentication boundaries pass.

## 2026-09-24 — Public-profile section privacy

- Added member-controlled visibility for professional summary, location, current role, industry, skills, experience, and education.
- Centralized the public-profile projection so hidden fields are omitted at write time from both normal profile publishing and rotated sharing links.
- Added an explicit search-engine listing preference that remains off by default and drives page-level `index`/`noindex` metadata.
- Preserved previous visible-section behavior for legacy profiles without making them searchable.
- Added projection regression tests proving hidden summary and achievement content never enters the public record; 110 tests, lint, TypeScript, static security scan, and production build pass.
- Deployed image `profile-privacy-20260924-28` as Cloud Run revision `successpro-web-staging-00028-p9z` with 100% staging traffic; live health, profile authentication, and retention authentication probes pass.

## 2026-09-24 — Enforced operational retention

- Added a collection-by-collection retention schedule separating automated, member-controlled, and legal/accounting-approval-controlled data.
- Added a bounded daily cleanup engine for expired AI cache, rate limits, refresh throttles, stale feeds/jobs, AI metadata, old draft versions, deletion audit events, and old product-usage records.
- Added a Google OIDC-verifiable internal automation identity path shared by retention and daily job-feed automation, while retaining the existing secret option for controlled compatibility.
- Kept the existing one-day Cloud Storage lifecycle for temporary upload objects and documented account-deletion handling for member-controlled data.
- Added cutoff regression tests for Firestore timestamp, ISO instant, and ISO date fields.
- Provisioned `successpro-automation` as a dedicated OIDC identity and enabled two Cloud Scheduler jobs: job feeds at 02:00 UTC and retention at 02:30 UTC, each with three bounded retries.
- Deployed image `retention-automation-20260924-27` as Cloud Run revision `successpro-web-staging-00027-cqp` with 100% traffic; manual Scheduler executions returned HTTP 200 for both endpoints, while direct unauthenticated probes return 401.

## 2026-09-24 — User and imported-content XSS controls

- Added executable regression tests proving hostile profile/message-style text renders as escaped text instead of executable markup.
- Extracted and tested the public job-page HTML conversion path; scripts, styles, noscript content, tags, and event-handler markup are removed before imported text is stored or displayed.
- Added a shared HTTP(S)-only URL schema and applied it across member projects, credentials, publications, professional links, job records/sources, course sources, salary evidence, and AI inputs/outputs.
- Blocked executable `javascript:` and `data:` URL schemes while retaining valid HTTPS links.
- Updated resume-first onboarding copy to include both legacy `.doc` and modern `.docx` Word files.
- Expanded verification to 106 passing tests; lint, TypeScript, static security scan, and production build pass.
- Deployed image `xss-controls-20260924-26` as Cloud Run revision `successpro-web-staging-00026-hrc` with 100% staging traffic; live health and sensitive authentication boundaries pass.

## 2026-09-24 — Complete account-deletion identity cleanup

- Corrected deletion of compound-ID usage-allowance and rate-limit documents by querying their owner field instead of assuming the document ID equals the member ID.
- Added personal AI cache to both portable export and permanent account deletion.
- Anonymized moderation reports through their actual `reporterId` ownership field.
- Removed deleted identities from shared-conversation participant, initiator, last-sender, read-state, legacy read-state, and block-state fields; deleted-user message previews are now replaced as well.
- Removed SuccessPro user IDs from all newly created Razorpay order notes and added a provider-data-minimization regression test.
- Expanded verification to 103 passing unit/security/regression tests; lint, TypeScript, static security scan, and production build pass.
- Deployed image `privacy-complete-20260924-25` as Cloud Run revision `successpro-web-staging-00025-ltf` with 100% staging traffic; live health and authentication boundaries pass.

## 2026-09-24 — Word resume compatibility

- Extended Resume Checker uploads from PDF/DOCX/TXT to include legacy binary Word `.doc` files.
- Added extension, MIME, and OLE file-signature agreement so renamed or mismatched files fail closed.
- Added in-process legacy Word parsing without an Office process or shell conversion in production; extracted content now feeds the same profile draft, structure review, strict scoring, storage, and versioning path.
- Updated the upload interface and recovery guidance to describe both `.doc` and `.docx` as Word files.
- Verified parsing against a real Word 97 document, plus lint, TypeScript, 99 automated tests, static security scanning, and the production build.
- Deployed image `word-resumes-20260924-24` as Cloud Run revision `successpro-web-staging-00024-6rj` with 100% staging traffic; live checks confirm health and authentication boundaries.

## 2026-09-24 — Abuse and message velocity controls

- Added Firestore-transaction rate-limit windows for resume uploads/checks, public job-page imports, new contact attempts, and message sending.
- Added user-facing 429 responses with Retry-After guidance while preserving the existing calendar-month product allowances.
- Added boundary tests proving the configured number of attempts is permitted and the next attempt is rejected.
- Deployed image `velocity-controls-20260924-23` as Cloud Run revision `successpro-web-staging-00023-7dz` with 100% staging traffic.

## 2026-09-24 — Consent withdrawal and account deletion

- Added recent Firebase re-authentication for processing-consent withdrawal and permanent account deletion.
- Added versioned withdrawal events, immediate refresh-session revocation, and restricted post-withdrawal access limited to data export or deletion.
- Added account deletion that removes Firebase identity, direct and versioned private career records, uploaded resume objects, and authored message content.
- Preserved shared-conversation integrity and legally/operationally retained payment, consent, and safety records only after disconnecting them from the member under an anonymous deletion reference.
- Replaced the settings-page placeholder with explicit, typed-confirmation privacy controls and clear retention language.
- Deployed image `privacy-lifecycle-20260924-22` as Cloud Run revision `successpro-web-staging-00022-gh9` with 100% staging traffic.

## 2026-09-23 — Safe job-description URL import

- Added optional public job URL import to the Resume Checker for bounded HTML, text, PDF, PNG, and JPEG descriptions.
- Added DNS-pinned server-side retrieval that rejects private, loopback, link-local, metadata, reserved, and mixed public/private DNS results and revalidates every redirect.
- Enforced HTTP/HTTPS-only URLs, standard ports, no embedded credentials, three redirects, eight-second timeout, 5 MB maximum, supported MIME types, and uncompressed response bodies.
- Added provenance in the UI and a hostile IPv4/IPv6/URL regression corpus.
- Added explicit CI secret detection and static security scans; the high-severity dependency audit remains part of the release gate and currently reports no known vulnerabilities.
- Deployed image `safe-jd-security-20260923-21` as Cloud Run revision `successpro-web-staging-00021-d4c` with 100% staging traffic.

## 2026-09-23 — Resume Checker OCR, strict scoring, and visual review

- Renamed the member-facing resume assessment to Resume Checker across the landing page, dashboard, plan, pricing, workspace, and detailed report.
- Added scanned-PDF OCR using embedded page images and authenticated Google document recognition, while retaining recovered partial text when OCR is unavailable.
- Fixed the upload flow so recovered text populates the editable resume field and network/non-JSON failures produce a visible, actionable message.
- Added deterministic PDF page analysis for page count, columns, tables, text size, density, whitespace balance, and margin consistency; upload-derived signals now flow into the actual review request.
- Added equivalent native DOCX analysis for page metadata, columns, tables, margins, font size, colour usage, page breaks, document density, and important content placed in headers or footers.
- Expanded the checker’s factor language to cover layout and visual presentation plus resume length and writing quality.
- Added `successpro-ats-v2`, which applies the requested 20% strictness adjustment to every factor’s earned points and reconciles rounding so the factor total exactly equals the final score.
- Enabled the Vision API and granted the staging runtime only the service-usage permission required to invoke it.
- Deployed image `resume-checker-visual-20260923-19` as Cloud Run revision `successpro-web-staging-00019-92z` with 100% staging traffic.
- Deployed the DOCX-equivalent checker in image `resume-checker-docx-20260923-20` as Cloud Run revision `successpro-web-staging-00020-qc4` with 100% staging traffic.

## 2026-09-23 — Career intelligence, geography, consent, and expert services

- Added a shared typed AI orchestration layer with privacy approval gates, redaction, validation, failover, caching, circuit breaking, and built-in fallbacks across the core career tools.
- Added mandatory, versioned registration consent for terms/adult eligibility and automated career-data processing.
- Added per-factor resume explanations, resume/cover-letter/LinkedIn assistance, career gap planning, curated upskilling guidance, and source-bound salary narratives.
- Added lawful Greenhouse, Lever, and official USAJOBS connector foundations, source normalization, deduplication, stale handling, preferred/close location matches, five granular locations, and daily dashboard feeds.
- Anchored salary planning to present-job geography and expanded local currencies.
- Added one-time professional writing projects at ₹10,000 and ₹15,000, controlled international conversion, server-side Razorpay Orders, and signed idempotent webhook handling.
- Expanded preferred guidance languages globally while preserving original resume/source language and proper names.
- Deployed image `career-ai-global-20260923-13` as Cloud Run revision `successpro-web-staging-00013-jqb` with 100% staging traffic.
- Added durable factor-level detailed-review explanations and authenticated PDF report export with observed fact, inference, and suggestion labels.
- Added automatic resume/cover-letter studio draft saving, immutable draft versions, recent-version restore, and cover-letter undo/redo.
- Deployed image `detailed-reports-history-20260923-14` as Cloud Run revision `successpro-web-staging-00014-t7d` with 100% staging traffic; live probes confirm the new report and draft-history APIs remain authentication-protected.
- Added privacy/account settings and authenticated self-service JSON data export spanning the member's primary account collections and nested conversation messages.
- Deployed image `data-export-20260923-15` as Cloud Run revision `successpro-web-staging-00015-pjw` with 100% staging traffic; live probes confirm the settings redirect and export authentication boundary.
- Added central exact-origin and Fetch Metadata enforcement for all session-cookie API mutations, with verified rejection of cross-site requests and no permissive CORS response.

## 2026-09-23 — Resume-first onboarding and career planning expansion

- Removed the hard-coded Avery Patel sample resume from the member review screen.
- Replaced the blank-profile redirect with a resume-first choice: upload a resume and review the extracted draft, or choose manual entry when no resume exists.
- Preserved the requested destination through extraction, correction, and profile confirmation.
- Added a complete LinkedIn makeover workspace with copy-ready sections and an optional private LinkedIn-PDF coverage comparison.
- Expanded career goals across role, salary, company, industry, geography, skill, target date, categorized monthly actions, and progress.
- Added persistent, source-backed salary planning with role/location/context inputs, dated evidence ranges, confidence, market range, central estimate, and an honest no-data state.
- Expanded document QA to 48 PDFs across four themes, A4/Letter, photo on/off, short/medium/long content, long names, and Hindi/English; all pass the automated audit and rendered visual review.
- Verification now includes 53 passing unit/regression tests and 50 passing desktop/mobile access-control and WCAG tests.

## 2026-09-23 — Resume and cover-letter document studio

- Reviewed representative XF Resume visual, text, and executive samples and recorded an original SuccessPro document design standard.
- Added four customer-selectable styles: Clarity, Signature, Momentum, and Editorial.
- Added embedded Inter, Source Sans 3, and Noto Sans fonts with enforced 8-9 pt body, 9-10 pt section heading, and 12-14 pt name sizing.
- Added A4/US Letter PDF generation, profile-backed resume content, customer-controlled contact details, and optional JPG/PNG portraits for supported styles.
- Added matching cover-letter creation from the saved profile, target role, employer, and opportunity notes, with a customer-editable 250-450-word draft.
- Added authenticated, no-store PDF endpoints and request validation for both document types.
- Added eight A4 reference PDFs, exact PDF preflight, Poppler rendering, and page-by-page visual review; corrected blank-page and split-heading defects found during visual QA.
- Expanded verification to 49 unit/regression tests and 42 desktop/mobile browser, access-control, and automated WCAG A/AA tests; lint, typecheck, and production build pass.
- Deployed immutable image `documents-20260923-12` as Cloud Run revision `successpro-web-staging-00012-b8q` with 100% staging traffic; public/health routes, protected-route redirection, anonymous PDF denial, preserved runtime limits, and zero revision error logs were verified.

## 2026-09-23 — Resume and cover-letter design foundation

- Reviewed every page of six representative XF Resume PDFs across visual, text, and executive categories, plus the official samples and cover-letter pages.
- Added `docs/RESUME_COVER_LETTER_DESIGN_STANDARD.md` with original SuccessPro layout principles, exact typography limits, photo behavior, content rules, pagination requirements, matching-cover-letter rules, PDF preflight, and release fixtures.
- Defined four original customer-selectable style families: Clarity, Signature, Momentum, and Editorial.
- Added a typed template registry that locks each resume and cover letter to the same theme and enforces the approved point-size contract.
- Added a renderer-facing PDF preflight rule engine and regression tests for blank, scattered, underfilled, clipped, overlapping, out-of-bounds, missing-glyph, and extraction-order failures.
- Verified that Cloud Run revision `successpro-web-staging-00011-cxp` serves 100% of staging traffic, public health routes pass, and no error-level revision logs are present.

## 2026-09-23 — Complete canonical career detail model

- Expanded the versioned private career profile to preserve projects, certifications, awards, publications, volunteer work, languages, and professional links.
- Added structured profile editing and private dashboard presentation for the new career-history categories.
- Kept the new categories private rather than silently adding them to the public-profile read model; per-section sharing controls remain required before publication.
- Added backward-compatibility and complete-structure regression tests.
- Deployed immutable image `phase2-career-data-20260923-11` as Cloud Run revision `successpro-web-staging-00011-cxp` with 100% staging traffic and unchanged cost caps.

## 2026-09-23 — Master requirement audit and delivery ledger

- Re-read the complete original SuccessPro master brief and reconciled it against repository and staging evidence.
- Added `docs/MASTER_DELIVERY_PLAN.md` with stable IDs and evidence states for phased product work, AI/privacy/security/operations, all named data domains, explicit edge cases, and production gates.
- Separated independent engineering work from founder/legal/accounting/credential gates and recorded the immediate execution order through verified production launch.
- Linked the ledger from the product specification and updated the current milestone status.
- Added the complete 16-class synthetic resume golden dataset with reviewed score bands and explicit factor ceilings for scanned, complex-layout, missing-date, and inconsistent-chronology risks.
- Added per-participant latest-message read state, unread conversation indicators, and focused regression tests.
- Added atomic public-profile link replacement: the new safe public record is published while the previous link is immediately revoked.
- Added 1080×1350 portrait sharing images alongside the existing 1200×630 landscape format.
- Added LinkedIn, Facebook, native sharing, and copy-link controls with browser fallbacks.
- Deployed immutable image `phase2-sharing-20260923-09` as Cloud Run revision `successpro-web-staging-00009-tsp` with 100% staging traffic and unchanged cost caps.
- Verified live public/health access, protected endpoint enforcement, security headers, and no error-level logs on the new revision.
- Added a responsive private career-story dashboard with confirmed experience and education timelines, role/skill/achievement statistics, and current-goal progress.
- Deployed immutable image `phase2-dashboard-20260923-10` as Cloud Run revision `successpro-web-staging-00010-7cj` with 100% staging traffic and unchanged cost caps.
- Verified public health, exact protected-workspace return redirects, and no error-level logs on the dashboard revision.

## 2026-09-23 — Private messaging and member safety

- Added a responsive Messages area with server-rendered conversation summaries and a clear empty state.
- Added private conversation history and replies with membership checks on every read and write.
- Added block/unblock controls that pause replies for both participants without deleting the conversation history.
- Added member reporting for spam, harassment, misleading information, and other concerns.
- Stored reports separately from messages for later authorized moderation review.
- Kept email addresses and phone numbers out of all conversation responses and screens.
- Expanded verification to 36 passing desktop/mobile browser, access-control, and WCAG tests.
- Deployed immutable image `phase2-messages-20260923-08` as Cloud Run revision `successpro-web-staging-00008-g5j` with 100% traffic.

## 2026-09-23 — Audience-first language review

- Rewrote the resume-review journey around clear outcomes and next steps, removing implementation terms such as “deterministic rubric,” “evidence-led,” and “strict review.”
- Reworked dashboard, profile import, job preferences, pricing, billing, authentication errors, public profiles, contact flow, and upload errors using plain career-focused language.
- Renamed the 12 score areas and their explanations so job seekers can understand them without knowledge of AI or software architecture.
- Replaced the synthetic admin metrics and risk queue with an honest preview state.
- Added `docs/UX_WRITING.md` as the product-wide voice, button, error, and review standard.
- Added an automated copy regression test that blocks common implementation phrases from primary member screens.
- Verification now includes 10 passing unit tests and 32 passing desktop/mobile browser, access-control, and WCAG tests.
- Deployed immutable image `audience-copy-20260923-07` as Cloud Run revision `successpro-web-staging-00007-4ds` with 100% traffic.

## 2026-09-23 — Phase 2 public sharing foundation

- Added opt-in public professional profiles with a dedicated safe read model that excludes email and phone.
- Made disabling a public profile immediately revoke its published state without deleting the owner’s canonical data.
- Added open-to-work presentation, career timeline, skills, education, and privacy-preserving public contact UX.
- Added server-rendered 1200×630 downloadable social snapshot images with private/no-store response caching.
- Added authenticated private contact initiation, deterministic conversation records, messages, and server-enforced 3-new-contacts/month allowance.
- Added contact-to-login return flow and retained the intended public profile action after authentication.
- Expanded the browser suite to 32 passing desktop/mobile access-control and automated WCAG tests.
- Deployed immutable image `phase2-sharing-20260923-06` as Cloud Run revision `successpro-web-staging-00006-hfm` with 100% traffic.

## 2026-09-23 — Canonical profile review flow

- Added deterministic structured profile extraction for labelled resume text, including confidence and user-facing warnings.
- Stored each extraction with its immutable resume version and exposed an explicit opt-in import into the canonical profile.
- Added editable experience, achievement, and education records so extracted data can be corrected before confirmation.
- Preserved privacy defaults when applying a draft: public profile and open-to-work preferences are never enabled by extraction.
- Expanded verification to 9 unit tests and 28 desktop/mobile browser and automated WCAG tests.

## 2026-09-23 — Authenticated Phase 1 staging foundation

- Connected Firebase email/password authentication, verification, secure session cookies, and protected-route return flows.
- Provisioned Firestore Native and a private Cloud Storage bucket with scoped runtime permissions and storage lifecycle controls.
- Added persistent versioned profiles, ATS analyses, monthly usage ledger, career goals, and job preferences.
- Added private PDF/DOCX/TXT ingestion, parsing, SHA-256 recording, and resume versioning.
- Added separate job-description matching, plan entitlements, pricing, billing foundation, and honest connector states.
- Fixed the Cloud Run PDF module failure by deferring `pdf-parse` loading until server canvas globals are installed; revision `successpro-web-staging-00004-thg` restored correct protected endpoint behavior.

## 2026-09-23 — Initial staging deployment

- Linked `My Billing Account 1` to the dedicated staging project.
- Created a project-scoped INR 1,000 monthly budget with alerts at 50%, 80%, and 100%.
- Enabled only the required staging APIs and created the `asia-south1` Artifact Registry repository.
- Created the dedicated `successpro-web-staging` runtime service account.
- Removed Google's automatic legacy Editor role from the default Compute identity and replaced it with scoped build permissions.
- Split build and deployment authority: Cloud Build builds and pushes; the authenticated project owner deploys to Cloud Run.
- Built immutable image `phase1-20260923-01` and deployed revision `successpro-web-staging-00001-9hr` to `https://successpro-web-staging-913575819720.asia-south1.run.app`.

## 2026-09-23 — Staging project creation

- Created and verified active Google Cloud project `successpro-staging-1706786b` (`SuccessPro-Staging`, project number `913575819720`).
- Confirmed the intended Google account through Google's CLI OAuth flow.
- Attempted to link the only open INR billing account; Google rejected it because the account's billing-project quota is exhausted.
- Left billable APIs and deployment resources disabled pending billing resolution.

## 2026-09-23 — Phase 1 foundation

- Added typed resume-analysis contracts and a framework-independent domain package.
- Added a versioned deterministic 12-factor ATS engine, evidence/action output, and target-keyword matching.
- Added free-review calendar-month usage policy that excludes failed parses and system errors.
- Added pre-upload PDF/DOCX/TXT size, MIME, extension, and signature validation.
- Added the interactive privacy-safe resume review route and desktop/mobile result screenshots.
- Expanded verification to 6 unit tests and 18 desktop/mobile browser and WCAG tests.

## 2026-09-23 — Phase 0 baseline

- Added the SuccessPro monorepo and Next.js web application scaffold.
- Added branded landing, authentication, career workspace, and admin shells.
- Added responsive and reduced-motion behavior, focus states, semantic navigation, and initial WCAG-oriented tokens.
- Added security headers, health endpoint, environment validation, unit tests, and Playwright smoke tests.
- Added Cloud Run, Cloud Build, CI, cost guardrails, and core operating documentation.
- Imported the original starter bundle and brand references without modification.
