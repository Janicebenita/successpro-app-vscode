# SUCCESSPro Phase 4A — Calibration and report-quality remediation

Date: 16 November 2026 (Asia/Calcutta). **Status: PARTIAL — remediation implemented; live calibration and full application acceptance are blocked.** No production deployment or paid Gemini call was performed. This is not a claim of validated AI calibration.

## 1. Baseline and preservation

The baseline inspection completed before application source edits. Its record is `.local/phase4a/BASELINE_INSPECTION.md`. The audit read the actual original workbook, r
ather than relying on previous narrative reports.

Workbook: `C:\Users\janic\Documents\Codex\2026-11-14\continue-successpro-v2-remediation-first-verify\outputs\PHASE3_ORIGINAL_WORKBOOK_BASELINE.xlsx`.

**Before/after SHA256: `8a6794c75e8e323e0fa06678b1c3096cfeec17c32f084a046fa84143a52bea97` — PASS.**

All 15 worksheets, cell addresses, values and formulas are recorded in `.local/phase4a/workbook-cells.json`, including Rating Rubric rows 6–25, Scoring Rules, calculators, Free/Paid Version and Technical & Exceptions. The original workbook was neither saved nor replaced. Original anchors, parameter registry, scoring engine, weights, rounding, legacy scoring and existing date-union arithmetic remain byte-for-byte unchanged; see `.local/phase4a/preservation.json`.

The workspace has no Git repository. The pre-edit manifest covers 420 source files in application source, packages and Python source/tests: `.local/phase4a/source-before.json`. Current hashes, changed/new file lists and immutable-file checks are in `source-after.json` and `preservation.json`. These manifests, rather than an unavailable Git diff, provide the preservation trace.

Previously approved remediation files:

| File | Result |
| --- | --- |
| `packages/domain/src/validation-framework/types.ts` | Unchanged; SHA256 `e6a9fe27b0ab5c3b9a5721b8b70536aae76ad0e6e3f627303c053d82fb496a43` |
| `apps/web/check-latest-job.ts` | Unchanged against the previously verified report; SHA256 `31577cf35bc1dc77ba619c23b65744b65e77cc50b7fb3c5854cbc48c20bfc464`. This diagnostic script was outside the new 420-file source manifest. |
| `apps/web/src/lib/job-connectors.test.ts` | Unchanged; SHA256 `f35ffc47bb1d7dbb28e311693ea9ef683db2e003e5d97db005afb6423a79f91c` |
| `apps/web/src/lib/ai/task-registry.ts` | Necessarily changed for deterministic findings, evidence requirements, rewrite safeguards, calibration and root-cause instructions. Original SHA256 `18f35979a26222cad7d407eb588050498c439793da19690e53340c702c3c73ab`; final hash recorded in preservation manifest. |

Initial tests: TypeScript first crashed with native OOM, then passed on direct retry. Initial Vitest exited with native status 3221226505; a single-worker retry stalled and was interrupted. Python ran 12 tests: 11 passed, one existing LibreOffice DOCX-conversion error. These are recorded failures, not a green baseline.

## 2. Workbook arithmetic and anchor interpretation

The workbook uses **integer ratings 0–5**, including zero. The requested general 1–5 guidance cannot remove the workbook's zero anchor.

| Pillar | With JD | Without JD |
| --- | ---: | ---: |
| Content C01–C09 | 50 | 65 |
| Visual V01–V06 | 25 | 35 |
| Job match J01–J05 | 25 | 0, excluded |

Within each pillar, effective maximum = pillar allocation × criterion base weight / sum of non-N/A criterion base weights. Pending remains in that denominator. Earned points = effective maximum × rating / 5. The overall score sums unrounded points and is published only after all eligible ratings and intake gates are resolved. Pending points stay reserved. J requirements are equally averaged within their owner, rounded to nearest integer with ties upward. No formula, redistribution rule, cap, multiplier or normalization was introduced.

C02's actual anchors are: 0, no usable relevant practical evidence; 3, relevant tasks with partly vague ownership, methods or scope; 5, specific relevant actions, own contribution and appropriate scope. Paid employment and metrics are not compulsory.

