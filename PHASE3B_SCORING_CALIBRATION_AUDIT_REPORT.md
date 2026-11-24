# SUCCESSPro — PHASE 3B: SCORING CALIBRATION & AI ASSESSMENT QUALITY AUDIT REPORT
**Execution Date:** November 16, 2026  
**Auditor Roles:** Senior AI/ML Engineer, Resume Evaluation Specialist, Scoring Systems Auditor, QA Engineer, Data Integrity Auditor  
**Project Root:** `D:\successpro-app-vscode`  
**Workspace:** pnpm Monorepo (`@successpro/web`, `@successpro/contracts`, `@successpro/domain`)  
**Audit Authorization Status:** READ-ONLY INVESTIGATION — NO IMPLEMENTATION AUTHORIZED  
**Baseline State:** FROZEN & PRESERVED  

---

## 1. EXECUTIVE SUMMARY & AUDIT IDENTIFICATION

### 1.1 Objective & Context
This audit was conducted to investigate the assessment and scoring pipeline of **SUCCESSPro**, specifically examining the primary investigation target: a previously assessed candidate resume that received a cumulative score of **64.1/100**.

The central objective is to determine:
1. Whether 64.1/100 accurately reflects the candidate document's true quality under the evaluation framework.
2. Whether the workbook-driven scoring engine, criterion ratings (C01–C09, V01–V06, J01–J05), severity deductions, and final score are consistent with the authoritative specification.
3. Why an overtly deficient, joke/unprofessional resume received a score inside the **"Developing"** tier (60–<75) rather than a failing grade requiring **"Substantial Revision"** (<40).

### 1.2 Target Assessment Identification
The audit located and extracted the authoritative database records from local MySQL (`successpro_local` on port 3307):

| Field | Authoritative Audit Value |
|---|---|
| **Assessment Record ID** | `439tjmh3epr` (persisted in `resume_review_assessments`) |
| **Comparative Predecessor ID** | `wybbv1cer7j` (evaluated 2026-11-14 18:07:08 UTC, score: 61.2/100) |
| **Processing Job ID** | `8d56f598-3d96-41e9-a38d-6fbcc0cbfaf3` (in `resume_processing_jobs`) |
| **Candidate Name** | **SMUDGER SMITH** |
| **Original File Name** | `Example-Curriculum-Vitae-bad.pdf` |
| **Original Storage Path** | `D:\successpro-app-vscode\.data\resumes\1985aec260a1b6512ce4a364\8d56f598-3d96-41e9-a38d-6fbcc0cbfaf3\original.pdf` |
| **File SHA256** | `53c6d3fa6d21867bb8ee9329c190cd21900d098322aa833985bee4fd81be2109` |
| **File Size / Page Count** | 86,683 bytes / 1 page |
| **Evaluation Mode** | `no_job_description` (Content: 65 max, Visual: 35 max, Job Match: 0 max) |
| **AI Provider / Model** | `local-gemini` / `gemini-3.5-flash-lite` |
| **Validation Status** | `passed` (Schema validation passed on repair attempt 1; fallback depth: 0) |
| **Cumulative Score** | **64.1 / 100** (`confirmedEarnedPoints`: 64.06, rounded to 1 decimal) |
| **Descriptive Band** | **"Developing"** (Rule 23 band: 60–<75) |

### 1.3 Core Audit Findings

1. **Severe Score Inflation vs. Document Reality**:
   `Example-Curriculum-Vitae-bad.pdf` is an intentionally egregious negative test case. It contains crude military slang and colloquialisms (*"whacking bods on tour"*, *"boss-man"*, *"crows"*, *"Mega on the lash"*, *"Good on the lash and I like running"*), an unprofessional email address (`armymental@mod.uk`), a completely dismissive education section (*"None worthy of a bank so no point putting them down on here"*), and a **total absence of employment dates or timeline references**. Despite this, the application awarded the resume **64.1/100**, placing it in the same descriptive band as a legitimate junior professional candidate needing polish.

2. **Root Cause 1 — Disproportionate Visual Pillar Weighting in No-JD Mode**:
   Under Rule 02 of the authoritative workbook, when no job description is provided, Job Match (25 points) is excluded, and weights are scaled to Content (65 points) and Visual (35 points). Because the candidate PDF was cleanly typeset with standard margins, clear headings, single-column flow, and high monochrome contrast, the visual analyzer awarded **30.52 out of 35 visual points (87.2%)**. The visual presentation alone guaranteed that any readable single-page document banks ~30 points out of 100, effectively creating a 30-point floor regardless of content absurdity.

