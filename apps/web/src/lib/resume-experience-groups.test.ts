import { describe, expect, it } from "vitest";
import { groupResumeExperience } from "./resume-experience-groups";

describe("resume experience presentation", () => {
  it("groups adjacent undated title-only roles without losing any title", () => {
    const role = (id: string, title: string, employer: string, startDate = "", achievements: string[] = []) => ({ id, title, employer, startDate, endDate: "", achievements });
    const roles = [role("current", "Director", "Example", "2024", ["Led a team."]), role("one", "Regional Lead", "Example"), role("two", "Country Lead", "Example"), role("other", "Manager", "Other", "2019")];
    const groups = groupResumeExperience(roles);
    expect(groups.map((group) => group.kind)).toEqual(["role", "earlier-roles", "role"]);
    expect(groups[1]).toMatchObject({ kind: "earlier-roles", employer: "Example", roles: [{ title: "Regional Lead" }, { title: "Country Lead" }] });
  });

  it("does not group roles with dates, achievements, or different employers", () => {
    const roles = [
      { id: "one", title: "Lead", employer: "Example", startDate: "", endDate: "", achievements: ["Improved service."] },
      { id: "two", title: "Manager", employer: "Example", startDate: "", endDate: "", achievements: [] },
      { id: "three", title: "Analyst", employer: "Other", startDate: "", endDate: "", achievements: [] },
    ];
    expect(groupResumeExperience(roles).every((group) => group.kind === "role")).toBe(true);
  });
});