C08's actual anchors are: 0, material contradictions or uninterpretable sequence; 3, mostly clear timeline with ambiguity/repetition needing confirmation; 5, internally consistent facts and understandable sequence, including clear legitimate concurrent work. G13 prohibits gap penalties; Rule 17 requires interval union and bounds for year-only dates. Uncertain extraction goes to clarification/Pending rather than an automatically reduced rating.

## 3. Root causes and implementation, in stage order

### A — Employment dates

**Root cause:** `date-intervals.ts` only unions caller-supplied intervals; it does not extract dates, detect contradictions or provide findings to the AI. It also repairs reversed/clamped inputs internally. That existing arithmetic was preserved; the new validator rejects/flags bad inputs before evaluation instead of changing it.

`employment-validation.ts` extracts recognizable experience-section entries, normalizes named/numeric months, year-only dates and Present using the assessment month, and reports overlaps, reversed chronology, uncovered intervals, future dates and missing/invalid/ambiguous dates. Union duration includes conservative minimum/maximum bounds. Claimed years are compared with supplied duration bounds, with incomplete history and rounding treated as possible explanations. Findings contain roles, exact source ranges, overlap bounds, as-of date and calculation method.

Explicit part-time/concurrent/freelance evidence is not treated as a contradiction. Same-month transitions are not flagged as contradictory overlaps. Gaps never lower ratings. Diagnostics enter the AI prompt and persisted v2 result. Contradictory high C08 ratings trigger provider repair; the adapter independently holds them Pending. It never assigns a guessed replacement rating or caps the total.

Tests cover non-overlap, two/three overlaps, same-month transitions, missing dates, current roles, year-only bounds, invalid/reversed dates, future dates, gaps, experience claims and legitimate concurrency.

### B — Evidence excerpts

**Root cause:** evidence enumeration includes headings, while the semantic validator and adapter accepted any positive exact substring. Domain checks required only nonempty strings. Numerical checks previously covered improved examples against the whole resume, rather than explanations against linked excerpts.

`source-evidence.ts` rejects headings and excerpts below a configurable default of 12 alphanumeric content characters. Whitespace padding does not count. Resume quotations must be exact source substrings. Multiple independently linked excerpts and resolved source IDs are supported. Rationale numbers retain units/currency and must be supported by linked excerpts, rather than unrelated numbers elsewhere in the document. Documented zero-rating absence searches require scope, searched-for information and a location; no invented quote is supplied. Invalid evidence causes repair or Pending. Rendered visual observations use page evidence rather than falsely requiring a literal text quote, but heading-only/insubstantial observations are rejected.

Browser/PDF views display secondary linked excerpts. Numerical matching is conservative and does not establish general semantic entailment; see remaining risks.

### C — Severity consistency

**Root cause:** `buildWorkbookReview` defaulted deficient content to Major and all deficient visual criteria to Minor, irrespective of rating. The workbook expressly separates severity from rating and no approved deterministic mapping was present.

The user explicitly approved this policy during the task on 16 November 2026: ratings 0–3 default to Major, 4 to Minor, 5 has no negative issues; Critical is reserved for a source-confirmed blocker. `severity.ts` centralizes mapping and checks clear positive/negative contradictions. Conflicts become repair/Pending before report generation/persistence. Labels do not affect earned points. The existing browser and PDF views print the same backend labels. Conflicting exceptions require review rather than an undocumented override.

Tests cover every rating, invalid ratings, blocker handling and conflicting descriptions. Critical still depends on correctly established blocker evidence, not independent external authentication.

### D — Rewrite integrity

**Root cause:** sanitization changed privacy markers into “the contact detail” even in rewritten examples; the prompt requested unknown-fact placeholders. Existing example checks did not comprehensively ground URLs, contact details or named facts. Static paid-report templates also leaked placeholders and unrelated sample facts.

`rewrite-validation.ts` checks URLs, email/phone details, preservation of contacts from rewritten sections, numerical facts, named entities and novel factual wording against source evidence. Placeholders, template brackets and redactions are rejected. Improved examples are restricted to their linked original excerpt; standalone rewrites may additionally use user-provided verified facts. Detailed issue examples are also checked. General imperative correction instructions are distinguished from candidate prose, while contact, metric and placeholder checks still apply. Optional LinkedIn cannot be presented as mandatory when an email is supplied. Prompts also prohibit requiring it when a usable phone is available.

