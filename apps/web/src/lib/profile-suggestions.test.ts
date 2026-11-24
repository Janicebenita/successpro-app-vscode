import { describe, expect, it } from "vitest";
import type { CanonicalProfile } from "@successpro/contracts";
import { goalSuggestionFromProfile, jobSuggestionsFromProfile } from "./profile-suggestions";

const profile = { currentRole: "Product Director", targetRoles: ["VP Product", "VP Product"], location: "New York, United States", industry: "Software", skills: ["Product strategy", "Customer research"], experience: [{ title: "Product Director" }] } as CanonicalProfile;

describe("profile-first recommendations", () => {
  it("starts job discovery from career evidence without inventing pay or tenure", () => {
    const suggestion = jobSuggestionsFromProfile(profile);
    expect(suggestion.roleTitles).toEqual(["VP Product", "Product Director"]);
    expect(suggestion.locations).toEqual(["New York, United States"]);
    expect(suggestion.keywords).toEqual(["Product strategy", "Customer research"]);
    expect(suggestion.experienceYears).toBeNull();
    expect(suggestion.salaryMinimum).toBeNull();
    expect(suggestion.currency).toBe("USD");
  });
  it("offers an editable direction but never invents a target salary or date", () => {
    expect(goalSuggestionFromProfile(profile)).toMatchObject({ targetRole: "VP Product", targetGeography: "New York, United States", targetSalary: null, targetDate: "", currency: "USD" });
  });
});
