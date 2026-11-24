import { describe, expect, it } from "vitest";
import { recruiterApplicationSchema, recruiterDecisionSchema } from "./recruiter-account";

describe("recruiter due diligence", () => {
  const valid = { organizationName: "Example Industries", organizationWebsite: "https://example.com", workEmail: "recruiter@example.com", recruiterTitle: "Talent Partner", registrationJurisdiction: "India", registrationNumber: "CIN-123456", hiringPurpose: "We recruit permanent product and engineering employees for our organization.", authorityConfirmed: true };
  it("requires organization and hiring-authority evidence", () => { expect(recruiterApplicationSchema.safeParse(valid).success).toBe(true); expect(recruiterApplicationSchema.safeParse({ ...valid, organizationWebsite: "http://example.com" }).success).toBe(false); expect(recruiterApplicationSchema.safeParse({ ...valid, authorityConfirmed: false }).success).toBe(false); });
  it("requires an auditable decision reason", () => { expect(recruiterDecisionSchema.safeParse({ status: "approved", reason: "Registration and organization identity verified." }).success).toBe(true); expect(recruiterDecisionSchema.safeParse({ status: "rejected", reason: "No" }).success).toBe(false); });
});