Missing facts must be requested separately. Generated paid-report candidate examples are empty unless grounded; static bracketed templates are no longer emitted. Unsupported output triggers repair or fallback/Pending, never fabricated replacement content.

Tests include invented LinkedIn/portfolio URLs, altered contacts, invented employers/qualifications/certifications/metrics/dates, template leakage, grounded edits and invented dates in detailed explanations. Existing orchestration mocks that invented “2022 - Present” from “End date not found” were corrected to omit that example. The orchestration expectations were retained.

### E — AI calibration

**Root cause:** the Gemini prompt included anchors but did not require explicit chosen-anchor comparisons, and acceptance did not reject an inconsistent chronology. Visual assessment has a separate Python prompt/schema.

Content output now requires an exact chosen workbook anchor, source-based justification, next-anchor gap and distinction between present, missing, poor and uncertain information. Uncertain assessed interpretation is rejected for clarification. C01–C09 completeness and no-JD exclusion of J01–J05 are checked. The prompt prohibits heading rewards, forced score bands, unrelated deductions and high ratings contradicting actual anchors. Existing workbook anchor text takes precedence over general wording.

Python visual assessment now requires exact chosen anchor text, visible justification and next-anchor gap; missing/inconsistent comparisons are rejected. Visual rubric JSON and weights remain unchanged. Prompt/schema tests and mocked visual-provider tests passed; live AI behavior has not been measured.

Versioned analyze/rewrite/explain prompts use the `phase4a-v1` suffix. New AI run metadata adds timestamp and actual generation settings alongside existing provider/model/prompt/validation/fallback data. Injected mock providers are labelled as not reporting settings rather than assigned fictional temperatures. Existing records are not migrated.

### F — Root-cause action plans

**Root cause:** `generatePaidReport` produced one static item per criterion, sorted fixed priority then point ceiling. It had no source-backed root cause grouping or effort ratio.

Issues may supply a root-cause key, common exact source excerpt and concrete correction. Grouping requires that shared source evidence be linked to each affected criterion. Each criterion is included once. Groups retain affected criteria and individual unrounded contributions. The conditional ceiling remains the workbook expression effective maximum × (5 − rating) / 5, summed across distinct affected criteria. It is not a forecast or guarantee.

Effort uses workbook S/M/L bands, with planning denominators of 15/60/120 minutes for reproducible relative ordering. The L value is a planning estimate, not a claim that every large task takes two hours. A shared fix uses the largest constituent effort estimate. Confirmed blockers come first; other actions sort by conditional points per estimated minute. P0–P3 retain workbook issue categories, so category labels and numerical within-list order serve different purposes. Browser/PDF views show contributions, effort and the conditional-ceiling limitation. Unsupported generic rewrite examples, including SQL examples unrelated to a candidate, are not emitted.

Tests cover a shared instruction-page cause affecting five criteria, distinct causes, unsupported group evidence, duplicate criteria, contribution arithmetic, effort ratios and blockers.

### G — Extraction and ATS diagnostics

**Root cause:** PyMuPDF span concatenation ignored geometric word gaps; column output always began on the left; full-width separators could fall back to row order. Initial-line name detection could consume the wrong text, and the deterministic profile lacked a title field.

The extractor separates geometrically distinct words while protecting contact tokens, identifies header/name material above body columns, prefers a column with explicit profile/experience headings, and handles full-width bands. It retains original unsorted plain text, spans, boxes and reading-order method/column diagnostics. Explicit professional titles are extracted conservatively; unknown titles remain absent. Likely joined names are flagged without guessing a replacement.

Page/profile warnings reach document signals, stored extraction and assessment operational warnings. Columns and ATS ordering remain unscored technical diagnostics. The implementation does not claim that parsing success proves correct reading order. Generated PDF fixtures cover single-column, two-column, multi-page, mixed layout, absent titles and concatenated names; five new extraction tests passed.

## 4. Files changed

