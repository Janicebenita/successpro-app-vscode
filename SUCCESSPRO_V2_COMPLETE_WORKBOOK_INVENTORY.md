# SUCCESSPRO v2 — COMPLETE WORKBOOK INVENTORY
**Authoritative Source:** SuccessPro v2 Excel Workbook Specification  
**Generated:** 2026-11-14  
**Status:** Exhaustive Parameter, Sheet, Rule & Context Inventory

---

## 1. Workbook Structure & Worksheets Inventory

The authoritative workbook contains **15 distinct sheets/sections**:

| # | Sheet / Section Name | Scope & Content |
|---|---|---|
| **1** | **Overview & Specification** | Core principles, ONE cumulative score /100, 50/25/25 and 65/35 splits, smaller 20-parameter framework, shared engine for Free and Paid, technical gates. |
| **2** | **Weights & Rationales** | Parameter definitions, With JD max weights, No JD max weights ($1.3\times$ content, $1.4\times$ visual), rationale, applicability and boundaries for all 20 parameters. |
| **3** | **Free Version** | Complete Free tier requirements, reporting templates, parameter outputs, severity, evidence locator, fairness and integrity rules. |
| **4** | **Paid Version** | Paid tier requirements: identical score + detailed diagnosis, likely effect, correction instructions, factual rewrite templates, clarification discipline, action plan (P0–P3, S/M/L effort). |
| **5** | **Rating Rubric (Anchors)** | Observable scoring anchors for 0 (absent/material failure), 3 (adequate with meaningful gaps), 5 (strong/no material shortfall), plus intermediate ratings 1, 2, 4. |
| **6** | **Calculators With JD** | 50/25/25 model, input gates, synthetic baseline (all rating 4 → 80/100), intra-pillar N/A redistribution formula, Pending reservation. |
| **7** | **Calculators No JD** | 65/35/0 model ($1.3\times$ and $1.4\times$ multiplier), input gates, synthetic baseline (all rating 4 → 80/100), exclusion of J pillar. |
| **8** | **Cumulative Scoring Rules** | Rules 01 through 24: formulas, career adaptation, N/A safeguards, Pending state, rounding, evidence requirements, cross-pillar distinctions, score labels, calibration. |
| **9** | **Career Adaptations** | 15 career contexts: Freshers, Established Professionals, Specialists, Executives, 30+ Years, Academics, Career Changers, Career Breaks, Freelancers, Trades, Regulated Professions, Creatives, International/Military, Multilingual, Federal Applications. |
| **10** | **Feedback Examples** | Concrete worked examples (C02 fresher, C03 confidential outcome, V02 illegible text, V05 30+ years, J02 missing skill, J04 expired licence, C08 career break, Pending visuals, Optional credential N/A). |
| **11** | **Technical & Exceptions** | 12 unscored operational gates: file opening, text extraction/reading order, visual document availability, OCR, links, mandatory requirements ledger, privacy, confidentiality, logistics, untrusted document instructions, fairness, data control. |
| **12** | **Source Mapping** | Complete mapping of 40 original parameter rows (20 Resume + 20 ATS) to the reduced 20-parameter framework. |
| **13** | **Validation & Production Requirements** | 22 validation test cases, expected behaviors, edge case handling, and production acceptance gates. |
| **14** | **Original Resume Score Parameters** | The legacy 20 resume score rows across Resume Content (10), JD Compatibility (5), Format & Design (5). |
| **15** | **Original ATS Score Parameters** | The legacy 20 ATS score rows across Resume Content (10), JD Compatibility (5), Format, Design & ATS Compatibility (5). |

---

## 2. Complete 20-Parameter Inventory

### 2.1 Content Quality Pillar (With JD Max: 50 | No JD Max: 65)

