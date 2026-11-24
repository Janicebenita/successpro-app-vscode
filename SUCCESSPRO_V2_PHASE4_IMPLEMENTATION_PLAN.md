# SUCCESSPRO v2 — PHASE 4 IMPLEMENTATION PLAN
**Authoritative Reference:** SuccessPro v2 Excel Workbook Specification  
**Target Codebase:** `D:\successpro-app-vscode`  
**Generated:** 2026-11-14  
**Status:** Architecture Design (Strict Read-Only — No Code Executed)

---

## 1. Architectural Strategy & Design Principles

To implement the SuccessPro v2 specification with maximum stability and zero regressions:
1. **Isolated Domain Module:** Build the authoritative v2 engine in `packages/domain/src/successpro-v2/`.
2. **Preserve Legacy Scoring:** Keep existing `resume-scoring.ts` intact for historical report lookups and backward compatibility.
3. **Dual-Version Dispatcher:** Use `rubricVersion: "successpro-v2"` to route new analyses to the v2 engine while allowing historical reports to render using their stored scores.
4. **100% Free/Paid Parity:** Execute the exact same mathematical calculation for Free and Paid tiers; extend Paid tier with diagnostic enrichments (root-cause, recruiter impact, factual rewrite templates, P0–P3 / S/M/L plan).
5. **Airtight Mathematical Rigor:** Enforce Rule 05 intra-pillar N/A redistribution and Rule 07 Pending reservation with internal float precision.

---

## 2. Directory & Module Structure to Create in Phase 4

```
packages/domain/src/successpro-v2/
├── types.ts                    # Strict TypeScript interfaces, enums, and Zod schemas
├── parameter-registry.ts       # 20-parameter authoritative registry & base weights (50/25/25 and 65/35/0)
├── rating-rubric.ts            # 0–5 observable anchors & evaluation scope for C01–C09, V01–V06, J01–J05
├── scoring-engine.ts           # Core calculation engine: Rules 01–24, N/A redistribution, Pending ranges
├── career-adaptation.ts        # 15 career context evidence rules (Freshers, Executives, Breaks, etc.)
├── paid-enhancer.ts            # P0–P3 prioritization, S/M/L effort, recruiter impact, rewrite templates
├── date-intervals.ts           # Calendar date interval union algorithm (Rule 17)
├── index.ts                    # Module entrypoint exporting evaluateSuccessProV2
└── tests/
    ├── scoring-engine.test.ts  # Verification tests for all 24 rules and edge cases
    └── career-adaptation.test.ts # Verification tests for 15 career contexts
```

---

## 3. Module Specifications & Contracts

### 3.1 `types.ts`
Defines the strict contracts for parameters, evaluations, and results:
```typescript
export type ParameterId = 
  | "C01" | "C02" | "C03" | "C04" | "C05" | "C06" | "C07" | "C08" | "C09"
  | "V01" | "V02" | "V03" | "V04" | "V05" | "V06"
  | "J01" | "J02" | "J03" | "J04" | "J05";

export type PillarId = "content" | "visual" | "jobMatch";

export type ParameterStatus = "Assessed" | "N/A" | "Pending";

export type EvaluationMode = "with_job_description" | "no_job_description";

export interface ParameterEvaluation {
  id: ParameterId;
  pillar: PillarId;
  name: string;
  status: ParameterStatus;
  baseWeight: number;
  effectiveMaxWeight: number;
  rating: number | null; // 0–5 integer if Assessed, null if N/A or Pending
  earnedPoints: number;
  evidence: {
    excerpt: string;
    location?: string;
    rationale: string;
  };
  issues: Array<{
    severity: "Critical" | "Major" | "Minor";
    message: string;
    isMandatoryGap?: boolean;
  }>;
  naOrPendingReason?: string;
}

export interface PillarScoreResult {
  pillar: PillarId;
  fixedMaxPoints: number;
  eligibleBaseWeights: number;
  effectiveMaxTotal: number;
  confirmedEarned: number;
  pendingMaxPoints: number;
  state: "Assessed" | "Partial" | "Pending" | "Excluded";
}

export interface SuccessProV2Result {
  rubricVersion: "successpro-v2";
  mode: EvaluationMode;
  cumulativeScore: number | null; // null if publication gate not satisfied
  scoreStatus: "completed" | "score_pending" | "technical_pause";
  confirmedEarnedPoints: number;
  unresolvedMaximumPoints: number;
  possibleScoreRange: [number, number];
  descriptiveBand?: string; // Rule 23
  pillars: {
    content: PillarScoreResult;
    visual: PillarScoreResult;
    jobMatch: PillarScoreResult;
  };
  parameters: ParameterEvaluation[];
  mandatoryGaps: string[];
  operationalWarnings: string[];
  paidEnhancements?: PaidTierReport;
}
```