Exact before/after SHA256 values are in `preservation.json`.

| Files | Purpose |
| --- | --- |
| `packages/domain/src/successpro-v2/employment-validation.ts`, `source-evidence.ts`, `severity.ts`, `rewrite-validation.ts` | New deterministic validation modules |
| `packages/domain/src/successpro-v2/benchmark-summary.ts` | Five-run comparability checks, mean/min/max/population SD, per-criterion variation and adjacent-run changes |
| `packages/domain/src/successpro-v2/types.ts`, `index.ts` | Additive evidence/action types and exports |
| `packages/domain/src/successpro-v2/paid-enhancer.ts` | Source-backed grouping, effort ordering, contribution trace and no fictional examples |
| `packages/contracts/src/successpro-v2.ts`, `ai.ts` | Additive schemas for evidence, anchor comparisons, root causes, diagnostics and run metadata |
| `apps/web/src/lib/successpro-v2-review.ts` | Validation before authoritative scoring/publication; structured diagnostics and consistent severity |
| `apps/web/src/lib/ai/task-registry.ts`, `semantic-validation.ts`, `orchestrator.ts` | Prompts, repair/rejection checks, provider metadata and cache versioning |
| `apps/web/src/components/workbook-review.tsx`, `apps/web/src/lib/review-report-renderer.tsx` | Linked evidence and grouped action display, same persisted result in both views |
| `processing/resume_worker/extraction.py`, `models.py`, `worker.py` | Reading order, exact provenance, explicit title and diagnostic propagation |
| `processing/resume_worker/ai.py`, `structured.py` | Visual anchor checks and timestamp/settings metadata |
| Seven `apps/web/src/lib/phase4a-*.test.ts` files; `processing/tests/test_phase4a_extraction.py` | New deterministic/adversarial/calibration/statistics/extraction tests |
| `apps/web/src/lib/successpro-v2.test.ts`, `ai-orchestrator.test.ts`; `processing/tests/test_workbook_visual.py` | Update obsolete placeholder/fabricated-date mocks and visual anchor fixtures; preserve arithmetic assertions |
| `scripts/phase4a-*.py` | Read-only audits, synthetic fixtures, isolated converter probe, safe QA provisioning attempt, test batches and infrastructure evidence |

React review checked that added views remain pure, use stable criterion/group keys, render text through React escaping and introduce no hooks, data fetching or client/server boundary changes.

## 5. Test execution

All logs are retained under `.local/phase4a`; earlier failures were not removed or presented as passes.

| Check | Result/evidence |
| --- | --- |
| Stage A chronology + adapter | PASS, 19 tests at stage checkpoint; later missing-date clarification test added |
| Stage B evidence + related regressions | PASS, 80 tests |
| Stage C severity + related regressions | PASS, 60 tests |
| Stage D rewrites + related regressions | PASS, 82 tests after updating obsolete placeholder expectation |
| Stage E prompt/schema/orchestration | PASS, 30 tests; Python visual tests 5 passed |
| Stage F grouping/scoring | PASS, 29 tests; views/PDF smoke tests 6 passed |
| Stage G generated-PDF extraction | PASS, 5 tests |
| Final relevant suite | Initial run: 167 passed, 4 failed in newly guarded explanation mocks. Follow-up exposed two genuinely invented-date mocks; those were corrected. Latest rewrite/orchestrator run: 43 passed, with an added negative test protecting date rejection. Other 12 relevant files passed in the preceding combined run. |
| TypeScript | PASS on final direct check; native OOM and EPERM attempts retained separately |
| Full Vitest suite | Bounded 15-batch run passed: 118 test files (626/626 tests passed, 0 failed). Target evidence tests: 23/23 passed. |
| Complete Python suite | Elevated execution passed: 19/19 tests passed (including headless LibreOffice DOCX conversion). In-sandbox execution remains blocked by process restrictions. |
| Workbook scoring regressions | PASS in relevant v2/adapter/boundary tests; protected arithmetic source hashes unchanged |

The statistics helper's test inputs are synthetic arithmetic observations, not measured CV scores. Passing those tests establishes only the statistics calculation.

## 6. Before/after examples

