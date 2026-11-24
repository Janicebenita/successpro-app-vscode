import {describe,it,expect} from "vitest";
import {promptForTask,aiTaskRegistry} from "./ai/task-registry";
import {validateAiSemantics} from "./ai/semantic-validation";
import {RATING_RUBRIC,analyzeResume} from "@successpro/domain";
import type {AiTaskInput,AiTaskOutput} from "@successpro/contracts/ai";
describe("Phase4A anchor calibration",()=>{
 const resumeText="EXPERIENCE\nEngineer at Acme Jan 2020 – Dec 2022\nDelivered service reports for clients.";
 const input={resumeText,targetRole:"Engineer",deterministicReview:analyzeResume({text:resumeText,targetKeywords:[]})} as AiTaskInput<"analyzeResume">;
 const output={summary:"The resume has specific experience but needs clearer outcomes.",topActions:[],limitations:[],workbookAssessments:[{id:"C02",status:"Assessed",rating:3,evidence:{excerpt:"Delivered service reports for clients.",rationale:"Relevant tasks are clear but ownership and methods are vague."}}]} as AiTaskOutput<"analyzeResume">;
 it("requires exact workbook anchor comparisons",()=>{
  expect(validateAiSemantics("analyzeResume",input,output).some(i=>i.code==="anchor_comparison_required")).toBe(true);
  const valid=structuredClone(output);valid.workbookAssessments![0].anchorComparison={anchor:RATING_RUBRIC.C02[3],justification:"Tasks described but methods vague",nextAnchorGap:"Clarify own methods",informationState:"present"};
  expect(validateAiSemantics("analyzeResume",input,valid).some(i=>i.code==="anchor_comparison_required")).toBe(false);
 });
 it("includes actual anchors, diagnostics and no forced score band",()=>{
  const prompt=promptForTask("analyzeResume",input);
  expect(prompt).toContain(RATING_RUBRIC.C08[5]);expect(prompt).toContain("employmentDateValidation");expect(prompt).toContain("J01–J05 as N/A/excluded");expect(prompt).not.toContain("25–40");expect(aiTaskRegistry.analyzeResume.promptVersion).toContain("phase4a");
 });
});
