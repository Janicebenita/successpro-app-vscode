import {describe,it,expect} from "vitest";
import {analyzeResumeGapsAndRisks,generatePaidReport} from "@successpro/domain";
import type {ParameterEvaluationResult,ParameterId} from "@successpro/domain";
const row=(id:ParameterId,weight:number,rating=2):ParameterEvaluationResult=>({id,pillar:id.startsWith("V")?"visual":"content",name:id,status:"Assessed",rating,baseWeight:weight,effectiveMaxWeight:weight,earnedPoints:weight*rating/5,evidence:{excerpt:"Delete this instruction page before sending.",rationale:"Template instruction page dilutes evidence."},issues:[{severity:"Major",message:"Instruction page retained",rootCause:{key:"template-page",sourceExcerpt:"Delete this instruction page before sending.",correction:"Remove the instruction page and inspect the exported resume."}}]});
describe("Phase4A grouped actions",()=>{
 it("combines one cause across five criteria with individual workbook ceilings",()=>{
  const r=generatePaidReport([row("C09",3.9),row("V01",8.4),row("V03",5.6),row("V04",4.2),row("V05",5.6)]).actionPlan;
  expect(r).toHaveLength(1);expect(r[0].affectedCriteria).toHaveLength(5);expect(r[0].conditionalPointRecovery).toBeCloseTo((3.9+8.4+5.6+4.2+5.6)*.6);expect(r[0].rewriteTemplate).toBe("");
 });
 it("does not group unsupported causes or double count repeated criteria",()=>{
  const a=row("C02",13), b=row("C03",10.4);b.evidence.excerpt="Another substantive source excerpt.";
  expect(generatePaidReport([a,b,a]).actionPlan).toHaveLength(2);
 });
 it("ranks relative impact/effort, retaining blocker priority",()=>{
  const a=row("C02",13),b=row("C06",6.5);a.issues[0].rootCause=undefined;b.issues[0].rootCause=undefined;
  const r=generatePaidReport([a,b]).actionPlan;expect(r[0].parameterId).toBe("C06");expect(r[0].impactEffortRatio).toBeGreaterThan(r[1].impactEffortRatio!);
  a.issues[0].confirmedBlocker=true;expect(generatePaidReport([a,b]).actionPlan[0].priority).toBe("P0");
 });
});


it("flags an unresolved resume placeholder separately from the score", () => {
  const text="PROJECTS\nChildren's story | Role: content development [to be confirmed]";
  const finding=analyzeResumeGapsAndRisks(text).findings.find(item=>item.id==="content-unresolved-placeholder");
  expect(finding?.evidenceExcerpt).toContain("[to be confirmed]");
  expect(finding?.isMandatory).toBe(false);
});

it("counts verified publishing scope and preserves shared credit in advisory advice", () => {
  const resume = [
    "WRITING PROJECTS",
    "  • Wrote a beginner-friendly e-book of 25 recipes across five chapters.",
    "• Designed 15 career-themed activities for readers.",
    "• Contributed to a children's story and researched its subject.",
    "• Wrote product descriptions for independent book listings.",
  ].join("\n");
  const advisory = analyzeResumeGapsAndRisks(resume);
  expect(advisory.findings.some((finding) => finding.id === "missing-measurable-achievements")).toBe(false);
  const writing = advisory.findings.find((finding) => finding.id === "content-weak-action-verbs");
  expect(writing?.evidenceExcerpt).toBe("• Contributed to a children's story and researched its subject.");
  expect(writing?.recommendedCorrection).toContain("Retain shared credit");
});