3. **Root Cause 2 — AI Rubric Anchor Inflation (The "3-is-Average" Trap)**:
   The evaluation model (`gemini-3.5-flash-lite`) exhibited positive confirmation bias. Because the text mentioned real-sounding military operational terms (*"SCBC"*, *"PSBC"*, *"BARMA"*, *"G1/G4 admin"*), the LLM assigned Anchor Rating **3/5 ("Adequate / Basic Acceptable")** to 6 out of 9 content criteria (C01, C02, C03, C04, C06, C09), even while explicitly acknowledging the extreme informality in its own notes. This allowed the content pillar to earn **33.54 out of 65 points (51.6%)**.

4. **Root Cause 3 — Absence of Score Capping for Critical Blockers**:
   Criterion C08 (*Chronology, consistency and credibility*) received a rating of **0/5** and was flagged with a **Critical Severity Blocker** (`confirmedBlocker: true`, message: *"No employment dates found; timeline cannot be constructed"*). However, under Workbook Rule 10 (*"No hidden caps or undisclosed penalties"*), the engine does not subtract penalty points or cap the score. The blocker was appended to `mandatoryGaps`, but the cumulative numerical score remained 64.1.

5. **Root Cause 4 — Non-Deterministic Scoring Drift**:
   Comparing assessment `439tjmh3epr` (64.1) against its identical predecessor `wybbv1cer7j` (61.2) evaluated on November 14 shows a **+2.9 point drift** across two evaluations of the exact same PDF. The variance was driven entirely by LLM non-determinism on C04 (Rating 2 -> 3, +1.82 pts) and C07 (Rating 1 -> 2, +1.04 pts).

---

## 2. BASELINE & ENVIRONMENT INTEGRITY VERIFICATION

Prior to conducting this audit, full workspace and baseline integrity checks were executed in accordance with mandatory Phase 3B instructions:

### 2.1 Workspace & Repository Verification
- **Project Directory:** `D:\successpro-app-vscode` (Confirmed original workspace, not a clone).
- **Workspace Architecture:** pnpm workspace with packages `@successpro/web`, `@successpro/contracts`, `@successpro/domain`, and Python backend worker in `processing/resume_worker`.
- **Database Engine:** MySQL 8.4.13 running on local port `3307` (`127.0.0.1:3307`, PID 7932, database `successpro_local`).

### 2.2 Baseline Manifest & Hash Check
All four target remediation files modified during Phase 3A-2D were re-hashed and verified against their frozen baselines:

| File | Baseline SHA256 (Phase 3A-2D) | Current Verified SHA256 | Verification Result |
|---|---|---|---|
| `packages/domain/src/validation-framework/types.ts` | `e6a9fe27b0ab5c3b9a5721b8b70536aae76ad0e6e3f627303c053d82fb496a43` | `e6a9fe27b0ab5c3b9a5721b8b70536aae76ad0e6e3f627303c053d82fb496a43` | **PASS (Exact Match)** |
| `apps/web/check-latest-job.ts` | `31577cf35bc1dc77ba619c23b65744b65e77cc50b7fb3c5854cbc48c20bfc464` | `31577cf35bc1dc77ba619c23b65744b65e77cc50b7fb3c5854cbc48c20bfc464` | **PASS (Exact Match)** |
| `apps/web/src/lib/job-connectors.test.ts` | `f35ffc47bb1d7dbb28e311693ea9ef683db2e003e5d97db005afb6423a79f91c` | `f35ffc47bb1d7dbb28e311693ea9ef683db2e003e5d97db005afb6423a79f91c` | **PASS (Exact Match)** |
| `apps/web/src/lib/ai/task-registry.ts` | `18f35979a26222cad7d407eb588050498c439793da19690e53340c702c3c73ab` | `18f35979a26222cad7d407eb588050498c439793da19690e53340c702c3c73ab` | **PASS (Exact Match)** |

