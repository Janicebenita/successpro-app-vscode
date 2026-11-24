# SUCCESSPRO v2 — WORKBOOK-TO-CODE GAP ANALYSIS
**Authoritative Reference:** SuccessPro v2 Excel Workbook Specification  
**Current Codebase:** `D:\successpro-app-vscode`  
**Generated:** 2026-11-14  
**Status:** Strict Read-Only Audit & Code Mapping

---

## 1. Executive Summary

This Gap Analysis compares the complete authoritative **SuccessPro v2 Excel Workbook** against the existing implementation in `D:\successpro-app-vscode`. The workbook establishes a unified, single cumulative resume score out of 100 governed by 20 granular parameters (C01–C09, V01–V06, J01–J05), Rules 01–24, strict intra-pillar N/A redistribution, a reserved-weight Pending state for uninspected documents, 15 career adaptations, and 100% Free/Paid scoring parity.

The existing codebase contains a working 3-component structure (Content, Visual, Job Match) with OpenCV geometric analysis, Gemini Vision multimodal inspection, and Gemini LLM review. However, significant architectural gaps exist in parameter granularity, No-JD weight ratios, 0–5 integer rating scale standardization, intra-pillar N/A formulas, and Pending state score-holding.

---

## 2. Requirement-to-Code Detailed Mapping

### 2.1 Parameter Registry & Framework Granularity

| Workbook Parameter | Existing Code Implementation | Current Behavior | Required Behavior | Gap Classification | Supporting Evidence |
|---|---|---|---|---|---|
| **C01** (Role positioning & value proposition - 6/7.8 pts) | `packages/domain/src/resume-scoring.ts` | Implicitly checked inside `professional_summary` factor | Distinct parameter C01 rated 0–5 with observable anchors | **Partially Implemented** | `resume-scoring.ts:89` groups summary presence rather than dedicated C01 rubric |
| **C02** (Experience & capability evidence - 10/13.0 pts) | `packages/domain/src/resume-scoring.ts` | Evaluated in `experience` factor (max 10 earned) | Distinct C02 rated 0–5; projects/volunteer valid for freshers | **Partially Implemented** | `resume-scoring.ts:102` relies on bullet counts and job titles |
| **C03** (Achievements & contribution - 8/10.4 pts) | `packages/domain/src/resume-scoring.ts` | Evaluated in `content_quality` / `achievement_quality` AI criteria | Distinct C03 rated 0–5; qualitative outcomes valid, numbers optional | **Partially Implemented** | `task-registry.ts:20` checks achievements, but not mapped to exact 8/10.4 weight |
| **C04** (Skills & competency evidence - 7/9.1 pts) | `packages/domain/src/resume-scoring.ts` | Evaluated in `skills` factor (max 10 earned) | Distinct C04 rated 0–5; contextual evidence over keyword counts | **Partially Implemented** | `resume-scoring.ts:118` awards points based on keyword count rather than contextual proof |
| **C05** (Education & credentials - 4/5.2 pts) | `packages/domain/src/resume-scoring.ts` | Evaluated in `education` factor (max 7 earned) | Distinct C05 rated 0–5; N/A when education neither supplied nor required | **Conflicting** | Existing code awards 0 if education missing; workbook mandates N/A with weight redistribution |
| **C06** (Essential info & completeness - 5/6.5 pts) | `packages/domain/src/resume-scoring.ts` | Evaluated in `contact` factor (max 8 earned) | Distinct C06 rated 0–5; chosen name + 1 contact channel; private data optional | **Partially Implemented** | `resume-scoring.ts:135` checks email/phone regex |
| **C07** (Clarity & concise expression - 4/5.2 pts) | `packages/domain/src/resume-scoring.ts` | Evaluated in `language` factor (max 8 earned) | Distinct C07 rated 0–5; no English-default or accent bias | **Partially Implemented** | `resume-scoring.ts:152` checks word count and filler words |
| **C08** (Chronology & credibility - 3/3.9 pts) | `packages/domain/src/resume-scoring.ts` | Evaluated in `dates` factor (max 7 earned) | Distinct C08 rated 0–5; no gap or age penalties; overlapping dates unioned | **Partially Implemented** | `resume-scoring.ts:144` checks date formats, but lacks union of concurrent jobs |
| **C09** (Content relevance & prioritization - 3/3.9 pts) | `packages/domain/src/resume-scoring.ts` | Not explicitly separated; blended into length checks | Distinct C09 rated 0–5; prioritizes relevant evidence over brevity | **Missing** | No dedicated C09 parameter in current scoring factors |
| **V01** (Layout, hierarchy & scanning - 6/8.4 pts) | `processing/resume_worker/visual.py` & `ai.py` | OpenCV projection profiles + Gemini `visual_hierarchy` | Distinct V01 rated 0–5; requires rendered document | **Partially Implemented** | Criteria exist in Python AI output, but not assigned 6/8.4 weight |
| **V02** (Typography & legibility - 5/7.0 pts) | `processing/resume_worker/visual.py` & `ai.py` | Font size extraction + Gemini `typography` | Distinct V02 rated 0–5; human legibility over font prestige | **Partially Implemented** | Evaluated qualitatively, but not mapped to exact 5/7.0 weight |
| **V03** (Spacing, alignment & density - 4/5.6 pts) | `processing/resume_worker/visual.py` & `ai.py` | OpenCV whitespace ratio + margin variance | Distinct V03 rated 0–5; balanced density across pages | **Partially Implemented** | Metric exists in OpenCV, but not mapped to exact 4/5.6 weight |
| **V04** (Visual consistency - 3/4.2 pts) | `processing/resume_worker/ai.py` | Gemini `cross_page_consistency` | Distinct V04 rated 0–5; coherent style, colors/photos permitted | **Partially Implemented** | Qualitative prompt exists; needs mapping to exact 3/4.2 weight |
| **V05** (Page length & flow - 4/5.6 pts) | `processing/resume_worker/visual.py` | Page count and whitespace density check | Distinct V05 rated 0–5; no universal 1/2 page limit; flow integrity | **Partially Implemented** | Penalizes >2 pages in some legacy rules; workbook allows 4+ pages if justified |
| **V06** (Contrast & accessibility - 3/4.2 pts) | `processing/resume_worker/visual.py` | OpenCV contrast ratio check | Distinct V06 rated 0–5; essential meaning readable in grayscale | **Partially Implemented** | OpenCV flag `low_colour_contrast` exists; needs 0–5 anchor mapping |
| **J01** (Role & functional match - 7/0 pts) | `packages/domain/src/job-match.ts` | Overall keyword match in `analyzeJobMatch` | Distinct J01 rated 0–5; core functions mapped to candidate evidence | **Partially Implemented** | `job-match.ts:25` extracts frequent terms; does not distinguish J01 from J02/J03 |
| **J02** (Required skills & methods - 6/0 pts) | `packages/domain/src/job-match.ts` | Matched keywords list in `analyzeJobMatch` | Distinct J02 rated 0–5; explicit required skills; no keyword stuffing credit | **Partially Implemented** | Blended into general term match in `job-match.ts` |
| **J03** (Experience & seniority - 5/0 pts) | `packages/domain/src/job-match.ts` | Inferred from token match | Distinct J03 rated 0–5; union overlapping dates; ambiguous duration $\rightarrow$ Pending | **Missing** | No duration unioning or explicit seniority level comparison in `job-match.ts` |
| **J04** (Mandatory qualifications - 4/0 pts) | `packages/domain/src/job-match.ts` | Not explicitly separated from skills | Distinct J04 rated 0–5; explicit credentials; N/A if JD has no credentials | **Missing** | Mandatory credentials not isolated as separate parameter |
| **J05** (Preferred skills & domain - 3/0 pts) | `packages/domain/src/job-match.ts` | Transferable groups in `job-match.ts:5` | Distinct J05 rated 0–5; preferred requirements mapped separately from J02 | **Partially Implemented** | Transferable groups exist, but not isolated as parameter J05 |

