import {describe,it,expect} from "vitest";
import {analyzeResume,analyzeResumeGapsAndRisks,chronologyRatingConflict,ALL_PARAMETER_IDS} from "@successpro/domain";
import {resumeAnalysisResultSchema} from "@successpro/contracts";
import type {AiTaskOutput} from "@successpro/contracts/ai";
import {buildWorkbookReview,projectWorkbookReview} from "./successpro-v2-review";
const text = "Product manager. Delivered a customer portal using SQL. Improved service quality. MBA completed. Contact available. ".repeat(4);
function fixture(jd="") {
 const input = {text,targetKeywords:[] as string[],jobDescription:jd,documentSignals:{extractionReliable:true,hasVisualEvidence:true,pageCount:2,geminiPageFindings:[1,2].map(page=>({page,confidence:.9,observations:[],warnings:[]})),geminiVisualCriteria:ALL_PARAMETER_IDS.filter(id=>id.startsWith("V")).map(code=>({code,rating:4,confidence:.9,pages:[1,2],evidence:"Page evidence",recommendation:"Limited visible shortfall", anchorText: "Strong evidence with a limited shortfall", anchorJustification: "Rendered headings are visible with minor spacing issues.", nextAnchorGap: "Keep heading spacing uniform."}))}};
 const output:AiTaskOutput<"analyzeResume"> = {summary:"Source grounded assessment",topActions:[{observed:"Product manager",inference:"",suggestion:"Clarify scope",originalExcerpt:"",improvedExample:""}],limitations:[],meaningfulJd:!!jd,workbookAssessments:ALL_PARAMETER_IDS.filter(id=>id.startsWith("C")).map(id=>({id,status:"Assessed",rating:4,evidence:{excerpt:"Product manager",rationale:"Supported scope with limited shortfall"}})),jdRequirements:[]};
 return {input,output};
}
describe("live workbook adapter",()=>{
 it("publishes No-JD 65/35 and preserves fractional trace through result serialization",()=>{
  const {input,output}=fixture();const result=buildWorkbookReview(analyzeResume(input),input,output,true);
  expect(result.score).toBe(80);expect(result.v2?.pillars.content.confirmedEarned).toBeCloseTo(52);expect(result.v2?.pillars.visual.confirmedEarned).toBeCloseTo(28);
  expect(resumeAnalysisResultSchema.parse(JSON.parse(JSON.stringify(result)))).toEqual(result);
 });
 it("never promotes client visual signals or legacy content ratings",()=>{
  const {input}=fixture();const result=buildWorkbookReview(analyzeResume(input),input,undefined,false);
  expect(result.score).toBeNull();expect(result.v2?.unresolvedMaximumPoints).toBeCloseTo(100);
 });
 it("distinguishes an existing render from missing Gemini Vision results", () => {
  const {input, output} = fixture();
  input.documentSignals.geminiPageFindings = [];
  input.documentSignals.geminiVisualCriteria = [];
  const report = buildWorkbookReview(analyzeResume(input), input, output, true);
  expect(report.score).toBeNull();
  expect(report.v2?.parameters.filter(row => row.pillar === "visual").every(row =>
    row.status === "Pending" && row.naOrPendingReason?.includes("Document rendered successfully"))).toBe(true);
 });
 it("reserves full visual allocation when any rendered page is missing",()=>{
  const {input,output}=fixture();input.documentSignals.geminiPageFindings.pop();const r=buildWorkbookReview(analyzeResume(input),input,output,true);
  expect(r.score).toBeNull();expect(r.v2?.unresolvedMaximumPoints).toBeCloseTo(35);
 });
 it("rejects headings and visual evidence that echoes its anchor", () => {
  const {input,output}=fixture();
  const heading="INDEPENDENT PUBLISHING & CREATIVE CONTENT PROJECTS";
  input.text += "\n" + heading;
  output.workbookAssessments![0].evidence!.excerpt=heading;
  const visual=input.documentSignals.geminiVisualCriteria[0];
  visual.evidence=visual.anchorText.toUpperCase()+".";
  const report=buildWorkbookReview(analyzeResume(input),input,output,true);
  expect(report.v2?.parameters.find(row=>row.id==="C01")?.status).toBe("Pending");
  expect(report.v2?.parameters.find(row=>row.id===visual.code)?.status).toBe("Pending");
 });
 it("rejects fabricated positive excerpts and duplicate parameter assessments",()=>{
  const {input,output}=fixture();output.workbookAssessments![0].evidence!.excerpt="Fabricated";output.workbookAssessments!.push(output.workbookAssessments![1]);
  const r=buildWorkbookReview(analyzeResume(input),input,output,true);expect(r.v2?.parameters.slice(0,2).every(p=>p.status==="Pending")).toBe(true);
 });
 it("averages owned atomic requirements equally, rounding ties upward, with absent sets N/A",()=>{
  const {input,output}=fixture("Deliver a customer portal. Lead service quality improvements.");
  output.jdRequirements=[{id:"r1",owner:"J01",sourceText:"Deliver a customer portal.",status:"Assessed",rating:3,evidence:{excerpt:"Delivered a customer portal",rationale:"Partial match"},mandatory:true,confirmedBlocker:false},{id:"r2",owner:"J01",sourceText:"Lead service quality improvements.",status:"Assessed",rating:4,evidence:{excerpt:"Improved service quality",rationale:"Strong match"},mandatory:true,confirmedBlocker:false}];
  for(const id of ["J02","J03","J04","J05"] as const) output.workbookAssessments!.push({id,status:"N/A",naOrPendingReason:"No owned explicit requirements in JD"});
  const r=buildWorkbookReview(analyzeResume(input),input,output,true);
  expect(r.score).toBe(80);expect(r.v2?.parameters.find(p=>p.id==="J01")).toMatchObject({rating:4,effectiveMaxWeight:25});
  expect(r.v2?.paidReport?.actionPlan.some(a=>a.priority==="P0")).toBe(false);
 });
 it("rejects duplicated JD sources across owners and unresolved requirement evidence",()=>{
  const {input,output}=fixture("Deliver a customer portal.");
  const r={id:"r1",owner:"J01" as const,sourceText:"Deliver a customer portal.",status:"Assessed" as const,rating:4,evidence:{excerpt:"Delivered a customer portal",rationale:"Strong match"},mandatory:true,confirmedBlocker:false};
  output.jdRequirements=[r,{...r,id:"r2",owner:"J02"}];
  const result=buildWorkbookReview(analyzeResume(input),input,output,true);expect(result.score).toBeNull();expect(result.v2?.pillars.jobMatch.pendingMaxPoints).toBeCloseTo(25);
 });
 it("keeps unverified content Pending and leaves unrelated skills out of C06", () => {
  const { input, output } = fixture();
  input.targetKeywords.push("Unlisted skill");
  const rows = output.workbookAssessments!;
  rows[2].status = "Pending";
  rows[2].rating = null;
  rows[2].naOrPendingReason = "Achievement evidence needs clarification.";
  const report = buildWorkbookReview(analyzeResume(input), input, output, true).v2!;
  expect(report.parameters.find(row => row.id === "C03")).toMatchObject({ status: "Pending", rating: null });
  expect(report.parameters.find(row => row.id === "C06")).toMatchObject({ status: "Assessed", rating: 4, issues: [] });
 });
 it("reserves visual points if the model's anchor or confidence is unsupported", () => {
  const { input, output } = fixture();
  input.documentSignals.geminiVisualCriteria[1].anchorText = "Generic assessment";
  input.documentSignals.geminiVisualCriteria[2].confidence = 0.4;
  const report = buildWorkbookReview(analyzeResume(input), input, output, true).v2!;
  expect(report.parameters.filter(row => row.id === "V02" || row.id === "V03").map(row => row.status)).toEqual(["Pending", "Pending"]);
  expect(report.parameters.find(row => row.id === "V01")?.anchorComparison?.anchor).toBe("Strong evidence with a limited shortfall");
 });
 it("does not average a partial set of an owner's atomic job requirements", () => {
  const { input, output } = fixture("Deliver a customer portal. Lead service quality improvements.");
  output.jdRequirements = [
    { id: "r1", owner: "J01", sourceText: "Deliver a customer portal.", status: "Assessed", rating: 4, evidence: { excerpt: "Delivered a customer portal", rationale: "Supports the required function." }, mandatory: true, confirmedBlocker: false },
    { id: "r2", owner: "J01", sourceText: "Lead service quality improvements.", status: "Pending", rating: null, evidence: { excerpt: "", rationale: "Leadership evidence needs clarification." }, mandatory: true, confirmedBlocker: false },
  ];
  const report = buildWorkbookReview(analyzeResume(input), input, output, true).v2!;
  expect(report.parameters.find(row => row.id === "J01")).toMatchObject({ status: "Pending", rating: null });
  expect(report.cumulativeScore).toBeNull();
 });
 it("preserves raw and adjusted workbook scores when advisory findings are attached", () => {
  const {input,output} = fixture();
  const baseline = analyzeResume(input);
  const sample = [
    "EXPERIENCE",
    "Analyst | Example Co | January 2020 - December 2022",
    "Prepared detailed operations reports for managers.",
    "Senior Analyst | Sample Co | January 2024 - Present",
    "Coordinated reporting across teams.",
  ].join("\n");
  const now = new Date("2026-11-24T12:00:00+05:30");
  expect(chronologyRatingConflict(sample,5,now)).toBeUndefined();
  const advisory = analyzeResumeGapsAndRisks(sample,{}, "", now);
  expect(advisory.timelineGaps[0]?.durationMonths).toBe(12);
  const plainStored = buildWorkbookReview(baseline,input,output,true);
  const annotatedStored = buildWorkbookReview({...baseline,gapRiskAnalysis:advisory},input,output,true);
  expect(annotatedStored.rawScore).toBe(plainStored.rawScore);
  const plain = projectWorkbookReview(plainStored,true);
  const annotated = projectWorkbookReview(annotatedStored,true);
  expect(annotated.gapRiskAnalysis).toEqual(advisory);
  expect(annotated.score).toBe(plain.score);
  expect(annotated.v2).toEqual(plain.v2);
 });
 it("projects Paid enrichment without hiding Free evidence and applies 20 marks deduction to both paid and free",()=>{
  const {input,output}=fixture();const result=buildWorkbookReview(analyzeResume(input),input,output,true);
  const free=projectWorkbookReview(result,false);
  const paid=projectWorkbookReview(result,true);
  expect(free.v2).not.toHaveProperty("paidReport");expect(paid.v2?.paidReport).toBeDefined();
  expect(free.score).toBe(Math.max(0, result.score! - 20));
  expect(paid.score).toBe(Math.max(0, result.score! - 20));
  expect(free.v2?.cumulativeScore).toBe(Math.max(0, result.v2!.cumulativeScore! - 20));
  expect(paid.v2?.cumulativeScore).toBe(Math.max(0, result.v2!.cumulativeScore! - 20));
  expect(free).not.toHaveProperty("rawScore");
  expect(result.rawScore).toBe(80);
  expect(paid.v2?.parameters).toEqual(free.v2?.parameters);
  expect(paid.v2?.parameters.every(p => !("originalEarnedPoints" in p))).toBe(true);
  expect(paid.v2?.parameters.map(p => p.rating)).toEqual(result.v2?.parameters.map(p => p.rating));
  expect(paid.v2?.parameters.reduce((total, p) => total + p.earnedPoints, 0)).toBeCloseTo(60);
  expect(paid.contentContribution! + paid.visualContribution! + paid.jobMatchContribution!).toBeCloseTo(60);
  expect(paid.v2?.paidReport).toEqual(result.v2?.paidReport);
  const serialized = resumeAnalysisResultSchema.parse(JSON.parse(JSON.stringify(paid)));
  expect(projectWorkbookReview(serialized, true)).toEqual(serialized);
 });
});

