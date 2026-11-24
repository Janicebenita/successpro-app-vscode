import {describe,it,expect} from "vitest";
import {validateSourceEvidence,validateParameterEvidence} from "@successpro/domain";
const source="PROFILE\nManaged service delivery for 20 clients.\nReduced costs by 15%.\nBudget $200. 2020 – 2022. 3 years experience.";
const ev=(excerpt:string,rationale="Source demonstrates delivery.")=>({excerpt,rationale});
describe("Phase4A evidence",()=>{
 it.each(["PROFILE","PROFESSIONAL EXPERIENCE","EDUCATION","SKILLS"])("rejects heading %s even when present",heading=>expect(validateSourceEvidence(ev(heading),source+"\n"+heading)).not.toEqual([]));
 it("accepts exact substantive source wording",()=>expect(validateSourceEvidence(ev("Managed service delivery for 20 clients.","Delivered for 20 clients."),source)).toEqual([]));
 it("rejects nonexistent or paraphrased quotes",()=>expect(validateSourceEvidence(ev("Led customer delivery."),source)).not.toEqual([]));
 it("counts content, not whitespace padding",()=>expect(validateSourceEvidence(ev("a                    b"),"a                    b")).not.toEqual([]));
 it("combines distinct short identity/contact facts without padding",()=>expect(validateSourceEvidence({...ev("Jane Doe"),additionalExcerpts:[{excerpt:"jane@x.co"}]},"Jane Doe\njane@x.co")).toEqual([]));
 it("does not count duplicate short excerpts as extra content",()=>expect(validateSourceEvidence({...ev("Jane Doe"),additionalExcerpts:[{excerpt:"Jane Doe"}]},"Jane Doe")).not.toEqual([]));
 it("supports a configurable threshold",()=>expect(validateSourceEvidence(ev("Budget $200."),source,{minimumCharacters:6})).toEqual([]));
 it.each(["15%","$200","2020","3 years"])("requires a linked excerpt for %s",claim=>expect(validateSourceEvidence(ev("Managed service delivery for 20 clients.",`Evidence shows ${claim}.`),source)).not.toEqual([]));
 it("supports multiple independently grounded quotes",()=>expect(validateSourceEvidence({...ev("Managed service delivery for 20 clients.","Served 20 clients and reduced costs by 15%."),additionalExcerpts:[{excerpt:"Reduced costs by 15%."}]},source)).toEqual([]));
 it("rejects fabricated secondary quotes",()=>expect(validateSourceEvidence({...ev("Managed service delivery for 20 clients."),additionalExcerpts:[{excerpt:"Reduced costs by 99%."}]},source)).not.toEqual([]));
 it("does not use unrelated numbers elsewhere in resume",()=>expect(validateSourceEvidence(ev("Managed service delivery for 20 clients.","Reduced costs by 15%."),source)).not.toEqual([]));
 it("distinguishes units and currency",()=>expect(validateSourceEvidence(ev("Managed service delivery for 20 clients.","20 years and $20."),source)).not.toEqual([]));
 it("recognizes percent spelling without discarding its unit",()=>expect(validateSourceEvidence(ev("Reduced costs by 15%.","Reduced costs by 15 percent."),source)).toEqual([]));
 it("rejects unsupported month/year combinations and spelled-out counts",()=>{
  expect(validateSourceEvidence(ev("Worked from Jan 2020 to Dec 2022.","Started in Sep 2020."),"Worked from Jan 2020 to Dec 2022.")).not.toEqual([]);
  expect(validateSourceEvidence(ev("Managed service delivery for 20 clients.","Twenty years experience."),source)).not.toEqual([]);
 });
 it("accepts documented absence without fabricated quotation",()=>expect(validateSourceEvidence({excerpt:"",rationale:"No employment chronology located.",location:"Entire supplied resume",absenceSearch:{scope:"Entire supplied resume",searchedFor:"employment date ranges",outcome:"not_found"}},source,{rating:0})).toEqual([]));
 it("rejects undocumented zero-rating absence",()=>expect(validateSourceEvidence(ev("Nothing found"),source,{rating:0})).not.toEqual([]));
 it("preserves the documented absence exception through the scoring evidence boundary",()=>expect(validateParameterEvidence("C08",0,{excerpt:"",rationale:"No interpretable date sequence found.",location:"Entire supplied experience section",absenceSearch:{scope:"Experience section",searchedFor:"employment dates",outcome:"not_found"}})).toEqual([]));
});