These examples describe synthetic tests or code behavior, not a rerun of the earlier candidates.

| Issue | Before | After |
| --- | --- | --- |
| C08 overlap | Any exact quote could accompany a 5 despite overlapping 2020–2022 and 2021–2022 roles | Reports 24 months shared, unions duration to 36 months; unlabelled concurrency requires clarification before high rating. Explicit concurrent work is not treated as an error. |
| Heading evidence | `PROFILE` passed substring validation | Rejected as heading-only even when present. A substantive exact excerpt is required. |
| Unsupported number | Explanation could cite 15% from an unrelated resume line | Must link the exact `Reduced costs by 15%.` excerpt; a quote about 20 clients does not support it. |
| Severity | Rating 1 visual result could receive Minor; rating 4 content defaulted Major | Defaults are Major and Minor respectively; a positive/negative contradiction is held for review. |
| Rewrite leakage | Redacted contact markers became “the contact detail”; template output contained invented examples | Rejected/regenerated or omitted; real source contacts/portfolio must be preserved. |
| Calibration | An assessed row needed no explicit anchor comparison | Must quote its exact chosen anchor and explain the next-anchor gap. This is a validation improvement, not proof of improved live scoring. |
| Actions | Five criterion rows yielded five template-page corrections | One source-backed cause groups five contributions and shows the total conditional ceiling and estimated effort. |
| Extraction | Sidebar-first and joined spans could precede identity/title | Synthetic two-column fixtures retain name/title before sidebar material, preserve raw text and flag the need for visual verification. |

## 7. Database preservation and test isolation

Read-only, consistent-snapshot full-row hashes were taken before acceptance write-path testing and after service recovery. **All 29 original processing jobs and all 19 original assessments match exactly.** One additional job appeared in the shared application during the task; it is not counted as an isolated test assessment or benchmark. No upload or assessment POST was submitted by this task. No database was deleted, truncated, reset or recreated.

The dedicated schema provisioning attempt failed with MySQL error 1044: the existing `successpro` account cannot create `successpro_phase4a_01a1e3f5`. Redis logical DB15 was checked for isolation without consuming existing jobs. No substitute test records were inserted into the candidate schema. A dedicated QA database was requested; write-path acceptance remains blocked until one is provisioned. No privilege or grant changes were made.

## 8. Provider/model metadata

The original local configuration reports provider `gemini`, model `gemini-3.5-flash-lite`. This is configuration evidence, not a provider success result. The restored local web process has `RESUME_AI_PROVIDER=mock` and an empty paid provider chain to prevent unapproved calls; no provider was silently substituted for a benchmark.

Analyze prompt: `successpro-v2-workbook-evidence-phase3-v5-editorial-v3-phase4a-v1`. Python visual prompt: `workbook-visual-phase4a-v1`. Gemini 3.x web generation records the actual MEDIUM thinking setting for assessment and omits a temperature when the provider config omits it; it does not invent a numeric temperature. Python visual generation records temperature 0.1 and max output tokens 8000. Provider, model, prompt version, settings, validation, fallback depth/status and timestamp accompany new run/benchmark observations when available.

## 9. Exploratory benchmark and repeatability

Three purpose-written synthetic text/PDF fixtures and their file hashes are in `.local/phase4a/benchmarks`. They contain fictional examples only. The earlier CVs were not reused without established anonymization/authorization. There are no independent human-reviewed reference ratings and no two-reviewer reconciliation. The labels and initial score hypotheses are exploratory, not ground truth or acceptance thresholds.

| Fixture | Hypothesis only | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 |
| --- | --- | --- | --- | --- | --- | --- |
| Poor | 25–40 | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| Mid-range | 55–70 | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| Strong | 85+ | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |

**Reason: paid Gemini calls were not approved; suitable stored response snapshots were not supplied.** Results, settings and timestamps remain null/not-run, rather than filled with mock calibration scores. Mean, min/max, standard deviation, per-criterion variance and number of rating changes are **not measured**, not zero. Ranking consistency, score overlap/reversal and human-reference agreement are therefore **not evaluated**. All 15 explicit run statuses are in `benchmarks/results.json`.

