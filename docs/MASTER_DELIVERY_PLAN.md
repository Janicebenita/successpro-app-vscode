# Master delivery plan

Last audited: 2026-09-26 (production-launch gap audit; see `FINAL_PRODUCTION_LAUNCH_GAP_ANALYSIS.md`)

## Evidence correction 2026-09-25

Historical checked items below record prior implementation evidence, not a blanket current release approval. Current real-sample testing contradicts full confidence in P1-024/P1-025 extraction and transformation completeness; P3-034 cover-letter generation has produced duplicated text and placeholders; authenticated revision 83 review fell back. These requirements remain under repair and must pass the complete real-sample and deployed workflows before launch. P6-004 proves only the health endpoint, not the full alerting requirement. P1-045 has a local fix and eight passing route tests for charging only completed expert reviews; deployed verification remains outstanding. The original scope and all incomplete gates remain binding; no subset release is final completion.

This ledger translates `successpro_codex_bundle/SUCCESSPRO_MASTER_CODEX_BRIEF.md` into verifiable delivery work. The master brief remains the product specification; this file is the execution and evidence index.

## Status and evidence rules

- `[x]` means current repository and staging evidence prove the item.
- `[~]` means a usable foundation exists, but one or more named acceptance conditions remain.
- `[ ]` means not yet implemented or not yet proven.
- No feature is complete based on a screen alone. Evidence must include implementation, focused automated tests, staging behavior, error states, authorization where relevant, responsive/accessibility checks, documentation, and rollback readiness.
- External approvals, legal conclusions, credentials, DNS ownership actions, and live-payment enablement remain explicit founder gates. They do not prevent independent product work from continuing.
- Phase 7 is post-launch scope. It is tracked here but is not a gate for the first production launch unless the founder promotes an item into launch scope.

## Program gates applying to every phase

- [x] `G-001` Use phased delivery with a working staging checkpoint after each phase.
- [x] `G-002` Keep `STATUS.md`, `DECISIONS.md`, `BLOCKERS.md`, and `CHANGELOG.md` current.
- [x] `G-003` Keep architecture, security/privacy, AI, payments/tax, deployment, admin, data-model, and test documentation in source control.
- [~] `G-004` CI now runs lint, typecheck, unit tests, explicit secret detection, static security checks, production build, and high-severity dependency audit; relevant browser/accessibility suites are run before staging releases. Dedicated datastore migration/index verification and automated post-deploy log inspection remain.
- [ ] `G-005` Enforce the three-focused-attempt repair rule in blocker entries with attempt history.
- [x] `G-006` Keep secrets out of source; inject environment configuration at runtime.
- [ ] `G-007` Require a documented backup and rollback point before every destructive production action.
- [x] `G-008` Keep ATS numbers deterministic, versioned, transparent, and identical across free and paid tiers.
- [x] `G-009` Treat AI output as advisory and prohibit job, interview, salary, or ATS guarantees.
- [x] `G-010` Use only lawful/public/licensed/official external job sources.
- [x] `G-011` Keep live Razorpay disabled until functional and merchant-review gates are met.
- [x] `G-012` Use supplied brand assets as references without copying unrelated reference content.

## Phase 0 — repository, architecture, design, and staging baseline

- [x] `P0-001` Monorepo with web app and shared contract/domain packages.
- [x] `P0-002` Next.js/TypeScript web shell, reusable design tokens, and responsive component foundation.
- [x] `P0-003` Premium ink/navy, restrained gold, and light reading-surface visual system based on supplied references.
- [x] `P0-004` Branded landing, login, signup, authenticated app shell, and admin shell.
- [x] `P0-005` WCAG smoke baseline: keyboard focus, semantic structure, contrast, and automated A/AA checks.
- [x] `P0-006` Public SEO shell and fast authenticated navigation baseline.
- [x] `P0-007` Security headers and secure server-session foundation.
- [x] `P0-008` Dev/staging/prod environment strategy documented; tests do not target production.
- [x] `P0-009` Google Cloud staging plan and reproducible Cloud Run deployment configuration.
- [x] `P0-010` Cloud Run cost caps: min zero, conservative maximum instances, concurrency, CPU, memory, and timeout.
- [x] `P0-011` Firestore Native and private Cloud Storage in staging.
- [x] `P0-012` Least-privilege runtime identity.
- [x] `P0-013` Budget thresholds and storage lifecycle baseline.
- [x] `P0-014` CI gates for lint, types, unit tests, build, and dependency audit.
- [x] `P0-015` Desktop/mobile screenshots and Checkpoint 0 document.
- [x] `P0-016` Public staging URL and immutable Cloud Run revisions.

## Phase 1 — identity, canonical profile, ingestion, and free resume review

### Identity and account trust

