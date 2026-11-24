// @vitest-environment node
/** Observational probes: record product failures without changing app code or touching persistence. */
import {it,expect} from "vitest";
import {writeFileSync,mkdirSync,readFileSync} from "node:fs";
import {validateAiSemantics} from "./ai/semantic-validation";
import {analyzeResume,validateGroundedRewrite,validateParameterEvidence,validateSourceEvidence,consistentSeverity} from "@successpro/domain";
import {documentSignalsSchema} from "@successpro/contracts";
import {employmentDiagnostics,chronologyRatingConflict} from "@successpro/domain";
import {inspectNativeUpload} from "./resume-native/validation";
import type {AiTaskInput,AiTaskOutput} from "@successpro/contracts/ai";
const results:Array<Record<string,unknown>>=[];
const record=(id:string,expected:unknown,actual:unknown,verdict:string)=>results.push({id,expected,actual,verdict,scope:"isolated execution of production functions; not live AI or completed application assessment"});
it("audits the documented-absence contract across domain and orchestration",()=>{
 const resumeText="EXPERIENCE\nEngineer at Example Systems\nPrepared weekly service reports and supported customer requests.";
 const evidence={excerpt:"",rationale:"No employment date ranges were found.",location:"Entire experience section",absenceSearch:{scope:"Entire experience section",searchedFor:"Employment date ranges",outcome:"not_found" as const}};
 const input={resumeText,targetRole:"Engineer",jobDescription:"",deterministicReview:analyzeResume({text:resumeText,targetKeywords:[]})} as AiTaskInput<"analyzeResume">;
 const output={summary:"The resume has relevant tasks but needs timeline clarification.",topActions:[],limitations:[],workbookAssessments:[{id:"C08",status:"Assessed",rating:0,evidence,anchorComparison:{anchor:"Material contradictions or uninterpretable sequence",justification:"No dated sequence can be interpreted",nextAnchorGap:"Supply actual dates",informationState:"missing"}}]} as AiTaskOutput<"analyzeResume">;
 const domain=validateParameterEvidence("C08",0,evidence),source=validateSourceEvidence(evidence,resumeText,{rating:0});
 const orchestration=validateAiSemantics("analyzeResume",input,output).filter(i=>i.code==="missing_workbook_evidence");
 expect(domain).toEqual([]);expect(source).toEqual([]);expect(orchestration).toEqual([]);
 record("A01","Documented absence accepted consistently",{domain,source,orchestration},"PASS");
});
it("audits unsupported recombination and useful paraphrase retention",()=>{
 const source="Managed payroll. Assisted engineers.";
 const invented=validateGroundedRewrite("Managed engineers.",source);
 expect(invented).toEqual([]);record("A02","Reject unsupported management responsibility",{source,rewrite:"Managed engineers.",issues:invented},"FAIL");
 const paraphrase=validateGroundedRewrite("Produced weekly reports.","Prepared weekly reports.");
 expect(paraphrase.length).toBeGreaterThan(0);record("A03","Retain a useful factual synonym",{source:"Prepared weekly reports.",rewrite:"Produced weekly reports.",issues:paraphrase},"FAIL");
});
it("audits whether confirmed blocker flags are independently established",()=>{
 const actual=consistentSeverity(3,[{severity:"Minor",message:"A supplied email is present.",confirmedBlocker:true}]);
 expect(actual[0].severity).toBe("Critical");record("A04","Positive contact finding cannot become Critical solely from a boolean",actual,"FAIL");
});
it("audits visual anchor trace preservation through the web schema",()=>{
 const actual=documentSignalsSchema.parse({geminiVisualCriteria:[{code:"V01",rating:4,confidence:.9,pages:[1],evidence:"Clear section hierarchy",recommendation:"Improve heading spacing",anchorText:"Strong evidence with a limited shortfall",anchorJustification:"Visible hierarchy",nextAnchorGap:"Spacing"}]}).geminiVisualCriteria![0];
 expect(actual).toMatchObject({anchorText:"Strong evidence with a limited shortfall",anchorJustification:"Visible hierarchy",nextAnchorGap:"Spacing"});record("A05","Preserve the visual anchor comparison across Python/web schemas",actual,"PASS");
 mkdirSync("../../.local/phase4a/product-acceptance",{recursive:true});writeFileSync("../../.local/phase4a/product-acceptance/probes.json",JSON.stringify(results,null,2));
});
it("traces extracted synthetic files through production chronology and upload validation without persistence",async()=>{
 const scenarios=JSON.parse(readFileSync("../../.local/phase4a/product-acceptance/extraction-scenarios.json","utf8")) as Array<{case:string;text:string;file?:string}>;
 const actual=[];
 for(const scenario of scenarios){
  const audit=employmentDiagnostics(scenario.text,new Date("2026-11-16T00:00:00Z"));
  let upload:unknown="not inspected";
  if(scenario.file){const bytes=new Uint8Array(readFileSync("../../"+scenario.file));upload=await inspectNativeUpload(new File([bytes],scenario.case+".pdf",{type:"application/pdf"}),bytes);}
  actual.push({case:scenario.case,uploadInspection:upload,chronology:audit,highRatingConflict:chronologyRatingConflict(scenario.text,5,new Date("2026-11-16T00:00:00Z")) ?? null,completedAssessment:false});
 }
 for(const [name,mime] of [["invalid.txt","text/plain"],["invalid.pdf","application/pdf"],["empty.pdf","application/pdf"]]){
  const bytes=new Uint8Array(readFileSync("../../.local/phase4a/product-acceptance/"+(name==="invalid.txt"?"invalid-upload.txt":"fixtures/"+name)));
  let rejected=false;try{await inspectNativeUpload(new File([bytes],name,{type:mime}),bytes);}catch{rejected=true;}
  expect(rejected).toBe(true);actual.push({case:name,uploadRejected:rejected,completedAssessment:false});
 }
 writeFileSync("../../.local/phase4a/product-acceptance/flow-probes.json",JSON.stringify(actual,null,2));
});