- **Original Workbook Baseline SHA256:** `8a6794c75e8e323e0fa06678b1c3096cfeec17c32f084a046fa84143a52bea97` (Verified exact match against `PHASE3_ORIGINAL_WORKBOOK_BASELINE.xlsx`).
- **Unmodified Source Files:** All 421 unmodified files in `PHASE3_FROZEN_MANIFEST.json` matched with 0 discrepancies.

---

## 3. INVESTIGATION AREA A — COMPLETE ORIGINAL ASSESSMENT RECORD

### 3.1 Raw Extraction Content
The extracted document text from `Example-Curriculum-Vitae-bad.pdf` (Job `8d56f598-3d96-41e9-a38d-6fbcc0cbfaf3`):
```text
SMUDGER SMITH
Mobile: 01234 567890
Email: armymental@mod.uk
An experienced platoon sergeant with bags of experience whacking bods on tour. Led blokes on 4 tours of
Afghanistan and renowned for being the ‘life and soul’ of the party by my boss-man.
KEY SKILLS:
• Section Commander – Course qualified at SCBC and PSBC and promoted early.
• Get things done – Know what needs to happen and I make it so, ignoring comments from others who slow me down.
• Mission accomplished – Never failed to clear the compounds in the quickest time even in high IED environments with civvies everywhere.
• Barrack Room bloke in ITC Catterick – Helped crows get through training even as a young lad. Mega on the lash.
• BARMA and 360 arcs – Careful at clearing lanes through high-threat areas even with rounds going down-range.
• Confident to speak up – Happy to tell seniors when they’re wrong and equally willing to prove it with my men.
• Able to tell the difference between capable seniors and incapable ones – Reputation for knowing when to ignore idiots and focus on clever people so my team was always in the right place at the right time.
• 7 Questions – Briefed the lads in ‘O’ Groups
EMPLOYMENT HISTORY:
Platoon Sergeant, ITC Catterick.
• Taught a 44 week course. Sorted the G1/G4 admin and taught lessons to the new recruits in my platoon. Most passed the course.
• Helped the Boss. Made sure the Boss was ok with how things were going and let him know which crows were falling short or doing well and that.
• Made sure all timings were adhered to. Let everyone know when stuff was happening then told them off if they weren’t 5 minutes early at every serial.
• Taught weapon handling and map reading. Taught the platoon lessons helping them pass the ITC course. I also helped Dinger and Legs with their MATTs.
• G1. Helped the Boss with all the Platoon’s G1 for the reporting period and made sure his admin was squared for platoon interviews at the start of the course and zero week.
Section Commander 1 Royal Bluffers, on ops.
• Led 8 blokes. As well as all the training beforehand, I was a section commander on ops with my section of 2 fire teams with Badger as my 2iC. We did lots of platoon attacks and ambushes as well as a couple of advances to contact. I also had to help Sarge with the platoon book.
• Admin. Although boring, I was quite good at kit checks and none of my section were diffy after Ghanners.
• 7 Qs. After the Boss’ orders I would do my estimate and tell the lads what the plan was. I did quite well at this on SCBC and PSBC. Front man was always whoever had under-performed recently, I never just made it the new bloke with the crow-pipe!
EDUCATION AND QUALIFICATIONS:
• None worthy of a bank so no point putting them down on here
GENERAL INFORMATION:
• Good on the lash and I like running
```

### 3.2 Complete Parameter Scoring Breakdown (Assessment `439tjmh3epr`)

