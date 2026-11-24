import {describe,it,expect} from "vitest";
import {ALL_PARAMETER_IDS,evaluateSuccessProV2,RATING_RUBRIC,validateParameterEvidence} from "@successpro/domain";
import type {ParameterEvaluationInput} from "@successpro/domain";
const gates={textReliable:true,visualDocumentAvailable:true,meaningfulJdSupplied:true};
const inputs=():ParameterEvaluationInput[]=>ALL_PARAMETER_IDS.map(id=>({id,status:"Assessed",rating:4,evidence:{excerpt:"Synthetic source evidence",rationale:"Synthetic rationale"}}));
const run=(parameters=inputs(),intakeGates=gates)=>evaluateSuccessProV2({mode:"with_job_description",parameters,intakeGates});
describe("audited workbook publication boundaries",()=>{
 it("uses the C02 intermediate anchor from Rating Rubric H7",()=>expect(RATING_RUBRIC.C02[2]).toBe("Partial evidence with important shortfalls"));
 it("keeps Assessed without evidence Pending",()=>{const ps=inputs();delete ps[0].evidence;expect(run(ps).parameters[0].status).toBe("Pending");expect(run(ps).cumulativeScore).toBeNull();});
 it("requires evidence for rating 5",()=>expect(validateParameterEvidence("C01",5,{excerpt:"",rationale:"Claimed excellent"}).length).toBeGreaterThan(0));
 it("keeps blank ratings Pending without throwing",()=>{const ps=inputs();ps[0].rating=null;expect(run(ps).parameters[0].status).toBe("Pending");});
 it("reserves an entire all-N/A included pillar",()=>{const ps=inputs();ps.filter(p=>p.id.startsWith("V")).forEach(p=>{p.status="N/A";p.rating=null;p.naOrPendingReason="Synthetic reason";});expect(run(ps)).toMatchObject({cumulativeScore:null,unresolvedMaximumPoints:25,pillars:{visual:{state:"Pending"}}});});
 it("pauses Content and Job Match for unreliable text",()=>{const r=run(inputs(),{...gates,textReliable:false});expect(r.scoreStatus).toBe("technical_pause");expect(r.pillars.jobMatch.confirmedEarned).toBe(0);expect(r.pillars.jobMatch.pendingMaxPoints).toBe(25);});
 it("blocks With-JD publication without a meaningful JD",()=>expect(run(inputs(),{...gates,meaningfulJdSupplied:false}).cumulativeScore).toBeNull());
 it("does not infer intake evidence from omitted gates",()=>expect(evaluateSuccessProV2({mode:"with_job_description",parameters:inputs()}).cumulativeScore).toBeNull());
 it("does not publish a descriptive band for Pending",()=>expect(run(inputs(),{...gates,visualDocumentAvailable:false}).descriptiveBand).toBeUndefined());
 it("requires an N/A reason",()=>{const ps=inputs();ps[4].status="N/A";expect(run(ps).parameters[4].status).toBe("Pending");});
});