const internalScoreKeys = ["rawScore", "originalScore", "originalConfirmedEarned", "originalEarnedPoints", "scoreReductionAmount", "scoreReductionFactor", "scoreAdjustmentStatus"];
const adjustmentWording = /\b20[- ]?marks?\b|deduct|score adjustment|adjusted score|score reduction|raw score/i;
function expectNoInternalScoreDetails(value: unknown) {
 const json = JSON.stringify(value);
 for (const key of internalScoreKeys) expect(json, key).not.toContain(`"${key}"`);
 expect(json).not.toMatch(adjustmentWording);
}
const sumEarned = (rows: Array<{earnedPoints:number}> = []) => rows.reduce((total, row) => total + row.earnedPoints, 0);

describe("internal score adjustment",()=>{
 it("leaves an incomplete report's confirmed, pillar and interim values unadjusted",()=>{
  const {input}=fixture();
  const stored=buildWorkbookReview(analyzeResume(input),input,undefined,true);
  expect(stored.v2?.scoreStatus).toBe("score_pending");
  expect(stored.v2?.pillars.visual.confirmedEarned).toBeGreaterThan(0);
  const shown=projectWorkbookReview(stored,true);
  expect(shown.score).toBeNull();
  expect(shown.v2?.cumulativeScore).toBeNull();
  expect(shown.v2?.confirmedEarnedPoints).toBe(stored.v2?.confirmedEarnedPoints);
  expect(shown.v2?.possibleScoreRange).toEqual(stored.v2?.possibleScoreRange);
  expect(shown.v2?.pillars.visual.confirmedEarned).toBe(stored.v2?.pillars.visual.confirmedEarned);
  expect(shown.v2?.pillars.content.confirmedEarned).toBe(stored.v2?.pillars.content.confirmedEarned);
  expect(shown.v2?.parameters.map(p=>[p.id,p.status,p.earnedPoints])).toEqual(stored.v2?.parameters.map(p=>[p.id,p.status,p.earnedPoints]));
  expect([shown.contentContribution,shown.visualContribution,shown.jobMatchContribution]).toEqual([stored.contentContribution,stored.visualContribution,stored.jobMatchContribution]);
 });
 it("keeps incomplete interim points equal to the workbook formula",()=>{
  const {input}=fixture();
  const stored=buildWorkbookReview(analyzeResume(input),input,undefined,true);
  const shown=projectWorkbookReview(stored,false);
  // No JD: visual pillar 35 points, every V row rated 4/5 by the fixture -> 28 confirmed points.
  expect(shown.v2?.pillars.visual.confirmedEarned).toBeCloseTo(28);
  expect(sumEarned(shown.v2?.parameters)).toBeCloseTo(28);
  expect(shown.v2?.pillars.content.state).toBe("Pending");
  expect(shown.v2?.pillars.content.pendingMaxPoints).toBeCloseTo(65);
  expect(shown.v2?.unresolvedMaximumPoints).toBeCloseTo(65);
 });
 it("adjusts a completed report exactly once",()=>{
  const {input,output}=fixture();
  const stored=buildWorkbookReview(analyzeResume(input),input,output,true);
  expect(stored.v2?.scoreStatus).toBe("completed");
  const shown=projectWorkbookReview(stored,true);
  expect(shown.score).toBe(Math.max(0,stored.score!-20));
  expect(shown.v2?.cumulativeScore).toBe(Math.max(0,stored.v2!.cumulativeScore!-20));
  expect(sumEarned(shown.v2?.parameters)).toBeCloseTo(shown.score!);
  expect(shown.contentContribution!+shown.visualContribution!+shown.jobMatchContribution!).toBeCloseTo(shown.score!);
  expect(stored.score).toBe(80);
 });
 it("never adjusts again on repeated processing, in memory or after serialization",()=>{
  const {input,output}=fixture();
  for (const assessment of [output, undefined]) {
   const stored=buildWorkbookReview(analyzeResume(input),input,assessment,true);
   const once=projectWorkbookReview(stored,true);
   expect(projectWorkbookReview(once,true)).toEqual(once);
   expect(projectWorkbookReview(projectWorkbookReview(once,false),true).score).toBe(once.score);
   const serialized=resumeAnalysisResultSchema.parse(JSON.parse(JSON.stringify(once)));
   expect(projectWorkbookReview(serialized,true)).toEqual(serialized);
   expect(projectWorkbookReview(stored,true)).toEqual(once);
  }
 });
 it("exposes no adjustment value, field or wording in the user-facing result",()=>{
  const {input,output}=fixture();
  for (const assessment of [output, undefined]) for (const paid of [true,false]) {
   const shown=projectWorkbookReview(buildWorkbookReview(analyzeResume(input),input,assessment,true),paid);
   expectNoInternalScoreDetails(shown);
  }
 });
 it("keeps adjustment wording and internal fields out of the report UI and PDF sources",async()=>{
  const {readFileSync}=await import("node:fs");
  const {resolve}=await import("node:path");
  for (const file of ["src/components/workbook-review.tsx","src/components/resume-review.tsx","src/lib/review-report-renderer.tsx"]) {
   const source=readFileSync(resolve(file),"utf8");
   for (const key of internalScoreKeys) expect(source,`${file} ${key}`).not.toContain(key);
   expect(source,file).not.toMatch(adjustmentWording);
  }
 });
});

