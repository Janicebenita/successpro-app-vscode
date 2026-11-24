import { describe, expect, it } from "vitest";
import { formatIndiaDate } from "./format-date";

describe("formatIndiaDate", () => {
  it("shows the next day when UTC is still the evening before India's midnight", () => {
    expect(formatIndiaDate("2026-11-27T18:30:00.000Z")).toBe("28 November 2026");
  });
  it("keeps the same day for an early-UTC time", () => {
    expect(formatIndiaDate("2026-11-27T00:00:00.000Z")).toBe("27 November 2026");
  });
  it("returns null for empty values", () => {
    expect(formatIndiaDate(null)).toBeNull();
    expect(formatIndiaDate("")).toBeNull();
  });
  it("returns null for an invalid date", () => {
    expect(formatIndiaDate("not a date")).toBeNull();
  });
});
