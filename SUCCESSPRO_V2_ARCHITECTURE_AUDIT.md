# SUCCESSPRO v2 — ARCHITECTURE AUDIT REPORT
**Generated:** 2026-11-14  
**Project Path:** `D:\successpro-app-vscode`  
**Authoritative Specification:** SuccessPro v2 Workbook (20 Scored Parameters: C01–C09, V01–V06, J01–J05)  
**Status:** Phase 1 Complete — Strict Inspection Only (No Code Modifications)

---

## 1. Executive Summary

SuccessPro is an AI-powered resume intelligence platform designed to evaluate resumes across content quality, visual layout presentation, and job description match. This architecture audit examines the complete repository to evaluate readiness for the **SuccessPro v2** specification.

The SuccessPro v2 model transitions the application to **ONE cumulative score out of 100**, strictly derived from:
- **With Job Description:** Content (50 max) + Visual Presentation (25 max) + Job Match (25 max) = **100 max**.
- **Without Job Description:** Content (65 max, $1.3\times$ base weight) + Visual Presentation (35 max, $1.4\times$ base weight) = **100 max**.
- **Unified Parameter Framework:** 20 granular scored parameters (9 Content: C01–C09, 6 Visual: V01–V06, 5 Job Match: J01–J05).
- **Exact Redistribution & Gates:** Intra-pillar N/A redistribution only; unresolved/missing rendered document marks visual parameters as `Pending` without artificial score deductions or zero penalties.
- **Strict Free/Paid Parity:** Identical scoring engine, weights, ratings, and detected issues across tiers; Paid tier provides root-cause diagnosis, recruiter impact, factual rewrite templates, and prioritized action plans (P0–P3, S/M/L effort).

---

## 2. Component-by-Component System Inventory

### 2.1 Frontend Architecture & Pages
- **Framework:** Next.js 16.3.5 (Turbopack, App Router, React 19).
- **Key Routes:**
  - `/review` (`apps/web/src/app/review/page.tsx`): Main resume review & upload page.
  - `/dashboard` (`apps/web/src/app/dashboard/page.tsx`): Candidate dashboard & analysis history.
  - `/pricing` & `/billing`: Tier management (Free, Pro, Enterprise).
  - `/documents`, `/jobs`, `/linkedin`: Complementary career modules.
- **Primary Review Component:** `apps/web/src/components/resume-review.tsx`:
  - Renders the 3-pillar breakdown (Content Quality, Visual Quality, Job Match).
  - Displays score sources (`Gemini 2.5 Flash`, `OpenCV + Gemini Vision`, `Keyword-Based Fallback`).
  - Displays dynamic normalization badge when Job Description is omitted.
  - Renders priority improvements, factors breakdown, and export functionality.

### 2.2 Backend APIs & Processing Routes
- **`/api/reviews` (`apps/web/src/app/api/reviews/route.ts`):**
  - Manages review generation, idempotency, monthly credit allowances, and persistence.
  - Invokes `scoreResumeText` for deterministic baseline scoring.
  - Invokes Gemini AI task `analyzeResume` via orchestrator.
  - Reconciles AI criteria ratings with deterministic factors.
  - Saves completed analysis to Firestore (`analyses` collection).
  - Handles credit transactions and allowances.
- **`/api/resumes/extract` (`apps/web/src/app/api/resumes/extract/route.ts`):**
  - Handles file upload and dispatches asynchronous extraction jobs via `apps/web/src/lib/resume-native/handler.ts`.
  - Connects to Garnet Redis queue and polls for completion.

### 2.3 Extraction Pipeline (PDF, DOCX & OCR)
- **Service:** Python Resume Worker (`processing/resume_worker/`).
- **PDF Extraction:** PyMuPDF (`fitz`) in `processing/resume_worker/extraction.py`:
  - Fast text block extraction, column detection, table bounding box recognition.
  - Page count and font metadata extraction.
