import { describe, expect, it } from "vitest";
import { experienceYearsFromProfile } from "./experience-years";

describe("experienceYearsFromProfile", () => {
  const today = new Date("2026-09-28T00:00:00Z");
  it("uses dated profile roles rather than assuming zero experience", () => {
    const profile = { experience: [
      { startDate: "Jan'22", endDate: "Present" },
      { startDate: "April'18", endDate: "Dec'21" },
      { startDate: "2015", endDate: "2018" },
    ] } as never;
    expect(experienceYearsFromProfile(profile, today)).toBe(10);
  });
  it("does not double count overlapping roles or invent missing dates", () => {
    const profile = { experience: [
      { startDate: "2019", endDate: "2024" },
      { startDate: "2021", endDate: "2025" },
      { startDate: "", endDate: "Present" },
    ] } as never;
    expect(experienceYearsFromProfile(profile, today)).toBe(6);
  });
});
