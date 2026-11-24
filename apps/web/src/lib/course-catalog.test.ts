import { describe, expect, it } from "vitest";
import { courseCatalogEntrySchema } from "@successpro/contracts/learning";
import { courseCatalog } from "./course-catalog";

describe("learning source catalog", () => {
  it("keeps every built-in source within the customer-facing contract", () => {
    for (const course of courseCatalog) expect(courseCatalogEntrySchema.safeParse(course).success).toBe(true);
  });

  it("requires disclosure for an affiliate source", () => {
    const base = { ...courseCatalog[0], affiliate: true, affiliateDisclosure: "" };
    expect(courseCatalogEntrySchema.safeParse(base).success).toBe(false);
    expect(courseCatalogEntrySchema.safeParse({ ...base, affiliateDisclosure: "SuccessPro may receive a referral payment; ranking is unaffected." }).success).toBe(true);
  });

  it("rejects executable URLs and invalid catalog identifiers", () => {
    expect(courseCatalogEntrySchema.safeParse({ ...courseCatalog[0], id: "Bad ID", url: "javascript:alert(1)" }).success).toBe(false);
  });
});