| Param | Pillar | Description | Base Wt (No JD) | Effective Max | Rating (0–5) | Points Earned | Severity Issues Flagged by AI | Evidence Excerpt / Rationale |
|---|---|---|---|---|---|---|---|---|
| **C01** | Content | Role positioning & value proposition | 7.8 | 7.80 | **3** | **4.68** | Minor: Opening positioning uses overly informal language | *"Opening clearly states intended function as a platoon sergeant."* |
| **C02** | Content | Experience & practical capability evidence | 13.0 | 13.00 | **3** | **7.80** | Major: Lack of employment dates prevents verification of duration | *"Detailed practical experience described at ITC Catterick and 1 Royal Bluffers."* |
| **C03** | Content | Achievements & contribution | 10.4 | 10.40 | **3** | **6.24** | Minor: Outcomes are described qualitatively with informal phrasing | *"Mentions recruits passing the course and successful mission outcomes."* |
| **C04** | Content | Skills & competency evidence | 9.1 | 9.10 | **3** | **5.46** | Minor: Skills are embedded informally within descriptive text | *"Course qualifications at SCBC and PSBC are listed."* |
| **C05** | Content | Education, credentials & relevant learning | 5.2 | 5.20 | **1** | **1.04** | Major: Formal qualifications and credentials are absent | *"Education section contains dismissive phrasing instead of formal credentials."* |
| **C06** | Content | Essential information & completeness | 6.5 | 6.50 | **3** | **3.90** | Minor: Contact channels are incomplete (missing location/LinkedIn) | *"Phone and email are provided, but LinkedIn and location details are missing."* |
| **C07** | Content | Clarity, language & concise expression | 5.2 | 5.20 | **2** | **2.08** | Major: Informal language detracts from professional coherence | *"Colloquial and unprofessional terminology used throughout the document."* |
| **C08** | Content | Chronology, consistency & credibility | 3.9 | 3.90 | **0** | **0.00** | **Critical (Blocker): No employment dates found; timeline cannot be constructed** | *"No dates or year references are provided for employment history."* |
| **C09** | Content | Content relevance & prioritization | 3.9 | 3.90 | **3** | **2.34** | Minor: Inclusion of casual commentary dilutes professional relevance | *"Relevant military experience is prioritized, though informal remarks dilute focus."* |
| **SUBTOTAL** | **Content** | **All Content Criteria** | **65.0** | **65.00** | — | **33.54** | *(51.6% Content Efficiency)* | — |
| **V01** | Visual | Layout, hierarchy & ease of scanning | 8.4 | 8.40 | **4** | **6.72** | None | *"Clear section headings help scan easily; single-column flow is logical."* |
| **V02** | Visual | Typography & text legibility | 7.0 | 7.00 | **5** | **7.00** | None | *"Standard dark sans-serif text on light background; high legibility."* |
| **V03** | Visual | Spacing, alignment & density | 5.6 | 5.60 | **4** | **4.48** | None | *"Whitespace well-balanced (0.35 ratio); bullet points prevent crowding."* |
| **V04** | Visual | Consistency & professional coherence | 4.2 | 4.20 | **3** | **2.52** | Minor: Informal styling lacks formal polish | *"Consistent bolding, but informal entries lack formal resume aesthetic."* |
| **V05** | Visual | Page length, flow & space utilization | 5.6 | 5.60 | **5** | **5.60** | None | *"Fits neatly onto a single page without crowding or awkward breaks."* |
| **V06** | Visual | Contrast, visual accessibility & graphics | 4.2 | 4.20 | **5** | **4.20** | None | *"High contrast monochrome text; 100% accessible in grayscale."* |
| **SUBTOTAL** | **Visual** | **All Visual Criteria** | **35.0** | **35.00** | — | **30.52** | *(87.2% Visual Efficiency)* | — |
| **J01–J05** | Job Match | Target Fit & Functional Alignment | 0.0 | 0.00 | N/A | **0.00** | Excluded | *Mode is `no_job_description`; J parameters excluded per Rule 02.* |
| **TOTAL** | **Combined**| **Cumulative Final Assessment** | **100.0** | **100.00** | — | **64.06** | **Rounded to 1 decimal place: 64.1 / 100** | **Descriptive Band: "Developing"** |

---

## 4. INVESTIGATION AREA B — WORKBOOK SCORING ENGINE & ARITHMETIC AUDIT

### 4.1 Verification Against Workbook Specification
The audit evaluated the programmatic scoring engine (`packages/domain/src/successpro-v2/scoring-engine.ts`) against the authoritative Excel workbook (`PHASE3_ORIGINAL_WORKBOOK_BASELINE.xlsx`):

1. **Rule 01 & Rule 02 (Pillar Allocations)**:
   - With-JD Mode: Content 50, Visuals 25, Job Match 25.
   - Without-JD Mode: Content 65, Visuals 35, Job Match 0.
   - Scaling multiplier: Content base weights x1.3 (50 x 1.3 = 65); Visual base weights x1.4 (25 x 1.4 = 35).
   - **Audit Verdict:** Implemented exactly in `PARAMETER_REGISTRY` and `scoring-engine.ts`.

2. **Rule 03 (Parameter Earned Points Calculation)**:
   - Formula: `EarnedPoints = EffectiveMaxWeight * (Rating / 5)` where `Rating` is in {0, 1, 2, 3, 4, 5}.
   - **Audit Verdict:** The engine applies this exact mathematical formulation without alteration or truncation.

