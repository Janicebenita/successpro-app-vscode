import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { canonicalProfileSchema } from "@successpro/contracts";
import { publicProfileProjection } from "@/lib/public-profile";
import { PublicPortrait } from "./public-portrait";

afterEach(cleanup);
it("builds the public roadmap exclusively from the published visibility projection", () => {
  const profile = canonicalProfileSchema.parse({ fullName: "Test Member", headline: "Product leader", summary: "", location: "", currentRole: "", industry: "", skills: [], targetRoles: [], experience: [{ id: "private", title: "Hidden role", employer: "Private employer", startDate: "2020", endDate: "Present", achievements: [] }], education: [{ id: "degree", qualification: "MBA", institution: "Public school", startDate: "2016", endDate: "2018" }], publicProfileVisibility: { experience: false } });
  render(<PublicPortrait profile={publicProfileProjection(profile)} premium />);
  expect(screen.queryByText("Hidden role")).not.toBeInTheDocument();
  expect(screen.getByText("MBA")).toBeInTheDocument();
});