### 3.2 `scoring-engine.ts`
Implements the calculation pipeline:
1. **Intake Gate Check (Rule 08):**
   - Check if reliable text was extracted.
   - Check if rendered visual pages exist (if not, V01–V06 $\rightarrow$ `Pending`).
   - Check if meaningful JD supplied (if not, mode $\rightarrow$ `no_job_description`).
2. **Base Weight Initialization (Rules 01 & 02):**
   - If `with_job_description`: Content base = 50, Visual base = 25, Job Match base = 25.
   - If `no_job_description`: Content base = 65 ($1.3\times$), Visual base = 35 ($1.4\times$), Job Match = 0.
3. **Intra-Pillar N/A Redistribution (Rule 05):**
   - For each pillar, sum base weights of non-N/A parameters ($\text{ActiveSum}$). Note: Pending parameters remain in $\text{ActiveSum}$ per Rule 05.
   - For each non-N/A parameter $i$: $\text{EffectiveMax}_i = \text{PillarMax} \times \frac{\text{Base}_i}{\text{ActiveSum}}$.
   - For N/A parameters: $\text{EffectiveMax} = 0$.
4. **Earned Points Calculation (Rule 03):**
   - If `Assessed`: $\text{Earned}_i = \text{EffectiveMax}_i \times \frac{\text{Rating}_i}{5}$.
   - If `Pending`: $\text{Earned}_i = 0$; reserve $\text{EffectiveMax}_i$ in $\text{PendingMaxPoints}$.
   - If `N/A`: $\text{Earned}_i = 0$.
5. **Cumulative Totals & Ranges (Rule 07 & Rule 09):**
   - $\text{ConfirmedEarned} = \sum_{\text{Assessed}} \text{Earned}_i$
   - $\text{UnresolvedMax} = \sum_{\text{Pending}} \text{EffectiveMax}_i$
   - $\text{PossibleRange} = [\text{ConfirmedEarned}, \text{ConfirmedEarned} + \text{UnresolvedMax}]$
   - If any eligible parameter is `Pending`: $\text{ScoreStatus} = \text{"score_pending"}$, $\text{CumulativeScore} = \text{null}$.
   - If all eligible parameters are `Assessed`: $\text{ScoreStatus} = \text{"completed"}$, $\text{CumulativeScore} = \text{ConfirmedEarned}$.
6. **Descriptive Band Mapping (Rule 23):**
   - $<40$: Substantial revision
   - $40\text{–}<60$: Major improvement
   - $60\text{–}<75$: Developing
   - $75\text{–}<90$: Strong foundation
   - $\ge 90$: Strong presentation of evidence

---

## 4. Integration & Backward Compatibility

### 4.1 Backend Route Integration (`apps/web/src/app/api/reviews/route.ts`)
- In `POST /api/reviews`:
  - When evaluating an upload, invoke `evaluateSuccessProV2`.
  - Save full v2 results into Firestore document with `rubricVersion: "successpro-v2"`.
  - Maintain legacy field compatibility (`score`, `contentQualityScore`, `visualDesignScore`, `jobMatchScore`) mapped to v2 pillar totals for backwards-compatible consumers.

### 4.2 Frontend Integration (`apps/web/src/components/resume-review.tsx`)
- Inspect `result.rubricVersion`:
  - If `"successpro-v2"`: Render the 20-parameter detailed breakdown, Pending range alert if visual doc is absent, and the Paid action plan (P0–P3, S/M/L) when user has a paid plan.
  - If legacy: Render existing legacy factor view.
- Ensures existing saved candidate reviews never break or display corrupted layouts.

---

## 5. Verification & Test Plan

1. **Mathematical Verification Tests (Vitest in `packages/domain`):**
   - Execute all 8 test cases defined in `successpro_v2_workbook_verification.json`.
   - Test TC01 (All 4s with JD $\rightarrow$ exactly 80.0/100).
   - Test TC02 (All 4s no JD $\rightarrow$ exactly 80.0/100).
   - Test TC03 & TC04 (Workbook mixed totals $\rightarrow$ 75.0 and 77.4).
   - Test TC05 (C05 N/A redistribution $\rightarrow$ Content remains 50.00, C02 max = 10.869565...).
   - Test TC06 (Pending visuals $\rightarrow$ score pending, confirmed 60, range 60–85).
   - Test TC07 & TC08 (All 0s $\rightarrow$ 0/100; all 5s $\rightarrow$ 100/100).
2. **Career Adaptation Tests:**
   - Test freshers with no corporate experience (verify C02/C03/C04 can earn 5/5 via projects).
   - Test 30+ year veterans with 4-page resumes (verify V05 does not penalize page count).
   - Test career breaks (verify C08 does not penalize gap duration).
3. **Regression Tests:**
   - Run existing test suites (`resume-scoring.test.ts`, `ats-benchmarks.test.ts`, `validation-framework.test.ts`, `route.test.ts`) to ensure 100% pass rate is maintained.