- [x] `P1-001` Verified email/password signup and login.
- [x] `P1-002` Email-verification enforcement.
- [x] `P1-003` Secure server session, sign-out, protected routes, and return-to behavior.
- [~] `P1-004` Google identity provider is enabled and the live login and consent-gated signup buttons open Google's chooser. Completed real-account signup, session return, and account recovery remain to be witnessed.
- [~] `P1-005` Existing password members can initiate Google linking from Privacy & account settings, and duplicate-account errors are handled. A completed same-UID link and subsequent Google sign-in remain to be witnessed.
- [~] `P1-006` Data-processing withdrawal and account deletion require a freshly re-authenticated Firebase identity token and revoke refresh sessions; password/email/provider changes and a complete sensitive-action matrix remain.
- [ ] `P1-007` Optional passkey evaluation and documented decision.
- [~] `P1-008` Normalize identity fields and prevent duplicate verified-email identities; emulator/integration proof remains.
- [ ] `P1-009` Internal privacy-preserving trust/risk model with verified signals, velocity, similarity, mismatch, and reports.
- [~] `P1-010` Server-enforced per-user burst limits now protect resume uploads/checks and remote job-page imports; signup App Check/reCAPTCHA and IP-level distributed controls remain.
- [ ] `P1-011` Admin queue for high-risk duplicate/impersonation patterns.

### Resume upload, parsing, and canonical data

- [x] `P1-020` Accept selectable-text PDF, legacy Word DOC, modern Word DOCX, and TXT; all four enter the same profile-extraction and Resume Checker pipeline.
- [x] `P1-021` Validate extension, MIME/signature, size, page/text limits, archives, and document macros.
- [x] `P1-022` Store original file privately with digest and per-user ownership.
- [x] `P1-023` Extract text and create versioned resume/parsed-profile records.
- [~] `P1-024` Produce a structured whole-resume draft with field confidence and warnings; column-aware PDF ordering and compact-heading recognition cover sidebar skills plus main-body identity, summary, work history, education, certifications, volunteering, and languages. On 2026-09-27, all ten supplied files completed a Gemini 3.6 structured extraction batch with schema/source-support validation and bounded repair/fallback. Complete claim-by-claim source approval remains open.
- [~] `P1-025` Resume-first onboarding extracts a private draft, offers iterative expert transformation, lets members edit/save or transform again from their corrected facts and preferences without resetting document style, versions every pass, and requires review before canonical profile confirmation; blank manual entry remains an explicit alternative. On 2026-09-27, all ten supplied profiles completed the transform, cover-letter, and LinkedIn validation chain and their generated PDF pair was rendered. Real-sample customer-correction and founder writer-quality acceptance remain open.
- [x] `P1-026` Never overwrite confirmed corrections with a later low-confidence parse.
- [x] `P1-027` Provide manual profile creation for users without a resume.
- [ ] `P1-028` Isolate parsing in a dedicated worker/job.
- [ ] `P1-029` Add production-grade malware scanning and quarantine/rejection states.
- [x] `P1-030` Detect low-text/scanned PDFs and run authenticated document OCR on embedded page images, with a no-quota failure path and partial-text fallback.
- [~] `P1-031` Legacy binary Word DOC ingestion is implemented with OLE signature validation and in-process text extraction; RTF/ODT remain, while LinkedIn PDF ingestion is available in the dedicated makeover flow.
- [ ] `P1-032` Detect/preserve source language and support multilingual extraction.
- [~] `P1-033` Capture document-layout signals. PDF and DOCX uploads now feed automated page count, columns, repeated tables, text size, density, whitespace, and margin checks into the Resume Checker; DOCX also checks colour usage and important header/footer content. PDF text-box/header/footer/extraction-order and richer graphic/colour analysis remain.

### Free review and job-description matching

- [x] `P1-040` Versioned 12-factor, 100-point deterministic review rubric.
- [x] `P1-041` Each factor returns points/max, evidence, issues, why it matters, and prioritized action.
- [x] `P1-042` Critical/high/medium/low severity model.
- [x] `P1-043` Honest SuccessPro benchmark wording without claims of reproducing proprietary ATS systems.
- [x] `P1-044` Three completed reviews per calendar month per account.
- [~] `P1-045` Local review route now charges only after validated AI completion, atomically with report persistence; fallback is recorded as partial with zero usage, thrown generation consumes nothing, and final transaction prevents concurrent overspend. Eight route tests pass. Deployed verification remains required; earlier revisions charged before AI completion.
- [x] `P1-046` Separate job-match score for supplied JD text.
- [x] `P1-047` Job match covers evidence, missing requirements, partial/transferable matches, suggested changes, and reliability.
- [x] `P1-048` Safe JD URL ingestion validates every initial/redirect URL and resolved address, pins the connection to a public DNS result, and enforces source URL/date, timeout, redirect, size, MIME, scheme, port, credential, compression, and private/reserved-address controls.
- [x] `P1-049` Job-description URL ingestion extracts bounded public HTML/text plus PDF and PNG/JPEG content through the existing PDF/OCR paths.
- [x] `P1-050` Synthetic golden resume corpus covers all 16 required classes with reviewed score bands and factor ceilings for known document risks.
- [x] `P1-051` Authenticated staging E2E of the complete free acquisition journey using a representative synthetic document. On 2026-09-27, the isolated `salary-graceful` revision completed upload/extraction, transformation, profile confirmation, review/report, resume and cover PDF/DOCX export, LinkedIn, goals, learning, salary, opportunities, document persistence, desktop/mobile navigation and partner entry-point checks before promotion. This does not replace real-sample editorial acceptance.

## Phase 2 — career dashboard, public sharing, and messaging foundation