---

### 2.2 Mathematical Formulas & Normalization

| Workbook Rule | Existing Code | Gap Analysis & Confirmed Discrepancy | Required Implementation |
|---|---|---|---|
| **Rule 01** (With JD: 50 / 25 / 25) | `packages/domain/src/resume-scoring.ts:278` | **Correct.** Existing code implements 50% Content, 25% Visual, 25% Job Match. | Preserve 50/25/25 split in v2. |
| **Rule 02** (Without JD: 65 / 35 / 0) | `packages/domain/src/resume-scoring.ts:32` | **Conflicting.** Existing code normalizes to 66.67% Content and 33.33% Visual ($2:1$ ratio). | Calibrate to exact 65 Content ($1.3\times$) and 35 Visual ($1.4\times$). |
| **Rule 03** (Parameter Points: $\text{EffMax} \times \frac{\text{Rating}}{5}$) | `packages/domain/src/resume-scoring.ts` | **Conflicting.** Existing code calculates arbitrary earned points out of factor maximums (e.g. 12, 10, 8, 7). | Implement uniform 0–5 integer rating scale and standard formula. |
| **Rule 05** (Intra-pillar N/A Redistribution) | `packages/domain/src/resume-scoring.ts:28` | **Conflicting.** Existing code removes missing factor from total sum; workbook mandates exact intra-pillar proportional redistribution ($\text{EffMax} = \text{PillarMax} \times \frac{\text{Base}_i}{\sum \text{ActiveBase}}$). | Implement exact Rule 05 formula. Never transfer weight between pillars. |
| **Rule 07** (Pending State & Score Range) | `packages/domain/src/resume-scoring.ts:280` | **Conflicting.** When visual doc is missing, existing code displays "Not evaluated" and finalizes score; workbook requires holding score as **Pending** with score range. | Implement `score_pending` status and calculate $[\text{Confirmed}, \text{Confirmed} + \text{PendingMax}]$. |
| **Rule 09** (Precision & Rounding) | `packages/domain/src/resume-scoring.ts:240` | **Partially Implemented.** Intermediate values rounded to 2 decimals; workbook requires full float precision internally, rounded only at display. | Retain full IEEE 754 precision internally; format to 1–2 decimals for display. |
| **Rule 15** (JD Multi-Requirement Averaging) | `packages/domain/src/job-match.ts` | **Missing.** No equal-average sub-requirement rating or rounding trace. | Implement requirement-level scoring and integer rounding with visible trace. |
| **Rule 17** (Overlapping Dates Union) | `packages/domain/src/resume-scoring.ts:144` | **Missing.** Concurrent jobs currently add independent tenure durations. | Implement interval union algorithm to prevent double-counting calendar months. |
| **Rule 19** (Free / Paid Parity) | `apps/web/src/app/api/reviews/route.ts:204` | **Correct in base score, missing Paid enhancements.** Same base score used, but Paid tier does not provide P0–P3 or S/M/L plan. | Retain identical base score; generate structured Paid action plan. |

