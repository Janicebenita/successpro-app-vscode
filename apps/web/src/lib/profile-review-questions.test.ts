import { describe, expect, it } from "vitest";
import { profileReviewQuestions, unansweredProfileQuestions } from "./profile-review-questions";

const draft = {
  summary: "Commercial leader with verified regional experience.", skills: ["Commercial planning"], education: [{ id: "education-1" }],
  currentRole: "Regional Director", experience: [{ id: "role-1", title: "Regional Director", endDate: "Jul 2020" }],
};

describe("resume detail confirmation", () => {
  it("requires an actual edit when the named current role has a past end date", () => {
    const warnings = ["Role Regional Director has an end date of Jul 2020; confirm whether the candidate is currently active in this role."];
    const questions = profileReviewQuestions(draft as never, warnings);
    expect(questions).toEqual([expect.objectContaining({ id: "current-role-ended", requiresEdit: true })]);
    expect(unansweredProfileQuestions(draft as never, warnings, ["current-role-ended"])).toHaveLength(1);
  });

  it("clears the conflict when the customer corrects the role date or current role", () => {
    const warnings = ["Role Regional Director has an end date of Jul 2020; confirm whether the candidate is currently active in this role."];
    expect(profileReviewQuestions({ ...draft, experience: [{ id: "role-1", title: "Regional Director", endDate: "Present" }] } as never, warnings)).toEqual([]);
    expect(profileReviewQuestions({ ...draft, currentRole: "Independent Consultant" } as never, warnings)).toEqual([]);
  });
});