- [~] `P2-001` Private dashboard is driven by the latest confirmed profile and includes experience/education timelines, role-skill-achievement statistics, projects, certifications, awards, review activity, goal progress, and skill additions derived from immutable profile-version history. The founder's 2026-09-26 screenshot showed the current role fourth after education; newest-first sorting is fixed locally, pending deployed UI acceptance.
- [x] `P2-002` Photo/initials fallback, headline, current role, latest score, goal, and profile state.
- [x] `P2-003` Career story presents employer, designation, dates, achievements, education, projects, certifications, awards, publications, volunteering, languages, links, current goal progress, responsive empty states, and skill-growth history.
- [x] `P2-004` Public profile is explicit opt-in and uses a separate safe read model.
- [x] `P2-005` Open-to-work is opt-in; email and phone are hidden by default.
- [x] `P2-006` Public profile has a noindex control/default for staging.
- [x] `P2-007` Disable sharing immediately unpublishes the public record.
- [~] `P2-008` Explicit public-link rotation atomically publishes a new safe record and revokes the old link; authenticated staging E2E proof remains.
- [x] `P2-009` Server-rendered 1200×630 social image.
- [x] `P2-010` Portrait/Instagram-friendly 1080×1350 downloadable snapshot is deployed alongside the 1200×630 landscape image.
- [x] `P2-011` LinkedIn, Facebook, native share, and copy-link actions with useful fallbacks are deployed.
- [x] `P2-012` Unauthenticated public contact preserves intent through signup/login.
- [x] `P2-013` Three new public-profile contact initiations per free user per month; replies are free.
- [x] `P2-014` Participant-only conversations, replies, block/unblock, and report.
- [~] `P2-015` Per-participant latest-message read state, unread indicators, and focused rule tests are deployed; authenticated two-account staging E2E proof remains.
- [~] `P2-016` Monthly contact quota plus hourly new-contact and per-minute message velocity controls are enforced server-side with Retry-After guidance; similarity/risk scoring and moderation automation remain.
- [x] `P2-017` Admin moderation access is deny-by-default, role-bounded, excludes private conversation content, and writes append-only access evidence with actor roles, queue counts, scope, fixed policy purpose, and outcome; decisions separately require typed reasons and audit state transitions.

## Phase 3 — premium entitlement, builders, test billing, and invoices

### Entitlements and pricing

- [x] `P3-001` Central plan/entitlement model exists.
- [x] `P3-002` Free, monthly ₹499, quarterly ₹1,299, and annual ₹3,999 pricing presentation.
- [~] `P3-003` Resume Checker and new-contact consumption now write immutable, idempotent per-user usage-ledger records; detailed-report, salary, and rewrite consumption remain to be metered when paid differentiation opens.
- [~] `P3-004` A server-resolved, Firestore-configurable entitlement service now covers reviews, detailed reports, both builders, LinkedIn guidance, job search/alerts, salary, contacts, and rewrite credits. All features remain enabled during the free preview; full paid enforcement awaits gateway launch.
- [x] `P3-005` An enabled 01:30 UTC OIDC-authenticated daily job normalizes official ECB reference rates to INR, stores dated FX references and monthly per-currency price books with the documented international uplift and local charm rounding, rejects stale/missing rates, and falls back safely to INR. Manual live runs returned HTTP 200; anonymous access returns 401.
- [x] `P3-006` Signup records a server-authoritative plan/currency/amount lock with FX rate/date, lock timestamp, monthly price-book version, and pricing-rule version; the record is included in account export and deletion.
- [~] `P3-007` Strict server validation and lookup for per-currency Razorpay plan IDs exists; actual test-mode plan IDs remain gated on Razorpay configuration.

### Razorpay test-mode lifecycle

- [~] `P3-010` One-time add-on orders and bounded one-year recurring subscription terms are created only server-side from the controlled price book and validated per-currency plan IDs; the browser cannot submit an amount. A real Razorpay test subscription remains gated on test keys/plan IDs.
- [x] `P3-011` Razorpay webhook HMAC is verified against the untouched request body; event ID/type/provider time, raw-body SHA-256 integrity reference, receipt time, match result, processing attempt/result, and normalized state are persisted before acknowledgement.
- [~] `P3-012` Transactional duplicate rejection and a monotonic state reducer prevent delayed authorization/failure events from regressing paid/refunded add-on orders; the same reducer still needs subscription lifecycle integration when subscription creation opens.
- [~] `P3-013` Subscription charged/activated events atomically update the subscription and paid-through entitlement in the same transaction as the webhook ledger; provider retry safely recovers a failed transaction because no event acknowledgement is persisted without entitlement sync. Failed-event replay and live test evidence remain.
- [x] `P3-014` Failed/unmatched signed-webhook recovery has a least-privilege finance/operations queue, reason-required bounded replay, transactional re-evaluation, entitlement/order synchronization, immutable success/failure audit evidence, and a hard five-attempt limit. Raw provider payloads and card data are excluded from the console.
- [~] `P3-015` Subscription cancellation/completion webhook state disables renewal while retaining a verified future paid-through entitlement; member-initiated provider cancellation UI/API remains.
- [ ] `P3-016` Failure notifications, configurable grace period, final downgrade, and content preservation.
- [ ] `P3-017` Configurable refunds including initial goodwill, duplicate/error, renewal, and mentorship policies.
- [ ] `P3-018` Billing page shows renewal, cancellation, payment, invoice, refund, and tax states without dark patterns.
- [ ] `P3-019` GST-ready invoices and accounting metadata; export/LUT classification remains accountant-approved configuration.
- [ ] `P3-020` Country/jurisdiction enablement table for international sales gates.