---

## 3. Critical Architectural Ambiguities & Resolutions

### 3.1 Investigation of Missing Rule 04
- **Question:** What is the exact content and location of Rule 04?
- **Finding:** Rule 04 is titled **"Career adaptation"** located in worksheet `Cumulative scoring rules | exact formulas and boundaries`, Row 6.
- **Exact Rule Wording:**
  > *"Keep the same weights for every career stage. Judge the target-appropriate evidence, not duration, prestige or volume. Select user-confirmed target, language, market and document type before assessment."*
- **Example / Limit:**
  > *"A fresher and a 30+ year professional can both earn full capability points using different relevant evidence."*
- **Resolution:** Rule 04 governs the integration of Sheet 9 (`Same weights, context-appropriate evidence`). It strictly forbids altering parameter weights for freshers, career switchers, or senior executives.

### 3.2 Visual Page Inspection Policy (Rule 18 vs. 3-Page Cap)
- **Question:** Does inspecting only 3 pages satisfy Rule 18?
- **Finding:** Rule 18 mandates: *"Visually inspect all rendered pages at usable viewing sizes. Evaluate hierarchy, legibility, spacing, consistency, flow and contrast."*
- **Code Reality:** `processing/resume_worker/ai.py` currently has `max_pages = 3` to limit API token consumption.
- **Resolution:**
  - For standard resumes (1–3 pages): 100% of pages are inspected by Gemini Vision and OpenCV.
  - For resumes with $>3$ pages (e.g. academic CVs, federal applications): OpenCV geometrically analyzes **all** pages for margins, tables, and contrast. Gemini Vision inspects pages 1–3 in high resolution and evaluates whole-document page flow (V05) using PyMuPDF page layout metadata.
  - If any page fails to render, V01–V06 must be held as `Pending` rather than assuming zero or passing.

### 3.3 N/A and Pending Mathematical Interaction
- **Question:** How do N/A and Pending interact during score calculation?
- **Finding:** Rule 05 explicitly specifies: **"Pending stays in that denominator. Never move weight between pillars."**
- **Exact Mathematical Behavior:**
  - Parameters marked `N/A` are removed from the active denominator.
  - Parameters marked `Pending` **remain in the denominator** as active parameters because their applicability is valid—only their rating is unresolved!
  - Therefore, non-N/A parameters do NOT absorb weight from Pending parameters.
  - Total confirmed earned points = sum of earned points of `Assessed` parameters.
  - Unresolved maximum = sum of effective maximums of `Pending` parameters.
  - Possible score range = $[\text{Confirmed Earned}, \text{Confirmed Earned} + \text{Unresolved Maximum}]$.

---

## 4. Summary of Code Files Requiring Modification in Phase 4

| Target File | Scope of Change in Phase 4 |
|---|---|
| `packages/domain/src/successpro-v2/types.ts` | **NEW FILE:** Strict types for 20 parameters, statuses, Free/Paid contracts, Rule 01–24 definitions. |
| `packages/domain/src/successpro-v2/parameter-registry.ts` | **NEW FILE:** Authoritative registry of C01–C09, V01–V06, J01–J05 with base weights (50/25/25 and 65/35/0). |
| `packages/domain/src/successpro-v2/rating-rubric.ts` | **NEW FILE:** Observable scoring anchors (0–5) and evaluation guidelines. |
| `packages/domain/src/successpro-v2/scoring-engine.ts` | **NEW FILE:** Core mathematical engine implementing Rules 01–24, intra-pillar N/A redistribution, and Pending reservation. |
| `packages/domain/src/successpro-v2/career-adaptation.ts` | **NEW FILE:** 15 career context rules adapting evidence expectations without altering weights. |
| `packages/domain/src/successpro-v2/paid-enhancer.ts` | **NEW FILE:** Root-cause, recruiter impact, factual rewrite templates, and P0–P3 / S/M/L action plans. |
| `packages/domain/src/successpro-v2/index.ts` | **NEW FILE:** Unified export module for SuccessPro v2. |
| `packages/domain/src/index.ts` | Export `successpro-v2` alongside legacy scoring for backward compatibility. |
| `apps/web/src/app/api/reviews/route.ts` | Support `rubricVersion: "successpro-v2"` with version-aware score persistence. |
| `apps/web/src/components/resume-review.tsx` | Render v2 20-parameter breakdown, Pending score range, and Paid tier action plan. |