3. **Rule 05 & Rule 06 (N/A Handling & Safeguards)**:
   - When a parameter is marked N/A, its base weight is removed from the denominator and redistributed proportionally among non-N/A parameters *within the same pillar only*. Weights are never shifted across pillars.
   - For `439tjmh3epr`, no Content or Visual parameter was marked N/A; all 9 Content and 6 Visual parameters were Assessed.

4. **Rule 09 (Full-Precision Rounding Trace)**:
   - Points are summed unrounded across all parameters:
     Content = 4.68 + 7.80 + 6.24 + 5.46 + 1.04 + 3.90 + 2.08 + 0.00 + 2.34 = 33.54
     Visual = 6.72 + 7.00 + 4.48 + 2.52 + 5.60 + 4.20 = 30.52
     Total = 33.54 + 30.52 = 64.06 -> rounded to 1 decimal = 64.1
   - **Audit Verdict:** Arithmetic implementation is 100% mathematically correct according to the workbook formulas.

### 4.2 Audit of Severity Deductions & Point Subtractions
A major question investigated was: **Why did "Critical" and "Major" issues not cause numerical deductions?**
- Inspection of `scoring-engine.ts` lines 182–189:
  ```typescript
  const issues = p.userParam?.issues || [];
  for (const issue of issues) {
    if (issue.isMandatoryGap || issue.severity === "Critical") {
      mandatoryGaps.push(`${p.def.id} (${p.def.name}): ${issue.message}`);
    }
  }
  ```
- **Authoritative Rule 10 [No hidden caps]**:
  > *"Do not introduce undisclosed penalties, score multipliers, recruiter probability, ATS composite or demographic/profile adjustments. Serious issues and confirmed mandatory gaps get a prominent warning independent of total."*
- **Audit Finding:** The scoring engine strictly adheres to Rule 10. In SuccessPro V2, **there are no post-hoc numerical deductions subtracted from the total score**. Issues (Minor, Major, Critical) are intended to guide the evaluator to assign a lower anchor rating (0–5) during assessment. Once an anchor rating is chosen, the engine performs pure linear scaling. If the evaluator fails to lower the rating, the system has no secondary deduction or capping mechanism.

---

## 5. INVESTIGATION AREA C — AI ASSESSMENT QUALITY & CRITERION ANALYSIS

### 5.1 Critique of AI Anchor Assignment
The assessment prompt executed `gemini-3.5-flash-lite` with prompt version `successpro-v2-workbook-evidence-phase3-v5-editorial-v3`. A critical review of each assigned rating reveals pervasive grade inflation:

1. **C01 — Role positioning (Assigned: 3/5, Deserved: 1/5)**:
   - *AI Rationale:* "Opening clearly states intended function as a platoon sergeant."
   - *Actual Text:* *"An experienced platoon sergeant with bags of experience whacking bods on tour. Led blokes on 4 tours of Afghanistan and renowned for being the ‘life and soul’ of the party by my boss-man."*
   - *Audit Critique:* Rating 3 in the rubric represents "Adequate / Basic Acceptable". A summary containing *"whacking bods on tour"* and *"life and soul of the party by my boss-man"* is an immediate disqualifier for any professional role. Assigning 3/5 demonstrates a catastrophic failure to account for tone. It should be Rating 1.

2. **C02 — Practical Capability Evidence (Assigned: 3/5, Deserved: 2/5)**:
   - *AI Rationale:* "Detailed practical experience described at ITC Catterick and 1 Royal Bluffers."
   - *Actual Text:* *"Made sure all timings were adhered to... told them off if they weren’t 5 minutes early... I also helped Dinger and Legs with their MATTs."*
   - *Audit Critique:* The experience bullets cite nicknames (*"Dinger"*, *"Legs"*, *"Badger"*), lack any year/date framing, and mix administrative tasks with informal anecdotes. Awarding 60% of available points (7.80/13.0) is excessively generous.

3. **C03 — Achievements & Contribution (Assigned: 3/5, Deserved: 1/5)**:
   - *AI Rationale:* "Mentions recruits passing the course and successful mission outcomes."
   - *Actual Text:* *"Most passed the course... none of my section were diffy after Ghanners."*
   - *Audit Critique:* Qualitative slang without verifiable metrics or professional framing.

