import { describe, expect, it } from "vitest";
import { chronologicalFeed, feedEventInputSchema, feedReportSchema } from "./feed";

describe("professional feed rules", () => {
  it("accepts only explicit professional event categories", () => { expect(feedEventInputSchema.safeParse({ category: "award", title: "Industry award", details: "Recognised for a customer success programme." }).success).toBe(true); expect(feedEventInputSchema.safeParse({ category: "status", title: "A post", details: "A general social update that should not pass." }).success).toBe(false); });
  it("keeps the feed chronological", () => { expect(chronologicalFeed([{ id: "old", createdAtMs: 1 }, { id: "new", createdAtMs: 3 }, { id: "middle", createdAtMs: 2 }]).map((item) => item.id)).toEqual(["new", "middle", "old"]); });
  it("requires an explanation for other reports", () => { expect(feedReportSchema.safeParse({ reason: "other", details: "too short" }).success).toBe(false); expect(feedReportSchema.safeParse({ reason: "spam", details: "" }).success).toBe(true); });
});