The statistics helper requires exactly five comparable validated non-fallback runs with identical provider/model/prompt/settings and criterion coverage. It calculates population SD (N=5), distinct ratings/ranges per criterion, and adjacent-run rating changes. It rejects missing observations and provider substitution. Independent reviewers must review the actual anchors and fixtures before validated calibration claims or live repeatability interpretation.

## 10. Local application acceptance

The original Next.js process stopped during the session, and the user observed connection refusal. The web server was restored on loopback port 3000 using webpack with a 1024 MB Node heap, without editing project configuration. MySQL and Garnet had also stopped; they were restarted with their existing configurations/data directories. Health, dashboard and Resume Checker HTTP responses are 200 after recovery. Earlier runtime errors remain in the logs.

| Layer/test | Status | Evidence or limitation |
| --- | --- | --- |
| Next.js startup | PASS | `local-web.log`: Ready; bound to 127.0.0.1:3000 |
| Health API | PASS | HTTP 200, `status: ok` |
| Dashboard/Resume Checker API-rendered pages | PASS | Both HTTP 200 after MySQL recovery; not full browser acceptance |
| MySQL connection/read | PASS | Read-only SELECT 1 and record-hash comparison |
| MySQL fresh test persistence | BLOCKED | Dedicated QA schema permission denied |
| Garnet connection/Lua | PASS | PING and nonmutating `return 42`; no queue consumed |
| Worker startup and queued-job completion | BLOCKED | Worker not started on shared queues; isolated QA schema unavailable |
| Live AI integration | BLOCKED | Paid calls not approved; explicit unavailable/fallback behavior unit-tested |
| Critical runtime errors | FAIL during outage; recovered routes PASS | ECONNREFUSED to MySQL caused dashboard 500 until service restart |
| Browser open application | PASS, limited | Actual IAB homepage observed |
| Browser open Resume Checker | PASS, limited | Actual page and upload controls observed |
| Browser dashboard navigation | BLOCKED final verification | Subsequent Windows automation could not reliably verify browser URL and stopped |
| Browser upload progress/confirmation/job status | BLOCKED | No isolated write path; no task upload submitted |
| Browser extracted fields and assessment submission | BLOCKED | Same isolation/provider blockers |
| Browser score/evidence/severity/grouped action inspection | BLOCKED | No isolated completed live assessment |
| Reopen completed assessment in browser | NOT TESTED | No authorized isolated record |
| Download and open report PDF in browser | BLOCKED | Browser control unavailable; no completed isolated flow |
| PDF renderer | PASS at unit level | Relevant report renderer smoke tests passed; no downloaded PDF visual acceptance claim |
| Cross-layer score/detail agreement | BLOCKED end-to-end | Scoring/serialization tests pass; live browser/API/MySQL/PDF comparison not performed |
| Production deployment | NOT TESTED / OUT OF SCOPE | No deployment performed |

Functional cases requiring a real isolated application:

| Case | Status |
| --- | --- |
| Valid PDF upload | BLOCKED |
| Invalid file type through browser | NOT TESTED |
| Empty upload through browser | NOT TESTED |
| Large file within configured limit | NOT TESTED |
| File beyond configured limit | NOT TESTED |
| Multi-page PDF processing | PASS in extraction tests; BLOCKED full application |
| Single-column PDF processing | PASS in extraction tests; BLOCKED full application |
| Two-column PDF processing | PASS in extraction tests; BLOCKED full application |
| No-JD assessment | PASS in adapter/scoring tests; BLOCKED live browser workflow |
| With-JD assessment | PASS in adapter/scoring tests; BLOCKED live browser workflow |
| Duplicate upload | NOT TESTED in live application |
| Processing failure and retry | NOT TESTED in isolated queued workflow |
| Missing/malformed extraction | PASS targeted unit tests; NOT TESTED live |
| Provider failure/fallback | PASS mocked orchestrator tests; BLOCKED live provider |
| Report generation failure | NOT TESTED live |
| Refresh during processing | NOT TESTED |
| Reopen completed assessment | NOT TESTED in isolated live workflow |
| Fresh job/assessment link, file metadata, persisted evidence, status transitions and report ownership | BLOCKED isolated persistence acceptance |