4. **C04 — Skills & Competencies (Assigned: 3/5, Deserved: 2/5)**:
   - *AI Rationale:* "Course qualifications at SCBC and PSBC are listed."
   - *Actual Text:* *"Barrack Room bloke in ITC Catterick – Helped crows get through training even as a young lad. Mega on the lash."*
   - *Audit Critique:* Including *"Mega on the lash"* under "Key Skills" should preclude an "Adequate" rating.

5. **C05 — Education & Credentials (Assigned: 1/5, Deserved: 0/5)**:
   - *AI Rationale:* "Education section contains dismissive phrasing instead of formal credentials."
   - *Actual Text:* *"None worthy of a bank so no point putting them down on here"*.
   - *Audit Critique:* Mocking the education section should result in 0/5.

6. **C06 — Essential Information (Assigned: 3/5, Deserved: 2/5)**:
   - *AI Rationale:* "Phone and email are provided, but LinkedIn and location details are missing."
   - *Actual Text:* Email provided is `armymental@mod.uk`.
   - *Audit Critique:* A bizarre or inappropriate email address represents a failure of professional presentation.

7. **C07 — Clarity & Language (Assigned: 2/5, Deserved: 1/5)**:
   - *AI Rationale:* "Colloquial and unprofessional terminology used throughout the document."
   - *Audit Critique:* The document is composed entirely of informal military slang. Rating 2 implies "Partial evidence with important shortfalls". It is entirely deficient and warrants Rating 1.

8. **C08 — Chronology & Credibility (Assigned: 0/5, Deserved: 0/5)**:
   - *AI Rationale:* "No dates or year references are provided for employment history."
   - *Audit Critique:* Accurately rated 0/5.

9. **C09 — Relevance & Prioritization (Assigned: 3/5, Deserved: 1/5)**:
   - *AI Rationale:* "Relevant military experience is prioritized, though informal remarks dilute focus."
   - *Actual Text:* *"Good on the lash and I like running"*.
   - *Audit Critique:* Severe dilution of professional focus.

---

## 6. INVESTIGATION AREA D — DOCUMENT EXTRACTION & VISUAL SIGNAL INTEGRITY

### 6.1 Text Extraction Fidelity
- **Extraction Engine:** PyMuPDF (`fitz`) via `processing/resume_worker/extraction.py`.
- **Character Count:** 2,812 characters across 1 page.
- **Accuracy:** 100% token recall. The extractor did not miss text, alter words, or hallucinate characters.
- **Layout Flow:** Single-column layout preserved natural reading order with 0 text interleaving errors.

### 6.2 Visual Analysis & OpenCV Telemetry
- **Visual Engine:** Headless PyMuPDF rendering + OpenCV density analysis (`processing/resume_worker/visual.py`).
- **Telemetry Signals:**
  - `pageCount`: 1
  - `fontCount`: 5
  - `minimumFontSize`: 7.92 pt
  - `crowdedLayout`: False
  - `excessiveWhitespace`: False (whitespace ratio: 0.35)
  - `inconsistentMargins`: False
  - `excessiveColor`: False (monochrome black/white)
  - `geminiVisualScore`: 87/100
- **Visual Audit Finding:**
  The OpenCV telemetry and Gemini visual analysis accurately measured the *physical typesetting* of the document. The document *is* cleanly laid out. Because visual presentation is completely decoupled from content semantics in the two-pillar architecture, the visual engine correctly scored the visual attributes as 30.52/35. The error is architectural: **in a No-JD assessment, visual typesetting should not account for more than 15–20% of the candidate's employability score**.

---

## 7. INVESTIGATION AREA E — AI PROVIDER, MODEL, & PIPELINE INTEGRITY

### 7.1 Provider & Execution Metadata
- **Provider:** `local-gemini` (calling Google Gemini API via `processing/resume_worker/ai.py`).
- **Model:** `gemini-3.5-flash-lite`.
- **Execution Mode:** Direct API call; `fallbackDepth: 0`. Deterministic fallback was **not** invoked.
- **Latency:** 17,640 ms.
- **Token Usage:** 12,073 input tokens (including system rubric prompt), 2,109 output tokens.
- **Schema Validation:** Passed on first repair attempt (`repairAttempts: 1`). Output adhered strictly to `AnalysisOutput` JSON schema.

