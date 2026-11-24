import {describe,it,expect} from "vitest";
import {validateEmploymentDates,employmentDiagnostics,chronologyRatingConflict} from "@successpro/domain";
const now=new Date("2026-11-16T00:00:00Z");
const entry=(range?:string,role="Engineer",concurrent=false)=>({role,source:`${role} ${range ?? ""}`,range,concurrent});
describe("Phase4A chronology",()=>{
 it("unions nonoverlapping periods",()=>expect(validateEmploymentDates([entry("Jan 2020 – Dec 2020"),entry("01/2021 – 12/2021")],undefined,now).durationMonths).toEqual([24,24]));
 it("detects two and three overlaps without alleging contradiction",()=>{
  for(const count of [2,3]) { const a=validateEmploymentDates(Array.from({length:count},(_,i)=>entry("Jan 2020 – Dec 2022",`Role ${i}`)),undefined,now); expect(a.findings.filter(f=>f.kind==="overlap")).toHaveLength(count*(count-1)/2);expect(a.durationMonths).toEqual([36,36]); }
 });
 it("allows same-month transitions",()=>expect(validateEmploymentDates([entry("Jan 2020 – Jun 2020"),entry("Jun 2020 – Dec 2020")],undefined,now).findings).toEqual([]));
 it("holds missing dates uncertain",()=>expect(validateEmploymentDates([entry()],undefined,now).findings[0]).toMatchObject({kind:"missing",certainty:"uncertain"}));
 it("requires clarification for a high rating with undated recognizable roles",()=>expect(chronologyRatingConflict("EXPERIENCE\nEngineer at Acme",5,now)).toMatch(/uncertain extraction is Pending/));
 it("resolves Present using the fixed assessment month",()=>expect(validateEmploymentDates([entry("Jan 2026 – Present")],undefined,now).durationMonths).toEqual([11,11]));
 it("uses year-only bounds",()=>expect(validateEmploymentDates([entry("2020 – 2022")],undefined,now).durationMonths).toEqual([14,36]));
 it("does not repair invalid months",()=>expect(validateEmploymentDates([entry("13/2020 – 12/2022")],undefined,now).findings[0].kind).toBe("invalid"));
 it("does not swap reversed ranges",()=>expect(validateEmploymentDates([entry("Jun 2019 – May 2015")],undefined,now).findings[0].kind).toBe("reversed"));
 it("flags future employment and optional uncovered gaps",()=>{
  const a=validateEmploymentDates([entry("Jan 2020 – Dec 2020"),entry("Jan 2022 – Dec 2022"),entry("Jan 2030 – Present")],undefined,now);
  expect(a.findings.some(f=>f.kind==="gap")).toBe(true); expect(a.findings.some(f=>f.kind==="reversed")).toBe(true);
  expect(validateEmploymentDates([entry("Jan 2030 – Dec 2031")],undefined,now).findings[0].kind).toBe("future");
 });
 it("flags claimed experience as uncertain, without accusing incomplete history",()=>expect(validateEmploymentDates([entry("Jan 2020 – Dec 2022")],10,now).findings.at(-1)).toMatchObject({kind:"claim_mismatch",certainty:"uncertain"}));
 it("allows explicit concurrent employment",()=>{
  const text="EXPERIENCE\nConsultant part-time Jan 2020 – Dec 2022\nEngineer Jan 2021 – Dec 2022";
  expect(employmentDiagnostics(text,now).findings.find(f=>f.kind==="overlap")?.message).toMatch(/Source labels/); expect(chronologyRatingConflict(text,5,now)).toBeUndefined();
 });
 it("extracts experience only and gates contradicted high ratings",()=>{
  const text="EXPERIENCE\nEngineer at Acme\nJan 2020 – Dec 2022\nAnalyst at Beta\nJan 2021 – Dec 2022\nEDUCATION\n2019 – 2020";
  expect(employmentDiagnostics(text,now).entries).toHaveLength(2);expect(chronologyRatingConflict(text,5,now)).toMatch(/clarification/);
 });
});