### Premium career tools

- [~] `P3-030` Detailed analysis now extends the same authoritative rubric with factor evidence/issues, prioritization, saved explanations, chronology factors, example approaches, and authenticated PDF report export; deeper line-level before/after editing and job-calibrated report sections remain.
- [x] `P3-031` Detailed on-screen and PDF recommendations explicitly label observed fact, inference, and suggestion.
- [~] `P3-032` Resume/letter studio supports resume import via canonical profile, structured sections, autosaved version history with restore, letter undo/redo, preview, template switching, and PDF plus editable DOCX export. Customers can now set and save an explicit section order; PDF and DOCX apply it consistently, while the recommended default retains its compact layout. Custom sections, full resume-field undo, duplication, and deployed authenticated acceptance remain.
- [~] `P3-033` Resume builder: the authenticated document studio now provides four tested styles, saved-profile content, A4/Letter choice, optional photo treatment, live visual preview, saved section order, and production PDF plus editable DOCX export. Import/start blank, full resume-field undo, duplication, job tailoring in studio, real-time hints, and deployed authenticated acceptance remain.
- [~] `P3-034` Cover-letter builder accepts pasted target JD, provides direct/warm/executive variants through guarded assistance, creates a profile-grounded editable draft, enforces 250-450 words, locks the resume theme, autosaves versions with restore and undo/redo, and exports a one-page PDF or matching editable DOCX.
- [x] `P3-036` Review representative XF Resume visual, text, and executive samples page by page and document original SuccessPro design principles without copying proprietary templates or candidate content.
- [x] `P3-037` Establish four original customer-selectable style families—Clarity, Signature, Momentum, and Editorial—with a typed registry, photo capability, ATS posture, palette, and fixed 8-9 pt body / 9-10 pt section / 12-14 pt name contract.
- [x] `P3-038` Establish a resume/cover-letter theme lock covering font, scale, accent, contact order, geometry, photo treatment, and header/footer behavior.
- [x] `P3-039` PDF preflight contract and executable audits cover embedded fonts, exact A4/Letter boxes, typography, required text, blank pages, out-of-bounds content, missing glyphs, photo policy, expected page ranges, and one-page cover-letter output. All 48 release-matrix PDFs pass.
- [x] `P3-040` React PDF uses embedded font metrics, automatic wrapping, explicit long-document continuation points, keep-with-next thresholds, unbreakable atomic records, and cover-letter widow/orphan control; short, long, optional-section, and multilingual stress fixtures pass.
- [~] `P3-041` A 48-PDF release matrix covers four themes, resume/cover-letter pairs, A4/Letter, photo on/off, short/medium/long content, long names, optional-section extremes, and Hindi/English content. Every file is programmatically audited, Poppler-rendered, and visually reviewed; independent PDFium comparison remains.
- [x] `P3-035` LinkedIn makeover accepts an optional uploaded profile PDF without scraping/edit automation and provides copy-ready headline, about, experience, skills, featured, credentials, projects, education, recommendations, search coverage, and visibility guidance.

## Phase 4 — jobs, goals, learning, and salary intelligence

- [~] `P4-001` Persistent career goals and initial gap-plan workspace. The founder found the goal UI and content inadequate; the current workspace presents a profile-led target, progress, active areas, and editable action plan. An authenticated deployed desktop/mobile journey successfully generated and opened a quality-model plan; real-profile editorial relevance and save/reopen acceptance remain.
- [~] `P4-002` Persistent goals cover designation, salary, company/industry, geography, priority skill, target date, categorized monthly actions, editable milestones, and progress. The target/plan presentation is side-by-side on desktop and single-column on mobile; the deployed synthetic journey passed both. Real-profile relevance, save/reopen behavior, and browser/editorial approval remain.
- [x] `P4-003` Persistent job preferences and honest empty state with no fabricated jobs.
- [~] `P4-004` Pluggable lawful Greenhouse, Lever, credential-gated USAJOBS, and credential-gated country-specific Adzuna connectors exist. Adzuna searches are generated per member from up to three saved roles, five locations, and keywords; India can use these plus employer ATS feeds. Indeed/Naukri/other commercial sources require approved partner/API access and are never scraped. Additional licensed sources and production credentials remain.
- [x] `P4-005` Store source ID/URL, first/last seen, posted date, employer, title, location, type, salary, description, normalized skills, and freshness; undated, future-dated, and older-than-30-day postings are excluded from ingestion and customer feeds.
- [x] `P4-006` Cross-source job deduplication and disappeared/stale-job handling.
- [~] `P4-007` Deterministic filters and guarded semantic ranking provide match reasons, gaps, five-location preferred/close fit, source, freshness, and member-supplied keywords; experience/keyword-aware Google Jobs discovery links open the source UI without scraping it. Salary-fit expansion remains.
- [~] `P4-008` Authenticated daily-ingestion/feed job and dashboard feed are invoked at 02:00 UTC by an enabled Cloud Scheduler job using a dedicated verified OIDC identity; a manual live run returned HTTP 200. Digest delivery, save/dismiss/apply tracking, and relevance feedback remain.
- [x] `P4-009` Curated course/certification catalog with provider, taxonomy, level, duration, price, geography/language, certification type, URL, and last-verified date.
- [x] `P4-010` Content/operations admins can publish or hide schema-validated, source-dated courses with append-only audit evidence; the member learning plan gives explainable profile-gap recommendations from active records only, preserves the vetted built-in catalog as fallback, and visibly discloses affiliate links without influencing rank.
- [x] `P4-011` Persistent salary research captures role, location, experience, industry, company size, skills, education, current/target compensation, currency, and dated source ranges.
- [~] `P4-012` Salary benchmarking calculates a transparent median range, central estimate, confidence, source recency, current/target position, drivers, negotiation checks, and explicit no-data fallback. It uses Gemini Google Search grounding for public online research, retaining only numeric ranges whose exact URLs are returned as grounding sources and labelling unavailable publication dates as accessed. On 2026-09-27, the deployed desktop/mobile synthetic journey verified that both a researched result and a sparse-data outcome leave the customer in an honest usable workspace rather than returning an HTTP error. Production source-quality, cost/usage monitoring, quantified uplift skills, nearby-role comparisons and salary-published jobs remain.

