import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { canonicalProfileSchema } from "@successpro/contracts";
import { CareerPortrait } from "./career-portrait";

const profile = canonicalProfileSchema.parse({
  fullName: "Roadmap Candidate",
  headline: "Commercial leader",
  location: "Mumbai, India",
  summary: "Builds durable commercial teams and growth strategies.",
  currentRole: "Director",
  industry: "Technology",
  skills: ["Strategy", "Leadership"],
  experience: [
    { id: "current", title: "Director", employer: "Northstar", startDate: "2022", endDate: "Present", achievements: ["Led a national expansion."] },
    { id: "prior", title: "Manager", employer: "Harbor", startDate: "2018", endDate: "2022", achievements: ["Improved planning."] },
  ],
  education: [{ id: "mba", qualification: "MBA", institution: "Example School", startDate: "2016", endDate: "2018" }],
  projects: [], certifications: [], awards: [], publications: [], volunteerExperience: [], languages: [], links: [], targetRoles: [], openToWork: false, publicProfileEnabled: false,
});

afterEach(cleanup);

describe("career portrait", () => {
  it("shows availability only when enabled and keeps the membership theme explicit", () => {
    const { container, rerender } = render(<CareerPortrait profile={profile} />);
    expect(container.querySelector(".career-edition-essential")).toBeInTheDocument();
    expect(screen.queryByText("Open to work")).not.toBeInTheDocument();
    rerender(<CareerPortrait profile={{ ...profile, openToWork: true }} premium />);
    expect(container.querySelector(".career-edition-signature")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Open to work");
  });
  it("shows only positive profile signals and hides an empty highlights section", () => {
    render(<CareerPortrait profile={profile} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("Awards, achievements and credentials")).not.toBeInTheDocument();
    expect(screen.getByText("roles")).toBeInTheDocument();
    expect(screen.getByText("skills")).toBeInTheDocument();
  });

  it("renders the present role first in the reverse-chronology roadmap", () => {
    render(<CareerPortrait profile={profile} />);
    const labels = [...screen.getByLabelText("Career milestones in reverse chronological order").querySelectorAll("strong")].map((element) => element.textContent);
    expect(labels).toEqual(["Director", "Manager", "MBA"]);
    expect(screen.getByText("Current chapter")).toBeInTheDocument();
  });
});
