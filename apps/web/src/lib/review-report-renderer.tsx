import React from "react";
import { Document, Page, StyleSheet, Text, View, Svg, Rect, Path, renderToBuffer } from "@react-pdf/renderer";
import type { ResumeAnalysisResult } from "@successpro/contracts";
import type { AiTaskOutput } from "@successpro/contracts/ai";
import { PaidReviewReport } from "./review-report-paid";

export type ReviewReportInput = {
  result: ResumeAnalysisResult;
  summary?: AiTaskOutput<"analyzeResume">;
  explanations?: Record<string, AiTaskOutput<"explainResumeIssue">>;
  targetRole?: string;
  completedOn: string;
  /** Paid reports use the professional evaluation layout. Defaults to paid when the Paid action plan is present. */
  tier?: "paid" | "free";
};

const s = StyleSheet.create({
  page: { paddingTop: 72, paddingHorizontal: 34, paddingBottom: 40, fontFamily: "Helvetica", fontSize: 8.5, lineHeight: 1.35, color: "#1E293B" },
  header: { position: "absolute", top: 22, left: 34, right: 34, height: 35, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#CBD5E1", paddingBottom: 8 },
  footer: { position: "absolute", bottom: 20, left: 34, right: 34, fontSize: 7, lineHeight: 1, color: "#64748B" },
  title: { fontSize: 20, lineHeight: 1.2, color: "#0F172A", fontWeight: 700, marginBottom: 4 },
  score: { flexDirection: "row", backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, marginBottom: 12, padding: 12, gap: 14 },
  numberBox: { width: 75, alignItems: "center", justifyContent: "center" },
  number: { fontSize: 32, lineHeight: 1.2, color: "#0284C7", fontWeight: 700 },
  numberLabel: { fontSize: 8, lineHeight: 1.3, marginTop: 3, color: "#64748B", fontWeight: 700 },
  scoreCopy: { flex: 1 },
  heading: { fontSize: 12.5, lineHeight: 1.3, fontWeight: 700, color: "#0F172A", marginTop: 12, marginBottom: 6 },
  pillarRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  pillarBox: { flex: 1, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 6, padding: 8 },
  pillarTitle: { fontSize: 7.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase" },
  pillarScore: { fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 2 },
  card: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 6, padding: 9, marginBottom: 7, backgroundColor: "#FFFFFF" },
  cardTitle: { fontSize: 9.5, lineHeight: 1.3, fontWeight: 700, color: "#0F172A", marginBottom: 3 },
  subHeader: { fontSize: 8, fontWeight: 700, color: "#0284C7", marginBottom: 4 },
  label: { fontSize: 7.2, lineHeight: 1.4, fontWeight: 700, color: "#64748B", marginTop: 4, marginBottom: 2 },
  quote: { backgroundColor: "#F1F5F9", borderLeftWidth: 2.5, borderLeftColor: "#0284C7", padding: 6, marginTop: 3, fontSize: 8, color: "#1E293B" },
  consequenceText: { fontSize: 8, lineHeight: 1.35, color: "#991B1B", marginTop: 3 },
  solutionText: { fontSize: 8, lineHeight: 1.35, color: "#166534", marginTop: 3 },
  next: { color: "#15803D", marginTop: 2, fontWeight: 700 },
  note: { fontSize: 7.8, lineHeight: 1.35, color: "#64748B", marginTop: 3 },
  factorGrid: { flexDirection: "row", gap: 9 },
  factorColumn: { width: "49%" },
  factorCard: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 6, padding: 7, marginBottom: 6, fontSize: 7.7, lineHeight: 1.28 },
});

function cleanText(text?: string | null): string {
  if (!text) return "";
  return text.replace(/;?\s*resume characters \d+-\d+/gi, "").trim();
}

