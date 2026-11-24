import React from "react";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const wholeWords = (word: string) => [word];
function T(props: React.ComponentProps<typeof Text>) {
  return <Text hyphenationCallback={wholeWords} {...props} />;
}
import type { ResumeAnalysisResult } from "@successpro/contracts";
import type { AiTaskOutput } from "@successpro/contracts/ai";

// Paid report layout only. It presents existing SuccessPro results and never calculates scores.

type V2 = NonNullable<ResumeAnalysisResult["v2"]>;
type Parameter = V2["parameters"][number];
type Action = NonNullable<V2["paidReport"]>["actionPlan"][number];

export type PaidReportInput = {
  result: ResumeAnalysisResult;
  summary?: AiTaskOutput<"analyzeResume">;
  explanations?: Record<string, AiTaskOutput<"explainResumeIssue">>;
  targetRole?: string;
  completedOn: string;
};

// Carlito is metric-compatible with Calibri (SIL Open Font License). Falls back to Helvetica if absent.
function reportFontFamily() {
  const directory = [resolve(process.cwd(), "public/fonts/report"), resolve(process.cwd(), "apps/web/public/fonts/report")]
    .find((candidate) => existsSync(resolve(candidate, "Carlito-Regular.ttf")));
  if (!directory) return "Helvetica";
  Font.register({
    family: "Carlito",
    fonts: [
      { src: resolve(directory, "Carlito-Regular.ttf") },
      { src: resolve(directory, "Carlito-Bold.ttf"), fontWeight: 700 },
      { src: resolve(directory, "Carlito-Italic.ttf"), fontStyle: "italic" },
      { src: resolve(directory, "Carlito-BoldItalic.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  });
  return "Carlito";
}
let family: string | undefined;

const INK = "#000000";
const MUTED = "#595959";
const RULE = "#A6A6A6";
const FAINT = "#BFBFBF";
const BAR = "#4472C4";
const CALLOUT = "#E2EFDA";

function styles(fontFamily: string) {
  return StyleSheet.create({
    page: { paddingTop: 80, paddingBottom: 58, paddingHorizontal: 40, fontFamily, fontSize: 10.5, lineHeight: 1.32, color: INK },
    brand: { position: "absolute", top: 30, left: 40, right: 40, textAlign: "right", fontSize: 16, fontWeight: 700 },
    brandRule: { position: "absolute", top: 54, left: 40, right: 40, borderBottomWidth: 1.5, borderColor: INK },
    footerLeft: { position: "absolute", top: 806, left: 40, fontSize: 8.5, color: "#8C8C8C" },
    footerRight: { position: "absolute", top: 806, left: 40, right: 40, fontSize: 8.5, color: "#8C8C8C", textAlign: "right" },
    title: { fontSize: 21, fontWeight: 700, textAlign: "center", marginTop: 6, marginBottom: 14 },
    meta: { marginBottom: 1.5 },
    bold: { fontWeight: 700 },
    italic: { fontStyle: "italic" },
    muted: { color: MUTED },
    rule: { borderBottomWidth: 0.75, borderColor: RULE, marginTop: 10, marginBottom: 10 },
    tocTitle: { fontWeight: 700, marginBottom: 3 },
    tocItem: { flexDirection: "row", marginLeft: 14, marginBottom: 1 },
    tocNumber: { width: 18 },
    h1: { fontSize: 11, fontWeight: 700, marginBottom: 5 },
    h2: { fontWeight: 700, marginTop: 6, marginBottom: 2 },
    paragraph: { textAlign: "justify", marginBottom: 5 },
    bulletRow: { flexDirection: "row", marginLeft: 14, marginBottom: 2.5 },
    bulletMark: { width: 14 },
    bulletBody: { flex: 1, textAlign: "justify" },
    numberRow: { flexDirection: "row", marginLeft: 14, marginBottom: 3 },
    numberMark: { width: 18 },
    table: { borderTopWidth: 0.75, borderColor: RULE, marginTop: 2 },
    tr: { flexDirection: "row", borderBottomWidth: 0.75, borderColor: RULE, paddingVertical: 2.5 },
    th: { fontWeight: 700 },
    groupRow: { flexDirection: "row", borderBottomWidth: 0.75, borderColor: RULE, paddingVertical: 2.5, backgroundColor: "#F2F2F2" },
    cell: { paddingHorizontal: 4 },
    total: { fontWeight: 700, marginTop: 3 },
    chartTitle: { textAlign: "center", fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 6 },
    chartRow: { flexDirection: "row", alignItems: "center", height: 13 },
    chartLabel: { width: 205, paddingRight: 6, textAlign: "right", fontSize: 7.6, color: MUTED, lineHeight: 1 },
    chartTrack: { flex: 1, height: 13, justifyContent: "center" },
    chartBar: { height: 7.5, backgroundColor: BAR },
    chartAxis: { flexDirection: "row", marginLeft: 205, marginTop: 2 },
    chartTick: { fontSize: 7.6, color: MUTED, lineHeight: 1 },
    legend: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 6, fontSize: 7.6, color: MUTED },
    legendSwatch: { width: 7, height: 7, backgroundColor: BAR, marginRight: 4 },
    callout: { backgroundColor: CALLOUT, paddingHorizontal: 16, paddingVertical: 14, marginTop: 14 },
    calloutTitle: { fontSize: 12.5, lineHeight: 1.2, marginBottom: 4 },
    calloutLead: { fontSize: 17, lineHeight: 1.2, marginBottom: 6 },
    quote: { fontStyle: "italic" },
  });
}
type S = ReturnType<typeof styles>;

const PILLARS: Array<{ id: "content" | "visual" | "jobMatch"; label: string }> = [
  { id: "content", label: "Resume / content" },
  { id: "visual", label: "Visual presentation" },
  { id: "jobMatch", label: "Job match" },
];

function clean(text?: string | null) {
  return (text ?? "").replace(/;?\s*resume characters \d+-\d+/gi, "").replace(/\.\s*:/g, ":").replace(/\s+/g, " ").trim();
}
function points(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
function ratingText(row: Parameter) {
  if (row.status === "Assessed" && row.rating !== null) return `${row.rating}/5`;
  return row.status === "N/A" ? "N/A" : "Pending";
}
function rowComment(row: Parameter) {
  if (row.status !== "Assessed") return clean(row.naOrPendingReason) || (row.status === "N/A" ? "Not applicable to this review." : "Assessment pending.");
  return clean(row.anchorComparison?.justification) || clean(row.evidence.rationale);
}
function pillarStatus(state: V2["pillars"]["content"]["state"]) {
  return state === "Excluded" ? "Excluded (no job description)" : state === "Assessed" ? "Complete" : state === "Partial" ? "Partially assessed" : "Pending";
}
function resumeQuotes(row?: Parameter) {
  if (!row) return [] as string[];
  return [row.evidence.excerpt, ...(row.evidence.additionalExcerpts ?? []).map((item) => item.excerpt)].map(clean).filter(Boolean);
}
// Only quote an action line when it is the parameter's own linked resume evidence.
function verifiedOriginal(action: Action, row?: Parameter) {
  const line = clean(action.originalLine);
  if (!line || !row || row.pillar === "visual") return "";
  return resumeQuotes(row).some((quote) => quote.includes(line) || line.includes(quote)) ? line : "";
}

function Rule({ s }: { s: S }) {
  return <View style={s.rule} />;
}
function Bullet({ s, label, children }: { s: S; label?: string; children: React.ReactNode }) {
  return (
    <View style={s.bulletRow} wrap={false}>
      <T style={s.bulletMark}>•</T>
      <T style={s.bulletBody}>{label ? <T style={s.bold}>{label}: </T> : null}{children}</T>
    </View>
  );
}
function Heading({ s, children }: { s: S; children: React.ReactNode }) {
  return <T style={s.h1} minPresenceAhead={60}>{children}</T>;
}

function PerformanceChart({ s, rows }: { s: S; rows: Parameter[] }) {
  const rated = rows.filter((row) => row.status === "Assessed" && row.rating !== null);
  if (!rated.length) return null;
  return (
    <View wrap={false} style={{ marginTop: 6, marginBottom: 4 }}>
      <T style={s.chartTitle}>Performance Summary</T>
      <View style={{ position: "relative" }}>
        {[0, 1, 2, 3, 4, 5].map((tick) => (
          <View key={tick} style={{ position: "absolute", top: 0, bottom: 0, left: `${(205 + tick * ((515 - 205) / 5)) / 515 * 100}%`, borderLeftWidth: 0.5, borderColor: "#D9D9D9" }} />
        ))}
        {rated.map((row) => (
          <View key={row.id} style={s.chartRow}>
            <T style={s.chartLabel}>{row.name}</T>
            <View style={s.chartTrack}>
              <View style={[s.chartBar, { width: `${(row.rating! / 5) * 100}%` }]} />
            </View>
          </View>
        ))}
      </View>
      <View style={s.chartAxis}>
        {[0, 1, 2, 3, 4, 5].map((tick) => (
          <T key={tick} style={[s.chartTick, { width: tick === 5 ? 10 : `${100 / 5}%` }]}>{tick}</T>
        ))}
      </View>
      <View style={s.legend}>
        <View style={s.legendSwatch} />
        <T>Rating (0–5)</T>
      </View>
    </View>
  );
}

function PaidReport({ input, fontFamily }: { input: PaidReportInput; fontFamily: string }) {
  const s = styles(fontFamily);
  const result = input.result;
  const v2 = result.v2!;
  const completed = v2.scoreStatus === "completed" && result.score !== null;
  const byId = new Map(v2.parameters.map((row) => [row.id, row]));
  const actions = v2.paidReport?.actionPlan ?? [];
  const withJd = v2.mode === "with_job_description";
  const jRows = v2.parameters.filter((row) => row.pillar === "jobMatch");
  const requirements = v2.requirements ?? [];
  const topActions = (input.summary?.topActions ?? []).filter((item) => clean(item.suggestion));
  const findings = result.gapRiskAnalysis?.findings ?? [];
  const notes = [...v2.mandatoryGaps, ...v2.operationalWarnings].map(clean).filter(Boolean);
  const scoreLine = completed ? `${points(result.score!)} / 100` : "Pending (assessment incomplete)";
  const sections = ["Executive Overview", "Performance Summary", "Role Fit Mapping", "Parameter-by-Parameter Analysis", "Strategic Recommendations", "Advisory Checks", "Final Score Breakdown"];
  const overview = clean(input.summary?.summary);
  const nextStep = actions[0];

  return (
    <Document title="SuccessPro Professional Resume Evaluation Report" author="SuccessPro" creator="SuccessPro" producer="SuccessPro">
      <Page size="A4" style={s.page}>
        <T fixed style={s.brand}>SuccessPro</T>
        <View fixed style={s.brandRule} />
        <T fixed style={s.footerLeft}>Confidential – SuccessPro Resume Evaluation</T>
        <T fixed style={s.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />

        <T style={s.title}>PROFESSIONAL RESUME EVALUATION REPORT</T>
        {input.targetRole ? <T style={s.meta}><T style={s.bold}>Target Role: </T>{clean(input.targetRole)}</T> : null}
        <T style={s.meta}><T style={s.bold}>Evaluation Mode: </T>{withJd ? "With job description" : "Without job description"}</T>
        <T style={s.meta}><T style={s.bold}>Date: </T>{input.completedOn}</T>
        <T style={s.meta}><T style={s.bold}>Final Score: </T>{scoreLine}</T>
        {completed && v2.descriptiveBand ? <T style={s.meta}><T style={s.bold}>Assessment: </T>{v2.descriptiveBand}</T> : null}

        <PerformanceChart s={s} rows={v2.parameters} />

        <Rule s={s} />
        <View wrap={false}>
          <T style={s.tocTitle}>TABLE OF CONTENTS</T>
          {sections.map((name, index) => (
            <View key={name} style={s.tocItem}><T style={s.tocNumber}>{index + 1}.</T><T>{name}</T></View>
          ))}
        </View>
        <Rule s={s} />

        {/* 1. Executive Overview */}
        <Heading s={s}>1. Executive Overview</Heading>
        {overview ? <T style={s.paragraph}>{overview}</T> : <T style={s.paragraph}>The detailed written overview is not available for this review. The assessed criteria and recommendations below are based on the evidence verified so far.</T>}
        {!completed ? <T style={[s.paragraph, s.bold]}>This evaluation is incomplete. Some criteria are still pending, so the final score will be published once every required assessment is complete.</T> : null}
        {(input.summary?.limitations ?? []).map(clean).filter(Boolean).map((item, index) => <T key={index} style={[s.paragraph, s.italic]}>{item}</T>)}

        <Rule s={s} />
        {/* 2. Performance Summary */}
        <Heading s={s}>2. Performance Summary</Heading>
        <View style={s.table}>
          <View style={[s.tr, s.th]} wrap={false} fixed={false}>
            <T style={[s.cell, { width: "34%" }]}>Parameter</T>
            <T style={[s.cell, { width: "11%" }]}>Rating</T>
            <T style={[s.cell, { width: "55%" }]}>Comments</T>
          </View>
          {PILLARS.map((pillar) => {
            const rows = v2.parameters.filter((row) => row.pillar === pillar.id);
            if (pillar.id === "jobMatch" && v2.pillars.jobMatch.state === "Excluded") return null;
            return (
              <React.Fragment key={pillar.id}>
                <View style={s.groupRow} wrap={false} minPresenceAhead={30}><T style={[s.cell, s.bold]}>{pillar.label}</T></View>
                {rows.map((row) => (
                  <View key={row.id} style={s.tr} wrap={false}>
                    <T style={[s.cell, s.bold, { width: "34%" }]}>{row.name}</T>
                    <T style={[s.cell, { width: "11%" }]}>{ratingText(row)}</T>
                    <T style={[s.cell, { width: "55%" }]}>{rowComment(row)}</T>
                  </View>
                ))}
              </React.Fragment>
            );
          })}
        </View>
        <T style={s.total}>Total Score: {scoreLine}</T>
        {completed && v2.descriptiveBand ? <T style={[s.paragraph, s.italic, { marginTop: 8 }]}>Overall assessment: {v2.descriptiveBand}.</T> : null}

        <Rule s={s} />
        {/* 3. Role Fit Mapping */}
        <Heading s={s}>3. Role Fit Mapping</Heading>
        {!withJd ? (
          <T style={s.paragraph}>No job description was supplied, so job-match criteria were excluded from this review. Add a job description to see how the resume maps to a specific role.</T>
        ) : (
          <View>
            {input.targetRole ? <T style={s.meta}><T style={s.bold}>Role Title: </T>{clean(input.targetRole)}</T> : null}
            {jRows.map((row) => {
              const owned = requirements.filter((item) => item.owner === row.id);
              const tip = actions.find((item) => item.parameterId === row.id);
              return (
                <View key={row.id} wrap={owned.length > 4}>
                  <T style={s.h2}>{row.name} ({ratingText(row)})</T>
                  {row.status !== "Assessed" ? <Bullet s={s} label="Status">{clean(row.naOrPendingReason) || "Not assessed."}</Bullet> : null}
                  {owned.map((item) => (
                    <View key={item.id}>
                      <Bullet s={s} label={item.mandatory ? "Requirement (mandatory)" : "Requirement"}>{clean(item.sourceText)}{item.rating !== null ? ` (${item.rating}/5)` : ""}</Bullet>
                      {clean(item.evidence.excerpt) ? <Bullet s={s} label="Alignment"><T style={s.quote}>“{clean(item.evidence.excerpt)}”</T>{clean(item.evidence.rationale) ? ` ${clean(item.evidence.rationale)}` : ""}</Bullet> : null}
                    </View>
                  ))}
                  {row.issues.map((issue, index) => <Bullet key={index} s={s} label="Gap">{clean(issue.message)}</Bullet>)}
                  {tip ? <Bullet s={s} label="Actionable Fit Tip">{clean(tip.howToCorrect)}</Bullet> : null}
                </View>
              );
            })}
          </View>
        )}

        <Rule s={s} />
        {/* 4. Parameter-by-Parameter Analysis */}
        <Heading s={s}>4. Parameter-by-Parameter Analysis</Heading>
        {PILLARS.filter((pillar) => pillar.id !== "jobMatch").map((pillar) => (
          <View key={pillar.id}>
            {v2.parameters.filter((row) => row.pillar === pillar.id).map((row, rowIndex) => {
              const quote = clean(row.evidence.excerpt);
              const assessment = clean(row.anchorComparison?.justification) || clean(row.evidence.rationale);
              const gap = clean(row.anchorComparison?.nextAnchorGap);
              return (
                <View key={row.id} wrap={false}>
                  {rowIndex === 0 ? <T style={[s.h2, { textDecoration: "underline" }]}>{pillar.label}</T> : null}
                  <T style={s.h2}>{row.name} ({ratingText(row)})</T>
                  {row.status !== "Assessed" ? <Bullet s={s} label="Status">{clean(row.naOrPendingReason) || "Not assessed."}</Bullet> : null}
                  {row.status === "Assessed" && quote ? <Bullet s={s} label={row.pillar === "visual" ? "Observed" : "Evidence"}>{row.pillar === "visual" ? quote : <T style={s.quote}>“{quote}”</T>}{clean(row.evidence.location) ? <T style={s.muted}> ({clean(row.evidence.location)})</T> : null}</Bullet> : null}
                  {row.status === "Assessed" && assessment && assessment !== quote ? <Bullet s={s} label="Assessment">{assessment}</Bullet> : null}
                  {row.issues.map((issue, index) => <Bullet key={index} s={s} label={issue.severity === "Critical" ? "Critical issue" : "Opportunity"}>{clean(issue.message)}</Bullet>)}
                  {row.status === "Assessed" && gap && !/^no material shortfall\.?$/i.test(gap) && !row.issues.some((issue) => clean(issue.message) === gap) ? <Bullet s={s} label="Next level">{gap}</Bullet> : null}
                </View>
              );
            })}
          </View>
        ))}

        <Rule s={s} />
        {/* 5. Strategic Recommendations */}
        <Heading s={s}>5. Strategic Recommendations</Heading>
        {actions.length ? actions.map((action, index) => {
          const row = byId.get(action.parameterId);
          const original = verifiedOriginal(action, row);
          return (
            <View key={action.parameterId + index} style={{ marginBottom: 3 }} wrap={false}>
              <View style={s.numberRow} wrap={false} minPresenceAhead={24}>
                <T style={s.numberMark}>{index + 1}.</T>
                <T style={s.bulletBody}><T style={s.bold}>{clean(action.issue)}</T> {clean(action.howToCorrect)}</T>
              </View>
              <View style={{ marginLeft: 18 }}>
                <Bullet s={s} label="Priority">{`${action.priority} · ${row?.name ?? action.parameterId} · Effort ${action.effort === "S" ? "under 15 minutes" : action.effort === "M" ? "15–60 minutes" : "over an hour"}`}</Bullet>
                {clean(action.likelyEffect) ? <Bullet s={s} label="Why it matters">{clean(action.likelyEffect)}</Bullet> : null}
                {original ? <Bullet s={s} label="From your resume"><T style={s.quote}>“{original}”</T></Bullet> : null}
              </View>
            </View>
          );
        }) : <T style={s.paragraph}>No further improvement actions were identified for the assessed criteria.</T>}
        {topActions.length ? (
          <View>
            <T style={s.h2} minPresenceAhead={40}>Tailored Guidance</T>
            {topActions.map((item, index) => (
              <View key={index} style={{ marginBottom: 3 }} wrap={false}>
                <View style={s.numberRow}>
                  <T style={s.numberMark}>{index + 1}.</T>
                  <T style={s.bulletBody}><T style={s.bold}>{clean(item.suggestion)}</T>{clean(item.observed) ? ` ${clean(item.observed)}` : ""}</T>
                </View>
                <View style={{ marginLeft: 18 }}>
                  {clean(item.inference) ? <Bullet s={s} label="Why it matters">{clean(item.inference)}</Bullet> : null}
                  {clean(item.originalExcerpt) ? <Bullet s={s} label="Current"><T style={s.quote}>“{clean(item.originalExcerpt)}”</T></Bullet> : null}
                  {clean(item.improvedExample) ? <Bullet s={s} label="Suggested">{clean(item.improvedExample)}</Bullet> : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Rule s={s} />
        {/* 6. Advisory Checks */}
        <Heading s={s}>6. Advisory Checks</Heading>
        <T style={s.paragraph}>These checks are informational and do not change the score. Review each item against your original document.</T>
        {findings.length ? (
          <View style={s.table}>
            <View style={[s.tr, s.th]} wrap={false}>
              <T style={[s.cell, { width: "32%" }]}>Finding</T>
              <T style={[s.cell, { width: "13%" }]}>Severity</T>
              <T style={[s.cell, { width: "55%" }]}>Recommended action</T>
            </View>
            {findings.map((finding) => (
              <View key={finding.id} style={s.tr} wrap={false}>
                <T style={[s.cell, s.bold, { width: "32%" }]}>{clean(finding.title)}</T>
                <T style={[s.cell, { width: "13%" }]}>{finding.severity}</T>
                <T style={[s.cell, { width: "55%" }]}>{clean(finding.recommendedCorrection)}</T>
              </View>
            ))}
          </View>
        ) : <T style={s.paragraph}>No advisory findings were raised.</T>}
        {notes.length ? (
          <View style={{ marginTop: 6 }}>
            <T style={s.h2} minPresenceAhead={24}>Review Notes</T>
            {notes.map((note, index) => <Bullet key={index} s={s}>{note}</Bullet>)}
          </View>
        ) : null}

        <Rule s={s} />
        {/* 7. Final Score Breakdown */}
        <Heading s={s}>7. Final Score Breakdown</Heading>
        <View style={[s.table, { width: "78%" }]}>
          <View style={[s.tr, s.th]} wrap={false}>
            <T style={[s.cell, { width: "40%" }]}>Category</T>
            <T style={[s.cell, { width: "22%" }]}>Points</T>
            <T style={[s.cell, { width: "38%" }]}>Status</T>
          </View>
          {PILLARS.map((pillar) => {
            const value = v2.pillars[pillar.id];
            return (
              <View key={pillar.id} style={s.tr} wrap={false}>
                <T style={[s.cell, s.bold, { width: "40%" }]}>{pillar.label}</T>
                <T style={[s.cell, { width: "22%" }]}>{value.state === "Excluded" ? "N/A" : `${points(value.confirmedEarned)} / ${points(value.fixedMaxPoints)}`}</T>
                <T style={[s.cell, { width: "38%" }]}>{pillarStatus(value.state)}</T>
              </View>
            );
          })}
        </View>
        <T style={s.total}>Total Score: {scoreLine}</T>

        <View wrap={false} style={{ marginTop: 14 }}>
          <T style={s.bold}>Readiness:</T>
          <T style={s.paragraph}>
            {completed
              ? `This resume is assessed as "${v2.descriptiveBand ?? "evaluated"}". Work through the strategic recommendations in order, starting with the highest priority, and confirm every fact before you apply a suggested change.`
              : "The final readiness assessment will be available once every pending criterion has been assessed. The recommendations above already reflect the criteria verified so far."}
          </T>
        </View>

        {nextStep ? (
          <View style={s.callout} wrap={false}>
            <T style={s.calloutTitle}>Your Next Step</T>
            <T style={s.calloutLead}>{clean(nextStep.issue)}</T>
            <T>{clean(nextStep.howToCorrect)}</T>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export function PaidReviewReport({ input }: { input: PaidReportInput }) {
  family ??= reportFontFamily();
  return <PaidReport input={input} fontFamily={family} />;
}