## Phase 5 — professional network, feed, and mentorship

- [x] `P5-001` Signed-in member search uses only permitted public-profile name, employer, role, industry, and location fields, with international text normalization and bounded results.
- [x] `P5-002` Connection request, accept, decline, withdraw, remove, notification, blocked-member prevention, and explainable non-sensitive professional suggestions are implemented.
- [x] `P5-003` Optional contact matching requires explicit purpose-specific consent, accepts at most 100 email addresses, compares normalized one-way hashes against indexed account hashes, returns only published profiles, never stores submitted plaintext, rate-limits use, and deletes retained hashes after 30 days.
- [~] `P5-004` Secure messaging has participant-only authorization, per-participant unread state, 50-message cursor pagination, message/contact/report/block velocity controls, block/unblock, reporting, and in-app notifications. Spam/content automation, authenticated load testing, and audited staff moderation remain.
- [x] `P5-005` Professional-event feed supports explicit member sharing for new roles, certifications, career milestones, goal progress, and awards to accepted connections.
- [x] `P5-006` Mostly chronological connection feed supports reactions, reversible per-connection mute, connection removal, and reasoned reporting; comments remain deliberately disabled until moderation is ready.
- [x] `P5-007` Mentor application captures approved categories, skills, experience, session rate/currency/duration, timezone-aware availability, external-meeting mode, and accuracy confirmation with resubmission controls.
- [x] `P5-008` Mentor/operations-admin due diligence provides reason-required approve/reject, append-only audit evidence, member notification, and atomic publication of an approved public mentor profile.
- [~] `P5-009` Participant-authorized booking, mentor confirmation, external HTTPS meeting link, dual completion confirmation, customer review, either-party cancellation, customer no-show, dispute, notification, and test-refund review states exist. Staff dispute/refund resolution and authenticated end-to-end evidence remain.
- [x] `P5-010` Booking creation atomically writes server-priced test payment, configurable platform commission, mentor earning, and append-only payout-ledger entries independent of UI state; live charging/payout remains correctly gated on business approvals.

## Cross-cutting product services

### AI orchestration

- [x] `XAI-001` Central typed orchestration API for review explanations, rewrites, cover letters, LinkedIn, gap plans, salary narratives, job ranking, learning, and support.
- [x] `XAI-002` Per-task typed input/output, prompt version, provider metadata, token budget, timeout, fallback, safeguards, and deterministic post-processing.
- [~] `XAI-003` Firestore-configurable provider chain, restricted Secret Manager credential, synthetic daily provider/model checks, health history, ordered failover, and documented rollback target exist; least-privilege admin UI remains.
- [x] `XAI-004` Identifier redaction/minimum-data policy and provider data-use approval gate.
- [x] `XAI-005` Cache by content hash, prompt version, and model-policy version.
- [~] `XAI-006` Full nested-schema validation, provider failover tests, circuit breaker, graceful all-provider failure, a single bounded schema-guided repair attempt, and a live synthetic 11-task lifecycle matrix exist and pass; broader semantic quality scoring remains.
- [x] `XAI-007` Prompt-injection defenses treating resume/JD/source content only as untrusted data.

### Privacy and data rights

