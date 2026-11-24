import type { CanonicalProfile, CareerGoal, JobPreferences } from "@successpro/contracts";
import { currencyForLocation } from "./geography";

function distinct(values: string[], limit: number) {
  return values.map((value) => value.trim()).filter(Boolean)
    .filter((value, index, all) => all.findIndex((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase()) === index)
    .slice(0, limit);
}

/** A starting search, not a saved statement of the customer's preferences. */
export function jobSuggestionsFromProfile(profile: CanonicalProfile): JobPreferences {
  const location = profile.location.trim();
  return {
    roleTitles: distinct([...profile.targetRoles, profile.currentRole || profile.experience[0]?.title || ""], 5),
    locations: location ? [location] : [],
    workModes: ["remote", "hybrid", "onsite"],
    employmentTypes: ["full-time"],
    industries: distinct([profile.industry], 3),
    keywords: distinct(profile.skills, 12),
    // Partial dates and overlapping roles cannot justify a precise tenure.
    experienceYears: null,
    salaryMinimum: null,
    currency: currencyForLocation(location),
    excludedEmployers: [],
  };
}

/** Show a suggested direction before the member has saved a formal goal. */
export function goalSuggestionFromProfile(profile: CanonicalProfile): CareerGoal | null {
  const targetRole = profile.targetRoles[0]?.trim() || profile.currentRole.trim() || profile.experience[0]?.title.trim();
  if (!targetRole) return null;
  return {
    targetRole,
    targetDate: "",
    motivation: "",
    targetSalary: null,
    currency: currencyForLocation(profile.location),
    targetCompany: "",
    targetIndustry: profile.industry,
    targetGeography: profile.location,
    targetSkill: "",
    tasks: [],
  };
}