| ID | Parameter Name | With JD Max | No JD Max | Weight Rationale | Applicability / Boundary |
|---|---|---:|---:|---|---|
| **C01** | Role positioning and value proposition | 6 | 7.8 | Early role clarity helps readers understand why evidence matters, but cannot outweigh actual capability. | Always; standalone summary is optional. Assess positioning from other opening content. |
| **C02** | Experience and practical capability evidence | 10 | 13.0 | Strongest direct evidence that applicant can perform useful work; carries largest content weight. | Always for capability-based resume; paid employment is never required. Coursework/projects qualify. |
| **C03** | Achievements and contribution | 8 | 10.4 | Outcomes distinguish contribution from activity and make value of experience understandable. | Always; metrics are optional. Entry-level deliverables or learning outcomes qualify. |
| **C04** | Skills and competency evidence | 7 | 9.1 | Role-relevant skills help reviewers locate capability; contextual evidence more informative than lists. | Always; evaluate capabilities appropriate to target, not arbitrary tool lists or keyword counts. |
| **C05** | Education, credentials and relevant learning | 4 | 5.2 | Credentials matter strongly in some fields, less in others; moderate weight. | Apply when education/training supplied or required. If neither, N/A. J04 owns absent mandatory credentials. |
| **C06** | Essential information and completeness | 5 | 6.5 | Narrative has limited value if reader cannot contact candidate or interpret entries. | Always; optional links, photos, address, LinkedIn and private details are not essentials. |
| **C07** | Clarity, language and concise expression | 4 | 5.2 | Clarity makes evidence easier to assess; cosmetic wording must not outweigh substance. | Always in supported language; no English-default or accent/personality scoring. |
| **C08** | Chronology, consistency and credibility | 3 | 3.9 | Contradictions create avoidable doubt, but non-linear careers and breaks do not imply weak performance. | Apply where dated entries or repeated claims exist; if no chronology to assess, N/A. No gap penalty. |
| **C09** | Content relevance and prioritization | 3 | 3.9 | Selection helps reviewers find strongest case without rewarding fixed length or format. | Always; academic/prescribed CVs may need extensive detail. Length alone assessed in V05. |
| **Total** | **Content Pillar** | **50** | **65.0** | $\sum \text{Base} = 50$; $\text{No JD} = 50 \times 1.3 = 65.0$ | Intra-pillar redistribution only if C05 or C08 is N/A. |

---

### 2.2 Visual Presentation Pillar (With JD Max: 25 | No JD Max: 35)

| ID | Parameter Name | With JD Max | No JD Max | Weight Rationale | Applicability / Boundary |
|---|---|---:|---:|---|---|
| **V01** | Layout, hierarchy and ease of scanning | 6 | 8.4 | Navigation determines how quickly actual evidence becomes visible during human review. | Rendered original required. Creative layouts and recognizable section labels accepted. |
| **V02** | Typography and text legibility | 5 | 7.0 | Evidence cannot help if hard to read; legibility receives second-largest visual weight. | Rendered original required. Assess actual legibility rather than font name or prestige. |
| **V03** | Spacing, alignment and information density | 4 | 5.6 | Good spacing reduces reading effort while retaining useful evidence. | Rendered original required; avoid arbitrary margin or whitespace quotas. |
| **V04** | Visual consistency and professional coherence | 3 | 4.2 | Polish supports trust and navigation but is less important than readability and evidence. | Rendered original required. No penalty for tasteful creative style, photo, or color. |
| **V05** | Page length, flow and space utilization | 4 | 5.6 | Poor page flow can hide content; a fixed page count unfairly penalizes longer careers. | Rendered original required. No universal 1/2-page limit, including 30+ years. |
| **V06** | Contrast, visual accessibility and meaningful graphics | 3 | 4.2 | Accessibility extends readability across readers, devices, and printouts. | Rendered original required. Score communicative accessibility, never aesthetic taste. |
| **Total** | **Visual Pillar** | **25** | **35.0** | $\sum \text{Base} = 25$; $\text{No JD} = 25 \times 1.4 = 35.0$ | Rendered document mandatory. If missing $\rightarrow$ V01–V06 Pending. |

---

### 2.3 Job Match Pillar (With JD Max: 25 | No JD Max: 0)

