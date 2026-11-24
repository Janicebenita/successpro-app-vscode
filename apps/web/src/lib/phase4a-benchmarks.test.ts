import {it,expect} from "vitest";
import {summarizeCalibrationRuns} from "@successpro/domain";
import type {CalibrationRun} from "@successpro/domain";
const runs=():CalibrationRun[]=>[60,62,64,62,62].map((score,index)=>({provider:"synthetic-mock",model:"test-only",promptVersion:"test-only",settings:{temperature:0.1},score,ratings:{C01:[3,3,4,3,3][index]},validation:"passed",fallback:false,timestamp:"2026-11-16T00:00:00Z"}));
it("computes population and criterion variation from five synthetic arithmetic observations",()=>{
 const summary=summarizeCalibrationRuns(runs());expect(summary.score.mean).toBe(62);expect(summary.score.standardDeviation).toBeCloseTo(Math.sqrt(1.6));expect(summary.perCriterion.C01.ratingChanges).toBe(2);expect(summary.ratingChanges).toBe(2);
});
it("rejects missing runs and provider substitution",()=>{
 expect(()=>summarizeCalibrationRuns(runs().slice(1))).toThrow();const data=runs();data[1].model="different";expect(()=>summarizeCalibrationRuns(data)).toThrow();
});