- [~] `XPR-001` Public Terms, Data/Privacy, Cookie, Cancellation, Refund, Digital Delivery, and Contact/Grievance pages, 18+ rule, direct signup links, mandatory versioned automated-processing and external-AI data-use confirmations, and explicit public/open-to-work consent exist. Founder/legal approval and registered-business particulars remain launch gates.
- [x] `XPR-002` Versioned registration consent is recorded in an append-only event collection; legacy accounts are required to record the current external-AI data-use acceptance directly before Resume Checker processing or allowance consumption; members can withdraw automated career-processing consent after recent re-authentication, which records a withdrawal event, stops career-workspace access, and revokes refresh sessions while preserving restricted export/deletion access.
- [x] `XPR-003` Self-service authenticated JSON export covers account/profile/version data, resume metadata and parsed versions, reviews, quota/rate-limit data, goals/preferences, salary, drafts/history, consent/AI/cache/order records, recruiter applications/jobs, professional feed events/reactions, reporter-owned moderation records, conversations, and nested messages; binary originals are explicitly excluded from the JSON package.
- [x] `XPR-004` Recently re-authenticated account deletion removes identity, direct/owned private career records, uploaded resume objects, compound-ID quota/rate-limit records, recruiter applications/jobs, professional feed events/reactions, and personal AI cache. Authored message content plus initiator, last-sender, read-state, block-state, and deleted public-profile identifiers are scrubbed from shared conversations; retained payment/consent/safety records are disconnected under an anonymous deletion reference. New payment orders never send the SuccessPro user ID to Razorpay.
- [~] `XPR-005` Operational retention is documented and enforced for temporary objects, expired AI/rate-limit data, refresh requests, stale job feeds/source records, AI metadata, draft history, deletion audit events, and old product-usage records through bounded daily cleanup plus bucket lifecycle. Final payment/tax, consent, unresolved safety, and security/audit periods remain gated on jurisdiction-specific legal/accounting approval.
- [x] `XPR-006` Public links are atomically revocable/rotatable; members choose visibility separately for summary, location, role, industry, skills, experience, and education; hidden fields never enter the public read model; search indexing is off by default and changes only by explicit member preference.
- [x] `XPR-007` Block/report controls exist in participant messaging, reporting/mute/removal controls exist across feed and connections, and mentorship supports participant-only lifecycle actions plus reasoned cancellation, no-show, and dispute escalation.
- [~] `XPR-008` Authenticated privacy/data-rights grievance and security-concern intake now routes to a bounded human support queue with urgent/high priority, reason-required staff action, export/deletion coverage, and audit events. Formal incident command workflow, vendor/processor inventory, regional flags, approved mailbox/SLA copy, and country-specific policy support remain.

### Security

- [x] `XSC-001` HTTPS staging, secure cookies, baseline CSP/security headers, and strict session authorization.
- [x] `XSC-002` Central request proxy rejects session-cookie mutations without an exact same-origin Origin or with cross-site Fetch Metadata; bearer-authenticated automation/webhooks remain independently authenticated, and APIs emit no permissive CORS origin.
- [x] `XSC-003` Executable XSS tests verify React escaping for hostile user content, removal of scripts/event handlers from imported job HTML, and HTTP(S)-only URL schemas across member profile, job, course, salary-source, and AI link fields; static security scanning rejects dangerous raw-HTML injection.
- [x] `XSC-004` User-controlled URL retrieval uses a shared public-network-only fetcher with DNS pinning, redirect revalidation, strict protocol/port/credential/MIME/compression/size/time limits, and a hostile IPv4/IPv6/metadata URL corpus.
- [~] `XSC-005` Upload size/signature/page/macro/archive safeguards exist; malware, OCR isolation, zip-bomb corpus, and quarantine remain.
- [x] `XSC-006` Private bucket and scoped runtime identity.
- [ ] `XSC-007` Short-lived signed URL flow where direct object delivery is needed.
- [x] `XSC-008` CI and the root release check include explicit repository secret detection, practical static security rules, and a high-severity dependency vulnerability audit.
- [~] `XSC-009` Deny-by-default known-role authorization now protects the live moderation console; report decisions require a typed reason and create append-only actor/role/before/after/outcome audit events. Recent re-authentication for broader admin actions, generalized capability mapping, tamper-resistant external audit export, and reason-required read-only view-as-user remain.
- [~] `XSC-010` Firestore-transaction per-user limits protect upload, Resume Checker, job-URL import, new-contact, and message bursts with deterministic windows and Retry-After responses; IP-level limits, broader route coverage, moderation automation, and admin-compromise response remain.

### Admin, support, notifications, analytics, localization, and search