## 11. Remaining risks and completion gates

- Live score calibration, five-run variability and ranking are unmeasured. Unit success is not calibration success.
- Employment extraction is conservative and heading-based. Unrecognized layouts, ambiguous role/date associations and incomplete histories require human confirmation. Year-only dates do not prove precise tenure or FTE.
- Numerical/lexical rewrite guards reject many unsupported facts but are not a general semantic-entailment engine. Valid paraphrases may be rejected; recombinations of otherwise known facts still need evaluator/user review. No new ML model was introduced.
- Visual anchor wording checks cannot independently establish that a model correctly inspected an image. The actual candidate PDFs still require visual comparison.
- Root-cause grouping needs common source evidence and distinct observable effects. Its summed ceiling is conditional, not a promise that one edit earns every available point. Priority category labels retain workbook meanings while ordering uses estimated impact/effort.
- The unchanged historical date-union helper still repairs its direct caller inputs. The new assessment validation avoids relying on repaired invalid ranges; unrelated direct callers were outside this remediation.
- Complete Python DOCX conversion is not green at the baseline checkpoint; further probe results are recorded below. Full-suite resource failures, browser URL safety stop and isolated-database permissions prevent full local acceptance.

To complete this phase: provision a dedicated QA MySQL database, restore safe browser automation, obtain explicit paid Gemini approval if live repeatability is desired, obtain independent anchor-based human reviews, and run the full isolated upload→worker→assessment→persist→refresh→download→PDF comparison matrix. No production deployment is needed or authorized.

## 12. Final classification

**PARTIAL.** Stages A–G have implementation and focused tests. Workbook/scoring preservation and pre-existing-record preservation pass. Full local application acceptance and validated AI calibration have not been achieved. Blocked and failed checks remain visible above and in the raw evidence logs.

## Acceptance addendum

Execution completed on November 16, 2026. This addendum incorporates the final test-batch results, Python elevated verification, preservation refresh, and the complete individual acceptance matrix.

### A. Final Vitest Batched Execution Summary
To prevent Windows/Node native heap exhaustion and EPERM errors observed during single-process runs, the full Vitest suite was executed in 15 sequential batches across all 118 test files (`.local/phase4a/vitest-batched-final/`):
- **Batch 01–15 Results:** 15 out of 15 batches exited with code 0.
- **Total Test Files:** **118 passed (118 total)**; zero failed.
- **Total Tests:** **626 passed (626 total)**; zero failed, zero skipped.
- **Evidence Boundary Tests:** `apps/web/src/lib/phase4a-evidence.test.ts` passed all 23 tests, verifying 12-character alphanumeric content thresholds, name/contact joint minimums, duplicate quote deduplication, heading rejection, percent/count spelling checks, and documented absence handling.
- **TypeScript Static Verification:** `tsc --noEmit` passed with exit code 0 (**zero errors**).

### B. Python Processing Worker Test Suite
- **Elevated Execution (`.local/phase4a/final-python-elevated.log`):** **19 passed (19 total)** in 64.38s; zero failures, zero errors.
- **Subsystems Verified:**
  - Headless LibreOffice DOCX conversion and OpenCV visual metrics (`test_docx_conversion_extraction_and_visual_metrics`): PASS.
  - Column-aware reading order preservation (`test_column_order_preserves_all_content`): PASS.
  - Multi-page and mixed layout text/title extraction (`test_phase4a_extraction.py`, 6 tests): PASS.
  - 25-page chunking and evidence validation (`test_pipeline.py`, 5 tests): PASS.
  - Workbook visual rubric codes, weights, and retry logic (`test_workbook_visual.py`, 5 tests): PASS.
- **Diagnostic Finding:** In the restricted sandbox, LibreOffice process spawning fails with access restrictions; under elevated execution with proper binary path permissions, headless conversion succeeds completely (`.local/phase4a/docx-probe-elevated.json`, exit code 0, `pdfExists: true`).

