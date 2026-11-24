export type AtsVendor = "greenhouse" | "lever" | "workday";

export interface AtsBenchmarkInput {
  text: string;
  documentSignals?: {
    multiColumn?: boolean;
    tableHeavy?: boolean;
    imageOnly?: boolean;
    pageCount?: number;
    fontCount?: number;
    minimumFontSize?: number;
    criticalContentInHeaderFooter?: boolean;
  };
}

export interface AtsExtractedFields {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedIn: string | null;
  hasExperienceSection: boolean;
  hasEducationSection: boolean;
  hasSkillsSection: boolean;
  dateCount: number;
  readingOrderLinear: boolean;
}

export interface AtsVendorBenchmarkResult {
  vendor: AtsVendor;
  supportedFileTypes: string[];
  extractionSuccess: boolean;
  parsedFields: AtsExtractedFields;
  riskDeductions: Array<{
    rule: string;
    penalty: number;
    description: string;
  }>;
  complianceScore: number; // 0 - 100
  parsingConfidence: number; // 0.0 - 1.0
  recommendations: string[];
}

export interface ComprehensiveAtsReport {
  overallAtsReadinessScore: number;
  vendorBenchmarks: Record<AtsVendor, AtsVendorBenchmarkResult>;
  commonPitfalls: string[];
  unsupportedFormats: string[];
}
