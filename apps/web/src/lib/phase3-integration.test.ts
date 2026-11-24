import {describe,it,expect} from "vitest";
import {resumeAnalysisResultSchema} from "@successpro/contracts";
import {analyzeResume} from "@successpro/domain";
import {visualCodeMapping,LEGACY_VISUAL_EVIDENCE_OWNERS} from "./visual-code-mapping";
const text="Software engineer developing production web services. Built tested APIs using Node.js and SQL. Experience delivering customer software. ";
describe("phase3 precision and visual contracts",()=>{
 for(const value of [0,0.01,44.5,53.5,59.5,99.99,100])it("preserves intermediate percentage "+value,()=>{const base=analyzeResume({text});expect(resumeAnalysisResultSchema.parse({...base,visualDesignScore:value}).visualDesignScore).toBe(value);});
 for(const value of [-.01,100.01,NaN,Infinity])it("rejects invalid percentage "+value,()=>expect(resumeAnalysisResultSchema.safeParse({...analyzeResume({text}),visualDesignScore:value}).success).toBe(false));
 it("preserves missing visual percentage as null",()=>expect(resumeAnalysisResultSchema.parse({...analyzeResume({text}),visualDesignScore:null}).visualDesignScore).toBeNull());
 it("recognizes every canonical visual code without reassessment",()=>{for(let i=1;i<=6;i++){const code="V0"+i;expect(visualCodeMapping(code)).toEqual({owners:[code],requiresReassessment:false});}});
 it("recognizes legacy evidence without manufacturing a workbook rating",()=>{for(const code of Object.keys(LEGACY_VISUAL_EVIDENCE_OWNERS))expect(visualCodeMapping(code).requiresReassessment).toBe(true);expect(visualCodeMapping("unknown").owners).toEqual([]);});
});