- **DOCX Extraction:** Headless LibreOffice conversion (`processing/resume_worker/extraction.py`):
  - Converts `.docx` to `.pdf` via headless soffice.
  - Extracts text and renders raster page images for visual analysis.
- **OCR Engine:** Tesseract OCR via `pytesseract`:
  - Triggers automatically when extracted text density is below threshold (<80 characters or scanned image-only PDF).

### 2.4 Visual Analysis Engine (OpenCV + Gemini Multimodal Vision)
- **OpenCV Engine (`processing/resume_worker/visual.py`):**
  - Renders PDF pages to raster images (150 DPI).
  - Analyzes whitespace ratio, margin variance, horizontal/vertical projection profiles.
  - Detects multi-column splits, crowded lines, text density, and contrast anomalies.
  - Produces physical geometric score (0–100) and design flags (`crowded_layout`, `table_heavy`, `low_colour_contrast`, etc.).
- **Gemini Vision Engine (`processing/resume_worker/ai.py`):**
  - Function: `evaluate_visual_design_gemini(pdf_path, max_pages=3)`.
  - Inspects page images sequentially with structured JSON output.
  - Evaluates 6 criteria: `visual_hierarchy`, `whitespace_margins`, `typography`, `alignment_reading_order`, `cross_page_consistency`, `scannability`.
  - Attaches per-page observations and warnings.
- **Score Fusion (`packages/domain/src/resume-scoring.ts`):**
  - Integrates OpenCV physical layout metrics with Gemini Vision qualitative assessment.
  - Enforces physical safety ceiling if OpenCV detects critical layout defects.

### 2.5 Job Description Analysis & Matching
- **Implementation:** `packages/domain/src/job-match.ts`:
  - Extracts core keywords and terms with stop-word filtering.
  - Identifies required vs. fallback qualifications.
  - Detects transferable skills across semantic groups (analytics, leadership, product, SQL, stakeholder management).
  - Evaluates matching ratio and transferable skill bonus (score 0–100).
  - Sets reliability indicator (`high`, `medium`, `low`) based on JD length.

### 2.6 LLM Evaluation & AI Task Orchestration
- **Orchestrator:** `apps/web/src/lib/ai/orchestrator.ts`:
  - Dispatches tasks to Google Gemini (configured with `gemini-2.5-flash` or fallback providers).
  - Manages prompt versioning, timeout handling (25s–60s), and token caps.
  - Enforces prompt-injection isolation: untrusted inputs wrapped inside `<DATA>...</DATA>`.
- **Task Registry:** `apps/web/src/lib/ai/task-registry.ts`:
  - Task `analyzeResume`: Evaluates content quality and job match using anchored 0–5 rubric.
  - Enforces mandatory unedited source excerpt quotes for all deductions.
  - Task `deterministicAiFallback`: Provides transparent rule-based fallback when AI is unavailable.

### 2.7 Database Models & Storage Layer
- **NoSQL / Firestore (`adminDb`):**
  - `analyses`: Stores final review objects, input parameters, criteria findings, overall and pillar scores, timestamps, and metadata.
  - `allowances`: Tracks user monthly review allowances (`completed`, `limit`, `planId`).
  - `ledgers`: Records credit deductions and usage history.
  - `profiles`: Stores candidate account settings and preferred language.
- **Relational / MySQL (`resume_processing_jobs`):**
  - Located in `processing/schema.sql`.
  - Managed by `processing/resume_worker/database.py` via `mysql-connector-python` connection pool.
  - Tracks background jobs: `id`, `file_path`, `status`, `extracted_result`, `ai_result`, `attempt_count`, `lease_owner`, `heartbeat_at`.

### 2.8 Queue & Service Infrastructure
- **Redis / Garnet:** Microsoft Garnet running on port 6380 with `--lua`. Serves as Redis-compatible job queue (`resume_queue`).
- **Python Worker Daemon:** `processing/run_worker.py` runs as persistent process leasing jobs from MySQL/Garnet.
- **Database Server:** MySQL 8.4 on port 3307 using `processing/mysql-local.ini`.

