# SUCCESSPRO v2 — UNRESOLVED REQUIREMENTS & DECISION LEDGER
**Authoritative Reference:** SuccessPro v2 Excel Workbook Specification  
**Current Codebase:** `D:\successpro-app-vscode`  
**Generated:** 2026-11-14  
**Status:** Audit Ledger for Architectural Review Prior to Phase 4

---

## 1. Recovered Requirements

### 1.1 Recovery of Rule 04 (Career Adaptation)
- **Status:** **RECOVERED & VERIFIED FROM WORKBOOK.**
- **Location:** Worksheet `Cumulative scoring rules | exact formulas and boundaries`, Row 6.
- **Title:** `Rule 04: Career adaptation`
- **Exact Text:**
  > *"Keep the same weights for every career stage. Judge the target-appropriate evidence, not duration, prestige or volume. Select user-confirmed target, language, market and document type before assessment."*
- **Example / Bound:**
  > *"A fresher and a 30+ year professional can both earn full capability points using different relevant evidence."*
- **Impact on System:**
  - Guarantees that parameter weights never change dynamically based on user seniority.
  - Links to Worksheet 9 (`Same weights, context-appropriate evidence`) across all 15 career contexts.

---

## 2. Technical Ambiguities Investigated & Proposed Technical Resolutions

### 2.1 Multi-Page Visual Inspection Policy (Rule 18 vs. Worker Latency)
- **Workbook Specification:** Rule 18 states: *"Visually inspect all rendered pages at usable viewing sizes. Evaluate hierarchy, legibility, spacing, consistency, flow and contrast. All 25/35 visual points concern human visual presentation."*
- **Current Worker Reality:** `processing/resume_worker/ai.py` currently limits multimodal Gemini Vision API payload to `max_pages = 3` to avoid exceeding token windows or incurring excessive latency on 10+ page CVs.
- **Proposed Architecture Resolution:**
  1. For resumes of 1–3 pages (covering $>95\%$ of commercial candidates): 100% of pages are rendered and inspected by both OpenCV and Gemini Vision.
  2. For resumes $>3$ pages: OpenCV inspects **all** rendered pages for margins, alignment, contrast, and layout collisions. PyMuPDF extracts full-document font metadata across all pages. Gemini Vision receives pages 1–3 at high resolution and is supplied the full-document layout structure to evaluate flow and transitions for V05.
  3. If any page fails to render due to file corruption, visual parameters affected are held as `Pending`.

### 2.2 Whole-Pillar N/A Boundary Condition (Rule 08)
- **Workbook Rule 08:** *"A whole pillar unavailable means cumulative score pending; do not reassign its share. No-JD mode legitimately excludes the entire J pillar."*
- **Workbook Rule 05:** *"A genuinely inapplicable parameter is excluded only from its own pillar... Never move weight between pillars."*
- **Scenario:** What if all parameters in Content were somehow marked N/A?
- **Resolution:** By mathematical definition, Content cannot be completely N/A because C01, C02, C03, C04, C06, C07, C09 are designated as "Always applicable". However, if an entire pillar has zero active parameters, the engine will NOT redistribute that pillar's weight into other pillars. The cumulative score is held as `Pending`.

### 2.3 Display Row Rounding Discrepancies (Rule 09)
- **Workbook Rule 09:** *"Independent row rounding can cause displayed row sums to differ by 0.1; footnote rounding rather than quietly changing a weight."*
- **Scenario:** The sum of displayed parameters (rounded to 1 decimal place) may equal 79.9 or 80.1, while the unrounded total is 80.0.
- **Resolution:**
  - Internal calculations maintain full IEEE 754 64-bit floating point precision.
  - The cumulative total is computed by summing unrounded earned points, then rounding to 1 decimal place.
  - When the sum of displayed row points differs by $\pm 0.1$ from the displayed cumulative total, the UI displays a standard footnote: *"Displayed individual parameter points are rounded to one decimal place; the cumulative total is calculated from exact values."*

### 2.4 Corrupted or Unreadable Pages & OCR Failures (Sheet 11 Gate)
- **Scenario:** A PDF has 3 pages, but page 2 has corrupted raster streams or illegible scanned text.
- **Resolution:**
  - Technical check 2 & 4 trigger: `unreliable_text_extraction` or `corrupt_page_render`.
  - Dependent content and visual parameters are marked `Pending`.
  - The analysis is paused with diagnostic recovery guidance rather than penalizing the candidate with zero points.

---

## 3. Decisions Confirmed for Phase 4 Implementation

1. **Scoring Formula:**
   $$\text{Earned Points} = \text{Effective Max Weight} \times \left(\frac{\text{Rating}}{5}\right)$$
2. **Intra-Pillar N/A Redistribution:**
   $$\text{Effective Max Weight}_i = \text{Pillar Max} \times \frac{\text{Base Weight}_i}{\sum_{j \in \text{Active in Pillar}} \text{Base Weight}_j}$$
   *(Note: Pending parameters remain in the active denominator per Rule 05).*
3. **Pending Score Range:**
   $$\text{Possible Score Range} = [\text{Confirmed Earned}, \text{Confirmed Earned} + \text{Pending Max}]$$
4. **No-JD Multipliers:** Content base weights $\times 1.3$, Visual base weights $\times 1.4$, Job Match $= 0$.
5. **Free/Paid Parity:** Exact identical mathematical scoring engine; Paid tier enriches output with P0–P3 action plan, S/M/L effort, recruiter impact, and factual rewrite templates.