- [~] `XOP-001` Admin access recognizes the full super/ops/support/finance/mentor/content/advertiser/auditor role vocabulary and denies unknown/no-role sessions; moderation currently permits only super/ops/support and read access for auditor. Per-capability coverage across future modules remains.
- [~] `XOP-002` Admin moderation, support, operational telemetry, recruiter due-diligence, mentor due-diligence, course management, least-privilege failed-webhook recovery, member access/suspension, in-app reminders, payment and revenue roll-up, AI activity/fallback roll-up, operating-cost and AI-budget entries, and consent-aware tracking configuration now exist with reasoned, audited decisions. Razorpay secret rotation remains deployment/Secret Manager controlled; broader refunds, pricing/tax configuration, email-provider delivery, flags, source-job operations, and general audit browsing remain.
- [~] `XOP-003` Searchable public help center covers current resume/profile/privacy/jobs/salary/payments/messages topics; authenticated ticket intake, rate limits, reference IDs, bounded admin queue, and reason/audit-backed assignment/resolution are live. Page-context auto-prefill, event-aware answers, reply thread/email delivery, SLA tracking, and satisfaction remain.
- [x] `XOP-004` Privacy/data-rights, security, payment disputes, data correction, abuse, and mentor conflict are explicitly forced into human escalation; security is urgent, the other high-stakes categories are high priority, and product help remains normal priority.
- [~] `XOP-005` Central in-app notifications and per-category preferences now exist; payment, privacy, and security notices remain mandatory. Authorized administrators can send audited in-app service reminders. Email delivery and future push channels remain.
- [~] `XOP-006` Resume-review completion, new-contact/message, connection request/acceptance, daily job-digest, payment state, new sign-in, public-profile-link, and support receipts are connected. Subscription-renewal and mentor-event producers remain with those future modules.
- [~] `XOP-007` A bounded, content-free first-party event service now measures sign-in, resume upload/review, AI provider/fallback/cache use and latency, job search/feed, payment events, and support intake; the admin console shows 24-hour operational aggregates plus bounded AI, revenue, orders, profiles, and notification roll-ups. Consent-aware third-party tracking IDs can be configured by a super administrator and load only after optional-cookie approval. Subscription conversion/churn, mentor events, client performance, and generalized error telemetry remain with those modules.
- [~] `XOP-008` Search uses normalized Firestore-friendly fields; add formal service abstraction and offline indexes.
- [ ] `XOP-009` Translation-file architecture, locale-aware date/number/currency, RTL readiness, preserved original text, and preferred-language analysis.
- [x] `XOP-010` Responsive/PWA-ready web direction, platform-neutral APIs, shared contracts, and server-side domain logic baseline.

## Required data model

- [~] `DM-001` Core implemented collections: users/auth session linkage, profiles/profile versions, resumes/resume versions, parsed profiles, analyses, job descriptions, usage, public profiles, career goals, preferences, conversations/messages/reports. Confirm indexes and audit fields per schema.
- [~] `DM-002` `user_settings` now stores notification preferences; `auth_links` and risk-review data remain.
- [~] `DM-003` Billing includes entitlements, add-on payment records, signup price locks, FX references, and monthly price-book records. Subscriptions, invoices, refunds, tax rules, and complete webhook events remain.
- [~] `DM-004` Jobs/learning now includes external job sources/jobs, complete preferences, recruiter accounts/jobs/applications, and an admin-managed course catalog with active-state and affiliate disclosure. Persisted job matches, saved/dismissed/applied tracking, and persisted course recommendations remain.
- [x] `DM-005` Mentor applications, availability, approved public mentors, participant bookings/events, test payments, and append-only payout ledger exist with export/deletion handling.
- [x] `DM-006` Network connections, professional feed events/reactions, and moderation reports exist with account export/deletion handling.
- [~] `DM-007` Support tickets, notifications, privacy-minimized product/health events, AI runs/cache, admin audit events, and system configuration exist; email events, explicit admin-user records, and feature flags remain.
- [ ] `DM-008` Advertiser post-launch entities: advertisers and ad campaigns.
- [ ] `DM-009` Every entity has created/updated timestamps plus appropriate ownership and audit metadata.

## Explicit edge-case acceptance suite

- [~] `EC-001` No resume: manual profile path exists; complete E2E proof remains.
- [~] `EC-002` Password-protected, corrupt, unsupported, oversized, macro/archive, and low-text files: several guards exist; complete fixture/error-state suite remains.
- [~] `EC-003` Scanned/image OCR, multilingual scoring, two-column, and table-heavy cases are covered; hostile broken extraction-order binary fixtures still remain.
- [ ] `EC-004` Name mismatch, duplicate suspicion, changed email, and Google/password linking.
- [~] `EC-005` No JD, invalid/blocked URL, and image/PDF JD paths now exist with hostile URL coverage; vague-JD reliability fixtures remain.
- [ ] `EC-006` Resume changes after career dashboard generation must invalidate/reconcile derived views.
- [x] `EC-007` Public profile made private removes public access.
- [x] `EC-008` Blocked recipient prevents further public conversation use.
- [x] `EC-009` Calendar-month free review/contact quota behavior.
- [ ] `EC-010` Delayed/duplicate/out-of-order payment events, failed entitlement update, near-renewal cancellation, post-renewal refund, and chargeback.
- [x] `EC-011` Unsupported currency, unavailable rate, stale FX feed, and safe INR fallback behavior are covered by deterministic tests; signup refuses to lock an unavailable non-INR price.
- [x] `EC-012` Primary-provider errors/throttling, malformed output, one bounded repair, provider failover, all-provider failure, and invented transform claims are covered. A live 12-task gate proved that an unsupported numeric claim is rejected and repaired before acceptance; repeated invalid output preserves the prior extracted draft.
- [ ] `EC-013` Disappeared and duplicate jobs, sparse salary data.
- [~] `EC-014` Mentor/customer cancellation, customer no-show, booking disputes, and messaging report/block paths exist; authenticated end-to-end evidence and staff dispute resolution remain.
- [~] `EC-015` Account deletion cascades private data/files and anonymizes retained financial/consent/safety records; admin-compromise and email-provider-outage cases remain.

## Phase 6 — production hardening and launch

### Reliability and performance

