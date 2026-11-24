# SUCCESSPRO v2 — REAL RESUME SCORE & VISUAL ASSESSMENT AUDIT
**Reference Investigation:** Real Resume Score of 38 & 43.75 Without Job Description  
**Project Path:** `D:\successpro-app-vscode`  
**Execution Date:** 2026-11-14  
**Audit Mode:** Strictly READ-ONLY Investigation (No code or database modifications)

---

## 1. Executive Summary

This audit investigates the empirical behavior of the running SuccessPro application based on actual database records (MySQL job `09c92805-0244-4bef-87a1-458e192d83fb`), the active codebase (`packages/domain/src/scoring-config.ts`, `apps/web/src/app/api/reviews/route.ts`), and the real user test scenarios:
1. **Scenario A (Score 38):** Resume uploaded without Job Description; Content displayed; Visual Design displayed as "Not evaluated" / "Requires PDF upload to evaluate"; Overall score displayed as **38 / 100**.
2. **Scenario B (Score 43.75, Confirmed by UI Screenshot):** Resume uploaded without Job Description; Content Quality score = 70 (+35 pts); Visual Quality score = 35 (+8.75 pts); Job Description = 0% (+0 pts); Displayed Overall Score = **43.75 / 100** with **100% Evaluation Coverage** and **"Complete 3-Component Score"**.
3. **Upload Interruption (Confirmed by UI Screenshot):** File upload error on `pretty-creative-resume-template-burgundy.pdf` stating: *"The upload was interrupted. Check your connection and try again; your review allowance was not used."*

---

## 2. Actual Application Result vs. Expected V2 Result

| Field | Actual Application Result (Scenario A / B) | Expected SuccessPro V2 Result | Discrepancy & Workbook Rule Violation |
|---|---|---|---|
| **Scoring Engine** | **Legacy Engine** (`packages/domain/src/scoring-config.ts`) | **SuccessPro V2 Engine** (`packages/domain/src/successpro-v2/`) | V2 engine is implemented and fully tested (67/67 tests passing), but web routes still route to legacy engine. |
| **Scoring Mode** | 3-Component Fixed Weights (50% / 25% / 25%) with Job Match penalized at 0% | **No-JD Mode** (65% Content / 35% Visual / 0% Job Match) | **Rule 02 Violation**: Missing JD was allocated 25% weight and awarded 0 points, penalizing applicant by 25 points. |
| **Content Maximum** | 50 points (50% of 100) | **65.0 points** | **Rule 02 Violation**: In No-JD mode, Content Quality must scale to 65 points across C01–C09. |
| **Content Earned** | Scenario A: **38.0 pts** ($76 \times 0.50$)<br>Scenario B: **35.0 pts** ($70 \times 0.50$) | Scenario A: **49.4 pts** ($65 \times 0.76$)<br>Scenario B: **45.5 pts** ($65 \times 0.70$) | Deflated by ~10–11 points due to fixed 50% ceiling instead of 65%. |
| **Visual Maximum** | 25 points (25% of 100) | **35.0 points** | **Rule 02 Violation**: Visual Design must scale to 35 points across V01–V06. |
| **Visual Earned** | Scenario A: **0 pts** ("Not evaluated")<br>Scenario B: **8.75 pts** ($35 \times 0.25$) | Scenario A: **Pending** (Score Pending, 35 max reserved)<br>Scenario B: **12.25 pts** ($35 \times 0.35$) | Scenario A violated **Rule 07** by displaying finalized score; Scenario B used 25% weight instead of 35%. |
| **Job Match** | **0 pts** (25% weight applied, earned 0%) | **EXCLUDED** (0.0 points max, 0.0 weight) | **Rule 02 Violation**: Job Match must be completely excluded from the denominator and earn zero penalty. |
| **Overall Score** | Scenario A: **38.0 / 100**<br>Scenario B: **43.75 / 100** | Scenario A: **Range [49.4, 84.4]** (`score_pending`)<br>Scenario B: **57.75 / 100** ($45.5 + 12.25$) | Severe score deflation (-24 points in Scenario A, -14 points in Scenario B). |
| **Score Status** | Scenario A: Completed/Provisional (38)<br>Scenario B: **"Complete 3-Component Score"** (100% Coverage) | Scenario A: **`score_pending`**<br>Scenario B: **`completed`** | Scenario A displayed a final score while Visual was missing; Scenario B falsely claimed 100% coverage with 0% Job Match. |

---

## 3. Mathematical Proof & Trace of the Scores

### Mathematical Origin of Score 38.0
In `packages/domain/src/scoring-config.ts` (lines 175–207):
```typescript
const contentContribution = Math.round(input.contentQualityScore * weights.contentQuality * 100) / 100;
const visualContribution = visualStatus !== "not_evaluated" && input.visualQualityScore !== null
  ? Math.round(input.visualQualityScore * weights.visualQuality * 100) / 100
  : 0;
const score = Math.round((contentContribution + visualContribution + (jobMatchContribution ?? 0)) * 100) / 100;
```
For Scenario A:
- `contentQualityScore` $= 76.0$
- `weights.contentQuality` $= 0.50 \implies \text{contentContribution} = 76.0 \times 0.50 = \mathbf{38.0}$
- `visualQualityScore` $= \text{null}$ (Visual Design failed/missing) $\implies \text{visualContribution} = \mathbf{0.0}$
- `jobMatchContribution` $= \text{null}$ (No JD provided) $\implies \mathbf{0.0}$
- **Overall Score** $= 38.0 + 0.0 + 0.0 = \mathbf{38.0 / 100}$.

