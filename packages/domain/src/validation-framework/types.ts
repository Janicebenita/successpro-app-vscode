export interface BenchmarkResumeEntry {
  id: string;
  category:
    | "excellent"
    | "average"
    | "poor"
    | "ats-friendly"
    | "ats-unfriendly"
    | "single-column"
    | "multi-column"
    | "graphic-heavy"
    | "scanned-pdf"
    | "docx"
    | "missing-sections"
    | "unusual-formatting";
  documentType: "pdf" | "docx" | "txt";
  text: string;
  jobDescription?: string;
  documentSignals?: {
    multiColumn?: boolean;
    tableHeavy?: boolean;
    imageOnly?: boolean;
    pageCount?: number;
    fontCount?: number;
    minimumFontSize?: number;
    hasVisualEvidence?: boolean;
    criticalContentInHeaderFooter?: boolean;
    excessiveColor?: boolean;
    inconsistentMargins?: boolean;
  };
  expectedFields: {
    name?: string;
    email?: string;
    phone?: string;
    hasExperience?: boolean;
    hasEducation?: boolean;
    hasSkills?: boolean;
    datesExpectedCount?: number;
  };
  humanReferenceRatings: {
    contentQuality: number; // 0 - 100
    visualQuality: number | null; // 0 - 100
    atsCompatibility: number; // 0 - 100
    overallScore: number; // 0 - 100
    reviewerScores?: number[];
  };
  rationale: string;
}

export interface ExtractionMetrics {
  precision: number;
  recall: number;
  f1: number;
  fieldAccuracy: {
    name: number;
    email: number;
    phone: number;
    experience: number;
    education: number;
    skills: number;
    dates: number;
  };
}

export interface ScoreAgreementMetrics {
  meanAbsoluteError: number;
  spearmanRankCorrelation: number;
  scoreVarianceAcrossRuns: number;
  categoryAccuracy: Record<string, number>;
}

export interface BenchmarkEvaluationReport {
  totalResumesAnalyzed: number;
  extractionMetrics: ExtractionMetrics;
  scoreAgreement: ScoreAgreementMetrics;
  timestamp: string;
}