- [x] `P6-001` Immutable release tags and a guarded one-command Cloud Run rollback are documented and tested on staging. Revision 65 was rolled back to revision 64 and restored to revision 65 with 100% traffic and HTTP 200 root/health evidence in both directions on 2026-09-24.
- [~] `P6-002` A non-destructive Firestore export completed on 2026-09-27 into the private staging bucket, with overall and shard manifests verified. Private-object recovery is tested: bucket versioning, seven-day soft delete, public-access prevention, uniform bucket access, a 30-day noncurrent-version lifecycle and a 90-day backup lifecycle are configured; a harmless overwritten sentinel object was restored successfully from its prior generation. Importing Firestore into a separate restore target remains required before production approval.
- [~] `P6-003` Bounded, audited failed-webhook replay and the AI circuit breaker are implemented. General async-job retry/dead-letter recording and replay remain.
- [~] `P6-004` Health endpoint exists. Version-controlled Cloud Run 5xx and p95-latency alert policies plus a notification-channel setup script are syntax-validated on 2026-09-27; an owner-controlled notification channel, deployed policies, delivery test, uptime, quota, and cost alerts are still required. A healthy endpoint alone does not complete monitoring.
- [ ] `P6-005` Measure public mobile p75 LCP, normal API p95, upload acknowledgement p95, and collection-read bounds.
- [ ] `P6-006` Load tests: concurrent login/upload, AI spikes, job batches, message pagination, public profiles, and webhook bursts with projected cost.

### Domain, email, compliance, and live business gates

- [ ] `P6-010` Create separate production Google Cloud project and least-privilege runtime resources.
- [ ] `P6-011` Map `successpro.xfactor.ltd` and verify HTTPS.
- [ ] `P6-012` Create/reserve support, noreply, payments, security, privacy, mentors, and advertisers mailboxes.
- [ ] `P6-013` Configure and verify SPF, DKIM, and DMARC; test transactional deliverability.
- [ ] `P6-014` Provider-abstracted email delivery and outage behavior.
- [ ] `P6-015` Founder/legal approval: privacy, terms, refund, retention, grievance, and incident copy.
- [ ] `P6-016` Accountant approval: GST, invoices, exports/LUT, TDS/mentor payout, and records.
- [ ] `P6-017` Approve paid-market list and jurisdiction-specific tax/VAT gates.
- [ ] `P6-018` Razorpay merchant approval, live secrets, webhook endpoint, and controlled live-mode enablement.
- [ ] `P6-019` Approve AI-provider data terms and production privacy tier before real resume data is sent.
- [ ] `P6-020` Final critical/high security audit clean: object privacy, SSRF, authz, RBAC, secrets, and upload controls.
- [ ] `P6-021` Final product gate: onboarding/no-resume/review/dashboard/share/premium/cancel/refund/admin support all verified.
- [~] `P6-022` Rollback and restore are verified with timestamped staging evidence; audited payment replay and AI circuit-breaker/fallback paths exist. General queue retry/dead-letter proof and final authenticated all-provider-failure UX evidence remain.
- [ ] `P6-023` Production smoke suite and real monitoring evidence after deployment.
- [ ] `P6-024` Founder-facing go-live checklist signed off; production URL announced only after gates pass.

## Phase 7 — post-launch scope

- [ ] `P7-001` Advertiser application, verification, campaigns, creative review, allowed targeting, budgets/schedules, labeled ads, tracking, billing, moderation, and reporting.
- [ ] `P7-002` Additional approved job sources after source-health and retention evidence.
- [ ] `P7-003` Additional complete translations chosen from demand evidence.
- [ ] `P7-004` Native mobile app, likely React Native/Expo, after stable platform-neutral APIs.
- [ ] `P7-005` Advanced managed search only when Firestore limits and economics justify it.
- [~] `P7-006` Founder-promoted recruiter workflow now includes a member application, operations-admin due diligence with mandatory reasons and audit events, notifications, gated publishing, a filterable first-party job board, profile-only applications, recruiter applicant timelines, application messaging, and pause/reactivate/permanent-close lifecycle controls. Organization seats, richer pipeline stages, verification-document handling, and product validation remain.

## Immediate execution order

1. Close Phase 1 independent work: golden fixtures, layout signals, hostile upload/JD tests, explicit CI security gates, and authenticated E2E coverage.
2. Complete Phase 2: richer timeline, unread/read state, public-link rotation, portrait share image, and share actions.
3. Build Phase 3 on the central entitlement and immutable ledger foundation; keep Razorpay in test mode.
4. Build Phase 4 connectors and intelligence using only approved data sources.
5. Build Phase 5 network/feed/mentor workflows and moderation.
6. Execute Phase 6 hardening while collecting the few necessary founder/legal/accounting/service approvals.
7. Deploy production only when every `P6` launch gate is proven.

## Founder actions currently required

These actions gate specific integrations but do not block independent engineering:

1. Complete a real-account Google signup/login and existing-password-account linking acceptance test on the live domain; provider and browser chooser are already enabled.
2. Supply Razorpay **test** credentials when the Phase 3 payment harness is ready; live credentials are not needed yet.
3. Choose/approve an email service or Hostinger SMTP credentials when transactional email testing begins.
4. Approve AI-provider privacy/data terms before any provider receives real user career data.
5. Arrange legal/privacy and accounting review before Phase 6 sign-off.
6. Add exact Hostinger DNS/email records supplied by the deployment runbook at the production-domain checkpoint.