| ID | Parameter Name | With JD Max | No JD Max | Weight Rationale | Applicability / Boundary |
|---|---|---:|---:|---|---|
| **J01** | Role, responsibility and functional match | 7 | 0 | Doing the actual work is largest component of role-specific fit. | Only with meaningful JD. De-duplicate repeated duties; no title-only matching. |
| **J02** | Required skills and methods match | 6 | 0 | Essential capabilities strongly influence demonstrated match to role. | Only if JD states required skills. Preferred facts belong to J05; no duplicate weighting. |
| **J03** | Experience, scope and seniority match | 5 | 0 | Context and responsibility indicate target-level readiness beyond title. | Only if JD specifies scope/years. Ambiguous dates $\rightarrow$ Pending. No age inference. |
| **J04** | Mandatory qualifications and explicit eligibility | 4 | 0 | True mandatory conditions matter despite strong average, but not required for all jobs. | Only explicit JD credentials. If none, N/A within JD. Unclear status $\rightarrow$ Pending. |
| **J05** | Preferred skills, domain and differentiating fit | 3 | 0 | Additional fit differentiates applicants but must not outweigh core requirements. | Only stated preferred needs. Each atomic requirement has one J owner; absent set = N/A. |
| **Total** | **Job Match Pillar** | **25** | **0** | $\sum \text{Base} = 25$; No JD excludes this pillar entirely ($0$). | If J04 or J05 is N/A, weight redistributes within J pillar only. |

---

## 3. Observable Scoring Anchors (0–5 Integer Rating Scale)

Every parameter is scored on an integer scale from 0 to 5. Intermediate ratings (1, 2, 4) have explicit operational definitions:
- **0 — Absent / Material Failure:** Missing required element or severe material contradiction.
- **1 — Minimal Evidence:** Minimal usable evidence with major structural flaws.
- **2 — Partial Evidence with Important Shortfalls:** Relevant tasks or preparation mentioned, but methods, ownership, or scope largely vague.
- **3 — Adequate with Meaningful Gaps:** Functional evidence present, but context, depth, or attribution needs improvement.
- **4 — Strong with Limited Shortfall:** Clear evidence and credible outcomes with minor omissions.
- **5 — Strong, No Material Shortfall:** Specific, evidence-supported, target-appropriate presentation.

---

## 4. Authoritative Rules Inventory (Rules 01–24)

- **Rule 01 (With JD):** Content max 50, Visuals max 25, Job Match max 25. Exactly ONE cumulative score out of 100.
- **Rule 02 (Without JD):** Content max 65 ($1.3\times$), Visuals max 35 ($1.4\times$). J pillar excluded entirely ($0$). No bonus or penalty for absent JD.
- **Rule 03 (Parameter Points):** Earned Points = Effective Maximum $\times$ (Rating / 5).
- **Rule 04 (Career Adaptation):** Same weights across all career stages. Evidence adapts, not weights.
- **Rule 05 (N/A Normalization):** Redistribution strictly inside same pillar:
  $$\text{Effective Max Weight} = \text{Pillar Total} \times \frac{\text{Parameter Base Weight}}{\sum (\text{Active Base Weights in Pillar})}$$
  Weights never transfer between pillars. Pending parameters remain in denominator.
