import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AuthSwitchLink } from "./auth-switch-link";

afterEach(cleanup);
describe("authentication journey switching", () => {
  it.each(["mentor", "recruiter"])("returns %s registration to its dedicated login", (audience) => {
    render(<AuthSwitchLink signup destination={`/${audience}`} />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", `/${audience}/login?returnTo=%2F${audience}`);
  });
  it("retains a nested candidate destination when switching to registration", () => {
    render(<AuthSwitchLink signup={false} destination="/profile?from=resume&next=/documents" />);
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup?returnTo=%2Fprofile%3Ffrom%3Dresume%26next%3D%2Fdocuments");
  });
});
