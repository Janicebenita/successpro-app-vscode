import {describe,it,expect} from "vitest";
import {validateGroundedRewrite} from "@successpro/domain";
import {validateAiSemantics} from "./ai/semantic-validation";
const source="Jane Example\njane@example.com +1 202 555 0147 https://jane.dev/work\nAnalyst at Acme. Prepared weekly reports for 20 clients. BSc Economics. 2020 – 2022.";
describe("Phase4A rewrite integrity",()=>{
 it("accepts source-grounded wording and preserves contacts",()=>expect(validateGroundedRewrite(source,source,source)).toEqual([]));
 it.each(["https://linkedin.com/in/jane-example","other@example.com","+1 202 555 9999","https://invented.dev"])("rejects invented contact %s",contact=>expect(validateGroundedRewrite(contact,source)).not.toEqual([]));
 it.each(["the contact detail","[insert]","[your name]","[add link]","placeholder","[actual task]","<insert link>","REDACTED"])("rejects leaked template %s",value=>expect(validateGroundedRewrite(value,source)).not.toEqual([]));
 it.each(["Increased revenue by 99%.","MBA at Harvard.","Director at Globex.","Certified PMP.","2024 – 2026."])("rejects unsupported factual statement %s",value=>expect(validateGroundedRewrite(value,source)).not.toEqual([]));
 it("rejects replacing portfolio with invented LinkedIn",()=>expect(validateGroundedRewrite(source.replace("https://jane.dev/work","https://linkedin.com/in/jane"),source,source)).not.toEqual([]));
 it("accepts concise source-grounded edits without new factual words",()=>expect(validateGroundedRewrite("Prepared reports for 20 clients.",source)).toEqual([]));
 it("allows correction instructions but still rejects fictional contacts and metrics",()=>{
  expect(validateGroundedRewrite("Use only the verified date",source,"",{guidance:true})).toEqual([]);
  expect(validateGroundedRewrite("Use invented@example.net and 99%",source,"",{guidance:true})).not.toEqual([]);
 });
 it("rejects invented dates in detailed issue explanations",()=>expect(validateAiSemantics("explainResumeIssue",{factor:"Timeline",evidence:["End date not found"],issue:"Missing date",targetRole:"Analyst"},{observed:"End date not found",inference:"Timeline needs clarification",suggestion:"Supply the true dates",whyItMatters:"Clear chronology",example:"2022 - Present"})).not.toEqual([]));
});