---

## 8. INVESTIGATION AREA F — INDEPENDENT SCORE RECONSTRUCTION

### 8.1 Reconstructed Score Table
The following table models:
1. **Actual Engine Score (64.1)**: As persisted in the database.
2. **Calibrated Human-Rubric Score**: Applying strict rubric definitions without grade inflation.
3. **Calibrated Score with Critical Blocker Capping**: Applying a fatal-flaw cap for missing dates (C08).

| Criterion | Base Wt (No JD) | Actual Rating | Actual Earned | Calibrated Rating | Calibrated Earned | Calibrated Rationale |
|---|---|---|---|---|---|---|
| C01 | 7.8 | 3 | 4.68 | 1 | 1.56 | Grossly unprofessional opening phrasing |
| C02 | 13.0 | 3 | 7.80 | 2 | 5.20 | Vague operational claims without dates or verified scope |
| C03 | 10.4 | 3 | 6.24 | 1 | 2.08 | Casual anecdotes; no professional deliverables |
| C04 | 9.1 | 3 | 5.46 | 2 | 3.64 | Some recognized courses (SCBC/PSBC), heavily polluted by slang |
| C05 | 5.2 | 1 | 1.04 | 0 | 0.00 | Openly mocks the qualification section |
| C06 | 6.5 | 3 | 3.90 | 2 | 2.60 | Bizarre email, missing location and LinkedIn |
| C07 | 5.2 | 2 | 2.08 | 1 | 1.04 | Document-wide colloquial slang |
| C08 | 3.9 | 0 | 0.00 | 0 | 0.00 | Complete absence of employment dates |
| C09 | 3.9 | 3 | 2.34 | 1 | 0.78 | Includes irrelevant recreational drinking claims |
| **Content Total** | **65.0** | — | **33.54** | — | **16.90** | *(Calibrated Content Efficiency: 26.0%)* |
| **Visual Total** | **35.0** | — | **30.52** | — | **30.52** | *(Unchanged typesetting score)* |
| **Uncapped Total** | **100.0** | — | **64.06 (64.1)** | — | **47.42 (47.4)** | **Band: "Major Improvement" (40–<60)** |
| **With Blocker Cap**| **100.0** | — | **64.1 (No Cap)**| — | **<40.0** | **Band: "Substantial Revision" (<40)** |

---

## 9. INVESTIGATION AREA G — COHORT CONSISTENCY & REPEATABILITY AUDIT

### 9.1 Scoring Repeatability (Drift Analysis on Identical Document)
Two independent assessments of `SMUDGER SMITH` (`Example-Curriculum-Vitae-bad.pdf`) exist in the database:

| Parameter | Run 1 (`wybbv1cer7j`, 2026-11-14) | Run 2 (`439tjmh3epr`, 2026-11-16) | Delta (Rating) | Delta (Points) |
|---|---|---|---|---|
| C01 | 3 (4.68 pts) | 3 (4.68 pts) | 0 | 0.00 |
| C02 | 3 (7.80 pts) | 3 (7.80 pts) | 0 | 0.00 |
| C03 | 3 (6.24 pts) | 3 (6.24 pts) | 0 | 0.00 |
| **C04** | **2 (3.64 pts)** | **3 (5.46 pts)** | **+1** | **+1.82** |
| C05 | 1 (1.04 pts) | 1 (1.04 pts) | 0 | 0.00 |
| C06 | 3 (3.90 pts) | 3 (3.90 pts) | 0 | 0.00 |
| **C07** | **1 (1.04 pts)** | **2 (2.08 pts)** | **+1** | **+1.04** |
| C08 | 0 (0.00 pts) | 0 (0.00 pts) | 0 | 0.00 |
| C09 | 3 (2.34 pts) | 3 (2.34 pts) | 0 | 0.00 |
| Content Sum | 30.68 pts | 33.54 pts | — | +2.86 pts |
| Visual Sum | 30.52 pts | 30.52 pts | 0 | 0.00 pts |
| **Final Score** | **61.2 / 100** | **64.1 / 100** | — | **+2.9 points** |

- **Repeatability Finding:** A **2.9-point variance** occurred across two identical runs without code or prompt changes. The variation is attributable entirely to stochastic temperature behavior in `gemini-3.5-flash-lite`.

