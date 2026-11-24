import {it,expect} from "vitest";
import {analyzeResume,employmentDiagnostics,RATING_RUBRIC} from "@successpro/domain";
import {validateAiSemantics} from "./ai/semantic-validation";
import type {AiTaskInput,AiTaskOutput} from "@successpro/contracts/ai";
it("does not turn at-a-given-time duty wording into an undated employment entry",()=>{
 const text="EXPERIENCE\nDesigner at Example Studio\nJan 2020 – Dec 2022\nManaged several projects at a given time and ensured the team met deadlines.";
 expect(employmentDiagnostics(text).entries).toHaveLength(1);
 expect(employmentDiagnostics(text).findings.some(f=>f.kind==="missing")).toBe(false);
 expect(employmentDiagnostics("EXPERIENCE\nDesigner at Example Studio").findings.some(f=>f.kind==="missing")).toBe(true);
});
it("identifies the failing criterion for primary and supplementary heading evidence",()=>{
 const text="PROFILE\nExperienced designer delivering client communication materials.\nPrepared client reports and maintained project documentation.";
 const input={resumeText:text,targetRole:"",deterministicReview:analyzeResume({text,targetKeywords:[]})} as AiTaskInput<"analyzeResume">;
 const output={summary:"The resume has design experience but needs more detail.",topActions:[],limitations:[],workbookAssessments:[{id:"C09",status:"Assessed",rating:4,evidence:{excerpt:"Experienced designer delivering client communication materials.",rationale:"Relevant experience is prioritized.",additionalExcerpts:[{excerpt:"PROFILE"}]},anchorComparison:{anchor:RATING_RUBRIC.C09[4],justification:"Relevant opening",nextAnchorGap:"More prioritization",informationState:"present"}}]} as AiTaskOutput<"analyzeResume">;
 expect(validateAiSemantics("analyzeResume",input,output)).toContainEqual(expect.objectContaining({path:"workbookAssessments.C09.evidence",code:"invalid_source_evidence"}));
});