function ReviewReport({ input }: { input: ReviewReportInput }) {
  const v2 = input.result.v2;
  const scoreDisplay = input.result.score === null ? "Pending" : String(input.result.score);

  return (
    <Document title="SuccessPro Executive Resume Review" author="SuccessPro" creator="SuccessPro">
      <Page size="A4" style={s.page}>
        <Svg fixed style={{ position: "absolute", top: 22, left: 34, width: 24, height: 24 }} viewBox="0 0 26 26">
          <Rect width="26" height="26" rx="7" fill="#F5C451" />
          <Path d="M13 4 15.6 9.4 21.5 10.2 17.2 14.4 18.2 20.3 13 17.5 7.8 20.3 8.8 14.4 4.5 10.2 10.4 9.4Z" fill="#123253" />
        </Svg>
        <Text fixed style={{ position: "absolute", top: 26, left: 66, fontSize: 13, fontWeight: 700, color: "#0F172A" }}>SuccessPro</Text>
        <Text fixed style={{ position: "absolute", top: 30, right: 34, fontSize: 7, color: "#64748B" }}>
          Executive Resume Review · {input.completedOn}
        </Text>
        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) => `SuccessPro | Your career, clearly presented                                                                            ${pageNumber} / ${totalPages}`}
        />

        {/* Hero Score Box */}
        <Text style={s.title}>Your resume, reviewed.</Text>
        {input.targetRole && <Text style={s.note}>Target Role: {input.targetRole}</Text>}
        <View style={s.score}>
          <View style={s.numberBox}>
            <Text style={s.number}>{scoreDisplay}</Text>
            {input.result.score !== null && <Text style={s.numberLabel}>OUT OF 100</Text>}
          </View>
          <View style={s.scoreCopy}>
            <Text style={{ fontWeight: 700, color: "#0F172A", fontSize: 9.5, marginBottom: 3 }}>
              {v2?.descriptiveBand ? `${v2.descriptiveBand} Presentation` : "Executive Evaluation"}
            </Text>
            <Text>{input.summary?.summary || "Review the findings below to strengthen your content, structure, and presentation."}</Text>
          </View>
        </View>

        {/* Core Pillars Overview */}
        {v2 && (
          <View style={{ marginBottom: 6 }}>
            <View style={s.pillarRow}>
              {Object.values(v2.pillars).map((p) => {
                const pct = p.fixedMaxPoints > 0 ? Math.round((p.confirmedEarned / p.fixedMaxPoints) * 100) : 0;
                const statusLabel = p.state === "Excluded" ? "Excluded (No JD)" : pct >= 90 ? "Exceptional" : pct >= 75 ? "Strong" : pct >= 50 ? "Moderate" : "Needs Work";
                return (
                  <View key={p.pillar} style={s.pillarBox}>
                    <Text style={s.pillarTitle}>{p.pillar === "content" ? "Content Quality" : p.pillar === "visual" ? "Visual Presentation" : "Job Match"}</Text>
                    <Text style={s.pillarScore}>{p.state === "Excluded" ? "N/A" : `${pct}%`}</Text>
                    <Text style={s.note}>{statusLabel}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 1. Strategic Action Plan: Issue, Consequence, Solution, Line Causing Issue, Alternative Line */}
        {v2?.paidReport?.actionPlan && v2.paidReport.actionPlan.length > 0 && (
          <View>
            <Text style={s.heading}>Priority Strategic Action Plan</Text>
            {v2.paidReport.actionPlan.map((action, idx) => {
              const originalLine = action.originalLine;

              return (
                <View key={action.parameterId + idx} style={s.card} wrap={false}>
                  <Text style={s.cardTitle}>
                    {action.priority} · {action.issue}
                  </Text>
                  <Text style={s.subHeader}>
                    Impact Area: {action.parameterId}
                  </Text>

                  {/* Consequence / Risk */}
                  {action.likelyEffect && (
                    <Text style={s.consequenceText}>
                      <Text style={{ fontWeight: 700 }}>Consequence & Recruiter Risk: </Text>
                      {action.likelyEffect}
                    </Text>
                  )}

                  {/* Recommended Solution */}
                  <Text style={s.solutionText}>
                    <Text style={{ fontWeight: 700 }}>Recommended Solution: </Text>
                    {action.howToCorrect}
                  </Text>

                  {originalLine && (
                    <View style={{ marginTop: 4 }}>
                      <Text style={[s.label, { color: "#991B1B", fontWeight: 700 }]}>Resume evidence</Text>
                      <Text style={s.quote}>"{originalLine}"</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* 2. Tailored Line-by-Line Rewrites (Before vs. After from AI) */}
        {Boolean(input.summary?.topActions?.length) && (
          <View>
            <Text style={s.heading}>Targeted Resume Rewrites (Before & After)</Text>
            {input.summary?.topActions?.map((action, index) => (
              <View style={s.card} wrap={false} key={index}>
                <Text style={s.cardTitle}>
                  {String(index + 1).padStart(2, "0")}. {action.suggestion}
                </Text>
                <Text style={{ fontSize: 8, color: "#334155", marginTop: 2 }}>{action.observed}</Text>

                {/* Consequence / Recruiter Inference */}
                {action.inference && (
                  <Text style={s.consequenceText}>
                    <Text style={{ fontWeight: 700 }}>Why this matters: </Text>
                    {action.inference}
                  </Text>
                )}

                {/* Original from Resume */}
                {action.originalExcerpt && (
                  <View style={{ marginTop: 3 }}>
                    <Text style={s.label}>LINE CAUSING ISSUE (FROM YOUR RESUME):</Text>
                    <Text style={[s.quote, { borderLeftColor: "#EF4444", backgroundColor: "#FEF2F2", color: "#991B1B" }]}>
                      "{cleanText(action.originalExcerpt)}"
                    </Text>
                  </View>
                )}

                {/* Improved Approach */}
                {action.improvedExample && (
                  <View style={{ marginTop: 3 }}>
                    <Text style={s.label}>RECOMMENDED ALTERNATIVE / REPLACEMENT LINE:</Text>
                    <Text style={[s.quote, { borderLeftColor: "#15803D", backgroundColor: "#F0FDF4", color: "#166534" }]}>
                      "{action.improvedExample}"
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 3. Comprehensive 20-Parameter Assessment Breakdown */}
        {v2 && (
          <View>
            <Text style={s.heading}>Complete Assessment Criteria Breakdown</Text>
            {v2.parameters.map((p) => {
              const location = cleanText(p.evidence.location);
              const excerpt = cleanText(p.evidence.excerpt);
              const ratingLabel = p.rating === null ? "Unrated" : p.rating === 5 ? "5 / 5 · Exceptional" : p.rating === 4 ? "4 / 5 · Strong" : p.rating === 3 ? "3 / 5 · Acceptable" : `${p.rating} / 5 · Needs Improvement`;
              return (
                <View key={p.id} style={s.card} wrap={false}>
                  <Text style={s.cardTitle}>{p.id} · {p.name}</Text>
                  <Text style={s.subHeader}>Rating: {ratingLabel}</Text>
                  {excerpt ? <Text style={s.quote}>{excerpt}</Text> : null}
                  {location ? <Text style={s.note}>Location: {location}</Text> : null}
                  {p.evidence.rationale ? <Text style={s.note}>{p.evidence.rationale}</Text> : null}
                  {p.issues.map((i, index) => (
                    <Text style={s.consequenceText} key={index}>• {i.severity}: {i.message}</Text>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* 4. Resume Gap & Risk Detection Audit (Download Report Only) */}
        {input.result.gapRiskAnalysis && input.result.gapRiskAnalysis.findings.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={s.heading}>Resume Gap &amp; Risk Detection Audit</Text>
            <Text style={s.note}>
              Independent quality and risk audit identifying timeline gaps, date inconsistencies, missing credentials, and format risks.
            </Text>
            {input.result.gapRiskAnalysis.findings.map((finding) => (
              <View key={finding.id} style={s.card} wrap={false}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <Text style={s.cardTitle}>{finding.title}</Text>
                  <Text style={[s.subHeader, { color: finding.severity === "Critical" ? "#B91C1C" : finding.severity === "High" ? "#C2410C" : "#0284C7" }]}>
                    {finding.severity} Risk · {finding.pageLocation}
                  </Text>
                </View>
                {finding.evidenceExcerpt ? (
                  <Text style={s.quote}>"{finding.evidenceExcerpt}"</Text>
                ) : null}
                <Text style={s.consequenceText}>Finding: {finding.explanation}</Text>
                <Text style={s.note}>Why it matters: {finding.whyItMatters}</Text>
                <Text style={s.solutionText}>Recommended action: {finding.recommendedCorrection}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

export async function renderReviewReport(input: ReviewReportInput) {
  const { editorialStyle } = await import("./editorial-style");
  const styled = editorialStyle(input);
  const paid = (input.tier ?? (input.result.v2?.paidReport ? "paid" : "free")) === "paid" && Boolean(input.result.v2);
  return renderToBuffer(paid ? <PaidReviewReport input={styled} /> : <ReviewReport input={styled} />);
}