### Mathematical Origin of Score 43.75
For Scenario B (as captured in the user's UI screenshot):
- `contentQualityScore` $= 70.0 \implies 70.0 \times 0.50 = \mathbf{35.0\text{ pts}}$
- `visualQualityScore` $= 35.0 \implies 35.0 \times 0.25 = \mathbf{8.75\text{ pts}}$
- `jobMatchContribution` $= 0.0 \implies 0.0 \times 0.25 = \mathbf{0.0\text{ pts}}$
- **Overall Score** $= 35.0 + 8.75 + 0.0 = \mathbf{43.75 / 100}$.

---

## 4. Root Causes & Findings

### Finding 1: Running Application Uses Legacy Scoring Engine
The web review route (`apps/web/src/app/api/reviews/route.ts`) imports and executes `scoreResumeText` from `packages/domain/src/resume-scoring.ts`. The newly built V2 engine in `packages/domain/src/successpro-v2/` is complete and verified with 67 tests, but has not yet been hooked up to the Next.js API endpoints.

### Finding 2: Severe Penalty for Missing Job Description
The legacy scoring formula explicitly forces a fixed 100-point scale:
$$50\% \text{ Content} + 25\% \text{ Visual} + 25\% \text{ Job Match}$$
When no job description is entered, the legacy engine retains 25% weight for Job Match, sets earned points to 0, and reports either 75% or 100% coverage. This penalizes every candidate without a JD by **25 points**.

Under **SuccessPro V2 Rule 02**:
- Content Quality base weight $= 65.0$
- Visual Design base weight $= 35.0$
- Job Match base weight $= 0.0$ (excluded)
No candidate is penalized for omitting a job description.

### Finding 3: Why Visual Design Was Not Displayed (Scenario A) & Upload Interruption
1. **Gemini Vision 503 Outage:** MySQL job `09c92805-0244-4bef-87a1-458e192d83fb` log proves:
   `503 UNAVAILABLE: This model is currently experiencing high demand. Spikes in demand are usually temporary.`
   The Python worker could not obtain visual AI analysis from Gemini.
2. **Upload Interruption Error:** As proven in the user's screenshot (`pretty-creative-resume-template-burgundy.pdf`), network timeouts or worker communication interruptions trigger:
   *"The upload was interrupted. Check your connection and try again; your review allowance was not used."*
   When an upload is interrupted or fails extraction, the frontend either falls back to text-only review or leaves visual metrics unset.
3. **Frontend Display Suppression:** In `apps/web/src/app/api/reviews/route.ts` line 68:
   `const visualDesignScore = base.visualDesignStatus === "evaluated" || base.visualDesignStatus === "partial" ? base.visualDesignScore : null;`
   When `visualDesignScore` is `null`, the UI renders "Not evaluated / Requires PDF upload to evaluate".

### Finding 4: Violation of Rule 07 (Pending Visuals)
When Visual Design cannot be evaluated (e.g. upload failure or text-only entry), the legacy engine outputs a finalized overall score of 38.
Under **SuccessPro V2 Rule 07**:
- When Visual Design (V01–V06) is pending, the overall score status MUST be **`score_pending`**.
- The UI MUST display:
  - Confirmed Earned Points: **49.4 / 65.0**
  - Pending Points: **35.0**
  - Possible Score Range: **[49.4, 84.4]**
- The system MUST NEVER display a deflated cumulative score of 38 as a finalized score.

---

## 5. Confirmed Defects & Severity

| Defect ID | Description | Severity | Impact |
|---|---|---|---|
| **DEF-01** | Missing JD penalizes score by 25 points (fixed 50/25/25 instead of No-JD 65/35/0) | **CRITICAL** | Every user reviewing a resume without a JD receives a severely deflated, inaccurate score (e.g. 43.75 instead of 57.8). |
| **DEF-02** | Displaying finalized score when Visual Design is missing (violation of Rule 07) | **CRITICAL** | Candidates without visual evaluation receive a devastating score of 38 instead of a pending range [49.4, 84.4]. |
| **DEF-03** | Web API (`/api/reviews`) still running legacy scoring instead of V2 engine | **HIGH** | V2 engine is implemented and fully tested, but users still hit legacy calculation. |
| **DEF-04** | Upload interruption & unhandled 503 Gemini Vision errors in Python worker | **HIGH** | User uploads fail or drop visual signals silently without automatic retry or graceful fallback. |
| **DEF-05** | Misleading UI badge claiming "Complete 3-Component Score" and "100% Coverage" when Job Match is 0% | **MEDIUM** | User is shown 100% coverage despite having entered no job description. |

---

## 6. Recommended Corrections (Non-Code / Implementation Roadmap)

1. **Phase 4B API Switchover:** Update `apps/web/src/app/api/reviews/route.ts` to route all assessment requests through `calculateSuccessProV2Score` in `packages/domain/src/successpro-v2/`.
2. **Enforce No-JD Weighting:** Ensure that when `jobDescription` is absent, the engine activates No-JD mode (Content max 65.0, Visual max 35.0, Job Match excluded).
3. **Enforce Rule 07 UI State:** When visual design is unavailable, display `score_pending` with the possible range (`[49.4, 84.4]`) and a clear prompt: *"Upload PDF to complete visual evaluation and unlock final score"*.
4. **Worker Resilience & Exponential Backoff:** Add automated retries with exponential backoff for Gemini Vision 503/429 errors in `processing/resume_worker/`, and ensure OpenCV metrics act as an immediate fallback rather than failing the visual score entirely.