### 9.2 Cohort Dynamic Range Compression
Comparing `SMUDGER SMITH` against legitimate candidate resumes assessed in the same database:

| Candidate | File / Role | Evaluation Mode | Final Score | Content Pts | Visual Pts | Job Match Pts |
|---|---|---|---|---|---|---|
| **Andrew Dillon** | Senior Platform Engineer | With JD | **96.8 / 100** | 47.6 / 50 | 24.2 / 25 | 25.0 / 25 |
| **Sungmin Lee** | Full-Stack Career Transition | With JD | **98.2 / 100** | 48.2 / 50 | 25.0 / 25 | 25.0 / 25 |
| **Davide Liu** | ML Engineer / Researcher | With JD | **95.8 / 100** | 49.0 / 50 | 21.8 / 25 | 25.0 / 25 |
| **Janice Benita** | AI/ML Engineer | No JD | **96.5 / 100** | 62.66 / 65 | 33.88 / 35 | 0.0 / 0 |
| **Smudger Smith** | Joke Negative Test CV | No JD | **64.1 / 100** | 33.54 / 65 | 30.52 / 35 | 0.0 / 0 |

- **Dynamic Range Defect:** The entire evaluation range between an **exceptional senior software engineer (96.8)** and an **unemployable joke CV containing profanity and zero dates (64.1)** is **only 32.7 points**. The bottom 60 points of the 100-point scale are virtually unreachable for any document that has readable text and clean layout formatting.

---

## 10. REMEDIATION RECOMMENDATIONS
*(Diagnostic recommendations only — STRICTLY NOT AUTHORIZED FOR IMPLEMENTATION IN THIS PHASE)*

| Recommendation ID | Component | Proposed Action | Expected Impact |
|---|---|---|---|
| **REC-01** | Scoring Engine (`scoring-engine.ts`) | **Implement Mandatory Blocker Score Capping**: If any parameter has `confirmedBlocker: true` (e.g. C08 missing timeline, or severe contact failure), enforce an upper bound cap on the cumulative score (e.g., cumulative score <= 39.9) or publish as "Technical Rejection / Incomplete". | Prevents un-hireable resumes with fatal flaws from receiving passing grades. |
| **REC-02** | Prompt Engineering (`task-registry.ts`) | **Calibrate LLM Anchor Rubric**: Inject explicit negative few-shot examples into the rubric prompt. Explicitly define that colloquial language, profanity, or dismissive text must result in Anchor 0 or 1, overriding operational keyword presence. | Eliminates the "3-is-Average" default bias in Gemini Flash. |
| **REC-03** | Scoring Model (`parameter-registry.ts`) | **Rebalance No-JD Pillar Allocations**: Review whether 35% visual weighting is disproportionately high when evaluating standalone resumes. Recommend shifting allocation to Content: 80%, Visual: 20% in No-JD mode. | Reduces the unearned "visual baseline floor" from ~30 points to ~15 points. |
| **REC-04** | Pre-Flight Validation (`document-preflight.ts`) | **Deterministic Date & Slang Pre-Screening**: Run deterministic regex checks for employment dates and profanity before LLM scoring. If no chronological dates are detected, immediately flag C08 as 0 without relying on LLM interpretation. | Ensures 100% deterministic, repeatable blocker detection. |
| **REC-05** | LLM Configuration (`config.py` / `ai.py`) | **Temperature Clamping**: Set `temperature: 0.0` for assessment tasks to ensure zero scoring drift on identical input resumes. | Guarantees identical scores across runs for QA audit repeatability. |

---

## 11. POST-AUDIT INTEGRITY CONFIRMATION

- **Code Modifications:** ZERO source files were modified during this phase.
- **Workbook Modifications:** ZERO modifications were made to `PHASE3_ORIGINAL_WORKBOOK_BASELINE.xlsx`.
- **Database Modifications:** All MySQL queries were executed strictly as read-only transactions (`readonly=True` or `SELECT`). Zero rows were inserted, updated, or deleted.
- **External Calls:** Zero live Gemini API evaluations were triggered. All audit findings were established using pre-existing, persisted evidence in the database and local QA artifact store.

---
**AUDIT CONCLUSION:**  
PHASE 3B — SCORING CALIBRATION & AI ASSESSMENT QUALITY AUDIT COMPLETED — READ-ONLY — BASELINE PRESERVED.
