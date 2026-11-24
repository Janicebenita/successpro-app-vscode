export type ParameterId =
  | "C01" | "C02" | "C03" | "C04" | "C05" | "C06" | "C07" | "C08" | "C09"
  | "V01" | "V02" | "V03" | "V04" | "V05" | "V06"
  | "J01" | "J02" | "J03" | "J04" | "J05";

export type PillarId = "content" | "visual" | "jobMatch";

export type ParameterStatus = "Assessed" | "N/A" | "Pending";

export type EvaluationMode = "with_job_description" | "no_job_description";

export type ScorePublicationStatus = "completed" | "score_pending" | "technical_pause";

export type ActionPriority = "P0" | "P1" | "P2" | "P3";

export type ActionEffort = "S" | "M" | "L";

export interface ParameterDefinition {
  id: ParameterId;
  pillar: PillarId;
  name: string;
  baseWeightWithJD: number;
  baseWeightNoJD: number;
  whyThisWeight: string;
  applicability: string;
  scopeOfAssessment: string;
}

export interface RatingAnchors {
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
}

export interface EvidencePayload {
  excerpt: string;
  location?: string;
  rationale: string;
  additionalExcerpts?:Array<{excerpt:string;location?:string;sourceExcerptId?:string}>;
  absenceSearch?:{scope:string;searchedFor:string;outcome:"not_found"};
}

export interface IssuePayload {
  severity: "Critical" | "Major" | "Minor";
  message: string;
  isMandatoryGap?: boolean;
  confirmedBlocker?: boolean;
  rootCause?:{key:string;sourceExcerpt:string;correction:string};
}

export interface AnchorComparison {
  anchor: string;
  justification: string;
  nextAnchorGap: string;
  informationState: "present" | "missing" | "poor" | "uncertain";
}

export interface ParameterEvaluationInput {
  id: ParameterId;
  status: ParameterStatus;
  rating?: number | null; // Integer 0–5 required if Assessed, null/undefined if N/A or Pending
  evidence?: EvidencePayload;
  anchorComparison?: AnchorComparison;
  issues?: IssuePayload[];
  naOrPendingReason?: string;
}

export interface ParameterEvaluationResult {
  id: ParameterId;
  pillar: PillarId;
  name: string;
  status: ParameterStatus;
  baseWeight: number;
  effectiveMaxWeight: number;
  rating: number | null;
  earnedPoints: number;
  originalEarnedPoints?: number;
  evidence: EvidencePayload;
  anchorComparison?: AnchorComparison;
  issues: IssuePayload[];
  naOrPendingReason?: string;
}

export interface PillarScoreResult {
  pillar: PillarId;
  fixedMaxPoints: number;
  eligibleBaseWeights: number;
  effectiveMaxTotal: number;
  confirmedEarned: number;
  originalConfirmedEarned?: number;
  pendingMaxPoints: number;
  state: "Assessed" | "Partial" | "Pending" | "Excluded";
}

export interface PaidActionItem {
  parameterId: ParameterId;
  priority: ActionPriority;
  effort: ActionEffort;
  issue: string;
  likelyEffect: string;
  howToCorrect: string;
  rewriteTemplate: string;
  conditionalPointRecovery: number;
  affectedCriteria?:Array<{parameterId:ParameterId;conditionalPointRecovery:number}>;
  rootCause?:string;
  effortMinutes?:number;
  impactEffortRatio?:number;
  originalLine?: string;
  alternativeLine?: string;
}

export interface PaidTierReport {
  actionPlan: PaidActionItem[];
  prioritiesSummary: {
    p0Count: number;
    p1Count: number;
    p2Count: number;
    p3Count: number;
  };
}

export interface IntakeGates {
  textReliable: boolean;
  visualDocumentAvailable: boolean;
  meaningfulJdSupplied?: boolean;
}

export interface EvaluateResumeV2Input {
  mode: EvaluationMode;
  parameters: ParameterEvaluationInput[];
  intakeGates?: IntakeGates;
  careerContext?: string;
}

export interface SuccessProV2Result {
  rubricVersion: "successpro-v2";
  mode: EvaluationMode;
  cumulativeScore: number | null; // null if any eligible parameter is Pending
  scoreStatus: ScorePublicationStatus;
  confirmedEarnedPoints: number;
  unresolvedMaximumPoints: number;
  possibleScoreRange: [number, number];
  descriptiveBand?: string; // Rule 23
  displayFootnote?: string; // Rule 09 rounding discrepancy note
  pillars: {
    content: PillarScoreResult;
    visual: PillarScoreResult;
    jobMatch: PillarScoreResult;
  };
  parameters: ParameterEvaluationResult[];
  mandatoryGaps: string[];
  operationalWarnings: string[];
  paidReport?: PaidTierReport;
}