---

## 3. Existing Scoring Implementations & Architecture Findings

### 3.1 Scoring Files Inventory
Scores are currently calculated or referenced in:
1. `packages/domain/src/resume-scoring.ts` (`scoreResumeText`, `calculateOverallScore`) — **Primary Domain Engine**
2. `packages/domain/src/scoring-config.ts` (weights and factor boundaries)
3. `packages/domain/src/job-match.ts` (`analyzeJobMatch`)
4. `apps/web/src/app/api/reviews/route.ts` (`applyValidatedAiRatings`, `categoryScore`)
5. `apps/web/src/components/resume-review.tsx` (frontend display)
6. `packages/domain/src/ats-benchmarks/benchmark-engine.ts` (ATS adapter benchmarks)
7. `packages/domain/src/validation-framework/dataset.ts` & `runner.ts` (benchmarks & validation)

### 3.2 Findings & Discrepancies vs. SuccessPro v2 Workbook

| Area | Current Implementation | SuccessPro v2 Workbook Specification | Required Action |
|---|---|---|---|
| **Pillar Structure** | 50% Content / 25% Visual / 25% Job Match (With JD) | Exactly matches: 50 Content, 25 Visual, 25 Job Match | **Preserve & Align** |
| **No-JD Mode** | Dynamic normalization: 66.67% Content / 33.33% Visual | Exact No-JD weights: Content 65 ($1.3\times$), Visual 35 ($1.4\times$) | **Calibrate to exact 65/35 weights** |
| **Parameter Granularity** | Factor-based (headings, experience, skills, dates, contact, formatting) | Exactly 20 scored parameters: C01–C09 (9), V01–V06 (6), J01–J05 (5) | **Implement v2 Parameter Registry** |
| **Rating Scale** | 0–100 percentage points across factors | Integer 0 to 5 rubric with observable anchors (0, 1, 2, 3, 4, 5) | **Standardize on 0–5 scale** |
| **N/A Redistribution** | Partial factor exclusion | Intra-pillar redistribution only: $\text{EffMax} = \text{PillarTotal} \times \frac{\text{BaseWeight}}{\sum \text{ActiveBaseWeights}}$ | **Implement exact intra-pillar redistribution** |
| **Pending State** | Visual defaults to "Not evaluated" when image missing | Explicit `Pending` state for V01–V06 when no rendered doc; cumulative score marked `Pending` | **Implement v2 Pending State Manager** |
| **Free vs. Paid** | Generic view with full issues; no structured P0–P3 / S/M/L plan | Identical scoring/ratings; Paid adds root-cause, recruiter impact, templates, P0–P3, S/M/L | **Implement structured Paid detail generation** |

---

## 4. Root Causes of Historical ATS Scoring Inaccuracies

1. **Over-crediting Readable Files (Parseability Bias):**
   - In older iterations, readable text was awarded 12/12 parseability points even if the resume was an empty placeholder or lacked basic contact information.
   - Resumes with minimal text (e.g. 5 words) earned language baseline points, yielding ~45–51/100 for virtually blank documents.
   - *Fix status:* Resolved in Phase 3 by grounding ATS compatibility in verified contact channels, section completeness, and valid date formats.

2. **Decoupled Visual Quality on Text-Only Inputs:**
   - Text pasted directly into the reviewer previously received arbitrary default formatting scores or was flagged as 0.
   - *Workbook requirement:* When no rendered document is available, V01–V06 must be marked `Pending` and the cumulative score held as `Pending` (showing confirmed earned points and possible range), never artificially penalized or renormalized to 100% content.

3. **Keyword Density vs. Demonstrated Competency:**
   - Simple keyword counts rewarded keyword stuffing without verifying contextual evidence or ownership in experience bullets.
   - *Workbook requirement:* C04 and J02 explicitly mandate that keyword presence alone does not prove competency; contextual application is required.

---

## 5. Free and Paid Parity Audit

