import { describe, expect, it } from "vitest";
import { matchesRecruiterJob, recruiterJobInputSchema } from "./recruiter-jobs";

describe("recruiter job board", () => {
  const job = { title: "Product Manager", department: "Product", location: "Mumbai, India", experienceMinimum: 3, experienceMaximum: 7, ctcMinimum: 2_000_000 };
  it("filters the master board independently of candidate preferences", () => { expect(matchesRecruiterJob(job, new URLSearchParams({ role: "product", location: "mumbai", experience: "5", ctc: "2500000" }))).toBe(true); expect(matchesRecruiterJob(job, new URLSearchParams({ department: "engineering" }))).toBe(false); });
  it("rejects inverted experience and compensation ranges", () => { expect(recruiterJobInputSchema.safeParse({ ...job, workMode: "hybrid", employmentType: "full-time", experienceMinimum: 8, experienceMaximum: 2, ctcMaximum: 1_000_000, currency: "INR", description: "A".repeat(120), skills: [] }).success).toBe(false); });
});