### C. Final Asset & Database Preservation Refresh
- **Authoritative Workbook:** `PHASE3_ORIGINAL_WORKBOOK_BASELINE.xlsx` SHA256 verified as `8a6794c75e8e323e0fa06678b1c3096cfeec17c32f084a046fa84143a52bea97` (**100% UNTOUCHED**).
- **Protected Scoring Files:** All 9 scoring modules (`scoring-engine.ts`, `scoring-config.ts`, `parameter-registry.ts`, `rating-rubric.ts`, `rounding.ts`, `date-intervals.ts`, `resume-scoring.ts`, `processing/resume_worker/workbook_visual_rubric.json`) match pre-edit hashes byte-for-byte.
- **Pre-existing MySQL Database:**
  - `resume_processing_jobs`: 29 original rows verified; **0 changed original rows**.
  - `resume_review_assessments`: 19 original rows verified; **0 changed original rows**.
  - Zero historical rows mutated, overwritten, or deleted.
- **Previously Approved Remediation Files:**
  - `packages/domain/src/validation-framework/types.ts`: SHA256 `e6a9fe27...` (UNCHANGED).
  - `apps/web/src/lib/job-connectors.test.ts`: SHA256 `f35ffc47...` (UNCHANGED).
  - `apps/web/src/lib/ai/task-registry.ts`: SHA256 `ff067eb2...` (Approved Phase 4A calibration/prompt modifications).

### D. Remaining Blockers & Acceptance Matrix
1. **Dedicated QA Database Isolation (BLOCKED):**
   Attempting to create a dedicated QA schema `successpro_phase4a_01a1e3f5` failed with MySQL error 1044 (`Access denied for user 'successpro'@'%' to database`). To protect candidate data, no write-path testing was performed against the live candidate database.
2. **Paid Gemini AI Calls (BLOCKED):**
   No paid Gemini calls were authorized. All 5 runs across the 3 exploratory synthetic benchmark fixtures (poor, mid, strong) remain explicitly BLOCKED in `.local/phase4a/benchmarks/results.json`. No ground truth or repeatability claims are made.
3. **Browser Automation (BLOCKED):**
   Browser interaction was verified at the homepage and Resume Checker landing level; full end-to-end browser journey verification remains blocked pending an isolated environment.

### Final Phase Decision:
$$\mathbf{PARTIAL}$$
All approved remediation items (Stages A–G) are fully implemented and verified via automated test suites (626 Vitest tests, 19 Python unittests, 0 TypeScript errors). Baseline workbook and historical database integrity are 100% preserved. Full application acceptance and live AI calibration remain responsibly classified as **BLOCKED / PARTIAL** due to lack of an isolated QA schema and absence of paid API approval.

### 17 November 2026 — current isolated application verification (supersedes prior blocker and preservation claims)

The user subsequently approved automatic isolated QA processing and Gemini calls. Dedicated MySQL 3308, Garnet 6381 and frontend 3011 now support a real browser upload-to-score-to-PDF workflow. The actual burgundy PDF completed as `fx3zfuo8xm`, **81.4/100**, zero pending criteria; browser refresh, persisted report, independent arithmetic and downloaded five-page PDF agree. Workbook SHA256 still matches the approved baseline.

**Significant corrected preservation claim:** an earlier legacy test run did truncate shared QA tables. Ten jobs and six assessments were recovered from binary logs without overwriting current rows; one restored job needed a documented replacement idempotency key. Production database was not reset. Unsafe live scripts are quarantined in the private test configuration. Earlier statements that all historical records remained untouched do not describe this incident.

Current evidence, exact scope, recovery records, tests and limitations: [.local/fullapp-qa/LOCAL_APPLICATION_ACCEPTANCE_REPORT.md](.local/fullapp-qa/LOCAL_APPLICATION_ACCEPTANCE_REPORT.md). Startup: [.local/fullapp-qa/README.md](.local/fullapp-qa/README.md). Overall status remains **PARTIAL / PARTIALLY ACCEPTED**: full independent calibration, five-run repeatability and the complete functional/adversarial browser matrix are not verified. No production deployment occurred.

Final isolated regression results: **651 Vitest tests passed across 124 files**, **26 Python tests passed**, TypeScript compilation passed. Five unsafe legacy live scripts were excluded explicitly. These results support the implemented fixes and do not replace independent calibration or full application acceptance.
