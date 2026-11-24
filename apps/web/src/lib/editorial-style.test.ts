import { describe, expect, it } from "vitest";
import { editorialStyle } from "./editorial-style";
describe("editorial presentation", () => {
  it("preserves paragraph boundaries and project links", () => {
    const source = { summary: "First paragraph\n—\nSecond paragraph", link: "https://example.com/a—b" };
    expect(editorialStyle(source)).toEqual({ summary: "First paragraph\n - \nSecond paragraph", link: source.link });
  });
  it("normalizes nested prose without mutating source evidence", () => {
    const source = { summary: "Led delivery—across markets", bullets: ["Growth — verified"], score: 80 };
    expect(editorialStyle(source)).toEqual({ summary: "Led delivery - across markets", bullets: ["Growth - verified"], score: 80 });
    expect(source.summary).toContain("—");
  });
  it("preserves exact workbook resume excerpts and JD source text", () => {
    const value={evidence:{excerpt:"Led delivery—across markets",rationale:"Verified"},sourceText:"SQL—required",excerpt:"A—B"};
    expect(editorialStyle(value)).toEqual(value);
  });
  it("preserves identifiers and addresses", () => {
    expect(editorialStyle({ roleId: "a—b", url: "https://example.com/a—b", title: "A—B" })).toEqual({ roleId: "a—b", url: "https://example.com/a—b", title: "A - B" });
  });
});