- **Current State:**
  - Both Free and Paid users currently see the same base score calculated by `scoreResumeText` and `applyValidatedAiRatings`.
  - Allowance tracking strictly enforces tier quotas (`free`: 3 reviews/month; `pro`: 50 reviews/month; `enterprise`: unlimited) via Firestore `allowances`.
- **Workbook Compliance Requirements for v2:**
  - The scoring engine must be 100% identical between Free and Paid.
  - Free reports must show all detected issues, severity, and mandatory qualification gaps without hiding negative findings.
  - Paid reports must retain identical scores and add:
    - Root-cause analysis & recruiter impact.
    - Factual rewrite suggestions using unedited source facts and bracketed placeholders (`[actual task]`, `[method]`).
    - Prioritized action plan: P0 (Blockers), P1 (Major Fit/Substance), P2 (Clarity/Structure), P3 (Minor Polish).
    - Effort estimations: S (<15 min), M (15–60 min), L (>60 min / capability development).

---

## 6. Test Suite Execution & Current Status

| Test Suite | File | Tests | Result | Notes |
|---|---|---|---|---|
| **Resume Scoring** | `apps/web/src/lib/resume-scoring.test.ts` | 33 | **33 PASSED** | Factor scoring, dynamic normalization, ceiling caps |
| **ATS Benchmarks** | `apps/web/src/lib/ats-benchmarks.test.ts` | 3 | **3 PASSED** | Greenhouse, Lever, Workday simulated benchmarks |
| **Validation Framework** | `apps/web/src/lib/validation-framework.test.ts` | 4 | **4 PASSED** | Precision, Recall, F1 (>0.85), Spearman rank (>0.70) |
| **Reviews API Route** | `apps/web/src/app/api/reviews/route.test.ts` | 8 | **8 PASSED** | Auth, allowances, 503 error handling, persistence |
| **Total Web Suite** | `apps/web` | 48 | **48 PASSED** | **100% Pass Rate** |

---

## 7. Recommended Integration Strategy for SuccessPro v2

To fulfill the requirements of SuccessPro v2 without breaking existing functionality:
1. **Domain Engine Location:** Create `packages/domain/src/successpro-v2/`:
   - `types.ts`: Strict TypeScript interfaces for 20 parameters, states (`Assessed`, `N/A`, `Pending`), and report tiers.
   - `parameter-registry.ts`: Authoritative registry of C01–C09, V01–V06, J01–J05 with base weights (With JD: 50/25/25; No JD: 65/35/0).
   - `scoring-engine.ts`: Core formula implementation: $\text{Earned} = \text{EffMax} \times (\text{Rating} / 5)$ with intra-pillar N/A redistribution.
   - `rating-rubric.ts`: Observable anchors for ratings 0, 1, 2, 3, 4, 5.
   - `career-adaptation.ts`: 15 career context adaptations (Freshers, Executives, Career Breaks, etc.).
   - `paid-enhancer.ts`: P0–P3 prioritization, S/M/L effort, recruiter impact, and factual rewrite templates.
2. **API & Route Compatibility:**
   - Maintain dual-version compatibility in `apps/web/src/app/api/reviews/route.ts` via `rubricVersion: "successpro-v2"`.
   - Legacy reviews retain their stored scores; new reviews generate SuccessPro v2 results.
3. **Database & UI:**
   - Seamlessly persist v2 parameter results in Firestore `analyses` collection without altering historical records.
   - Upgrade `apps/web/src/components/resume-review.tsx` to render the 20-parameter breakdown and Paid tier action plan.

---

## 8. Audit Sign-Off & Verification

- **Total Relevant Source Files Inspected:** 42 files across `packages/domain`, `packages/contracts`, `apps/web`, and `processing/resume_worker`.
- **Environment Status:** Next.js (port 3000), Garnet (port 6380), MySQL (port 3307), and Python worker are running and healthy.
- **Phase 1 Restriction Compliance:** Zero application code, database schema, or API files were modified during Phase 1.
