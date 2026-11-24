import {describe,it,expect} from "vitest";
import {severityForRating,consistentSeverity,severityConflict} from "@successpro/domain";
describe("approved Phase4A severity",()=>{
 it.each([[0,"Major"],[1,"Major"],[2,"Major"],[3,"Major"],[4,"Minor"],[5,null]])("maps rating %s to %s",(rating,severity)=>expect(severityForRating(rating as number)).toBe(severity));
 it("reserves Critical for confirmed blockers",()=>{expect(severityForRating(0,true)).toBe("Critical");expect(consistentSeverity(2,[{severity:"Critical",message:"Needs clearer scope"}])[0].severity).toBe("Major");});
 it("rejects positive and negative conflicts",()=>{
  expect(severityConflict(1,[{severity:"Major",message:"No material issues found"}])).toBeTruthy();
  expect(severityConflict(4,[{severity:"Minor",message:"Material contradiction in employment dates"}])).toBeTruthy();
  expect(severityConflict(5,[{severity:"Major",message:"Missing evidence"}])).toBeTruthy();
 });
 it("does not downgrade a serious deficiency",()=>expect(consistentSeverity(1,[{severity:"Minor",message:"Poor evidence"}])[0].severity).toBe("Major"));
 it("rejects invalid rating input",()=>expect(()=>severityForRating(6)).toThrow());
});