- **Rule 06 (N/A Safeguards):** Never use N/A to hide actual failure. Missing contact or essential info is an assessed failure (0), not N/A.
- **Rule 07 (Pending/Unknown):** Uninspected visuals, unreliable extraction, or unconfirmed facts = `Pending`. Weight is reserved, not redistributed. Show confirmed earned points and possible range (e.g. "Confirmed 60, possible 60–80").
- **Rule 08 (Final Publication):** Final /100 published only when all non-N/A parameters have valid ratings and evidence, and all intake gates are satisfied.
- **Rule 09 (Rounding):** Full precision preserved internally. Display parameters to 1–2 decimals, total to 1 decimal. Total calculated from unrounded sum.
- **Rule 10 (No Hidden Caps):** No undisclosed penalties, multipliers, or demographic adjustments. Mandatory credential gaps reported as prominent warnings alongside total score.
- **Rule 11 (Evidence & Confidence):** Every rating requires unedited source excerpt and location. Low-confidence interpretations remain Pending.
- **Rule 12 (Deduplicate Within Pillars):** One underlying defect has one primary owner within a pillar. Do not double-deduct across parameters.
- **Rule 13 (Cross-Pillar Distinction):** Distinct questions assessed separately: C02 (capability), J01 (job fit), V01 (visual navigation). Deduct only when each has a distinct failure.
- **Rule 14 (JD Requirements):** Deconstruct JD into atomic requirements, map each to one J parameter (J01–J05).
- **Rule 15 (JD Rating Trace):** Multi-requirement parameters equal-average requirement ratings, rounded to nearest integer (ties upward), with requirement ledger visible.
- **Rule 16 (Missing Evidence vs. Actual Gap):** "Not demonstrated in resume" is an evidence gap, not proof of lack of capability. Real gaps require user confirmation.
- **Rule 17 (Dates & Experience):** Union overlapping calendar intervals; do not double-count concurrent jobs as double tenure.
- **Rule 18 (Human Visual Assessment):** All 25/35 visual points assess human visual presentation and readability, not ATS parsing.
- **Rule 19 (Free & Paid Parity):** Exactly identical cumulative scores, pillar scores, parameter ratings, and issues across Free and Paid.
- **Rule 20 (Rewrite Integrity):** Rewrites use only verified facts and bracketed placeholders (`[actual task]`). Never invent facts or metrics.
- **Rule 21 (Priority & Effort):** P0 (Blockers), P1 (Major Fit), P2 (Clarity), P3 (Polish). Effort: S (<15 min), M (15–60 min), L (>60 min / development).
- **Rule 22 (Versioning & Comparisons):** Track input, rubric, and parser versions. With-JD and No-JD scores are not like-for-like comparisons.
- **Rule 23 (Proposed Score Labels):** <40 (Substantial revision), 40–<60 (Major improvement), 60–<75 (Developing), 75–<90 (Strong foundation), $\ge$90 (Strong presentation of evidence).
- **Rule 24 (Calibration):** Pillar totals (50/25/25 and 65/35) are fixed. Validate anchors with expert human review.

---

## 5. Career Adaptations (15 Contexts)

1. **Fresher / Student / Apprentice:** Coursework, projects, volunteering count toward C02/C03/C04. No paid employment or corporate KPI required.
2. **Early / Established Professional:** Relevant responsibilities and supported outputs. No compulsory promotion or percentage quota of numbers.
3. **Senior Individual Contributor / Specialist:** Depth, technical judgment, complex decisions. Leadership expected only if target role requires it.
4. **Manager / Director / Executive:** Strategy, stakeholder leadership, team/budget stewardship. Do not invent P&L or board exposure.
5. **30+ Years / Portfolio Career:** Relevant earlier contributions grouped; no age inference, no hard 2-page cap.
6. **Academic / Research CV:** Methods, publications, grants. No corporate page limit or brief summary mandate.
7. **Career Change:** Transferable capabilities highlighted; no renaming past roles or fabricating new-domain experience.
8. **Returner / Career Break:** Clear dates; optional neutral break label. No gap penalty or probing into health/family reasons.
9. **Freelance / Gig / Founder:** Services, client context, own deliverables. No funding/famous client requirement.
10. **Trade / Frontline / Informal Work:** Practical craft, safety, quality evidence. No university degree or corporate jargon required.
11. **Regulated Profession:** Accurate credential status visible. Mandatory gaps flagged explicitly in J04.
12. **Creative / Design Portfolio:** Usability and readability assessed. Columns and color accepted when legible.
13. **International / Military / Public Sector:** Transferable scope explained. No nationality inference or prestige ranking.
14. **Multilingual / Non-English:** Declared language evaluated; unsupported languages held as Pending.
15. **Federal / Prescribed Application:** Required application detail overrides generic brevity advice.

---

## 6. Technical & Operational Checks (12 Unscored Gates)

These 12 checks are operational gates and diagnostic findings, **never a fourth scoring pillar or hidden point deduction**:
1. File opening & safe ingestion (type check, macro isolation).
2. Text extraction & reading order integrity.
3. Visual document availability gate (missing rendered doc $\rightarrow$ V01–V06 Pending).
4. Scanned / OCR resume readability verification.
5. External & portfolio link syntax and safety.
6. Mandatory requirements ledger (Demonstrated / Partial / Not demonstrated / Needs clarification).
7. Privacy & sensitive detail protection.
8. Confidentiality & client data protection.
9. Application logistics checklist (unscored).
10. Untrusted document instruction defense (prompt injection isolation).
11. Fairness & counterfactual accessibility testing.
12. User data control, retention, and deletion rights.
