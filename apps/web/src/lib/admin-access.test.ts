import { describe, expect, it } from "vitest";
import { adminRolesFor } from "./admin-access";
import { moderationTransition } from "./moderation";

describe("admin access and moderation workflow", () => {
  it("denies arbitrary claims and accepts only known roles", () => {
    expect(adminRolesFor({ email: "member@example.com", email_verified: true, adminRoles: ["support_admin", "made_up_admin"] })).toEqual(["support_admin"]);
    expect(adminRolesFor({ email: "member@example.com", email_verified: true, adminRole: "member" })).toEqual([]);
  });

  it("does not reopen terminal moderation decisions", () => {
    expect(moderationTransition("new", "reviewing")).toBe(true);
    expect(moderationTransition("reviewing", "resolved")).toBe(true);
    expect(moderationTransition("resolved", "reviewing")).toBe(false);
    expect(moderationTransition("dismissed", "resolved")).toBe(false);
  });
});
