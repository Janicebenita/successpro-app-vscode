import { describe, expect, it } from "vitest";
import { networkSearchMatches, networkSuggestion, normalizedNetworkText, type NetworkProfile } from "./network";

const profile: NetworkProfile = { id: "sp-1", ownerId: "member-1", fullName: "Ana Müller", headline: "Product leader", currentRole: "Director of Product", employer: "Northstar", industry: "Technology", location: "Berlin", skills: ["Analytics", "Product strategy"], published: true };

describe("privacy-safe professional network", () => {
  it("normalizes international names and searches only supplied public fields", () => { expect(normalizedNetworkText("  ANA—MÜLLER ")).toBe("ana müller"); expect(networkSearchMatches(profile, "müller product")).toBe(true); expect(networkSearchMatches(profile, "private@example.com")).toBe(false); });
  it("explains suggestions from non-sensitive shared professional signals", () => { const result = networkSuggestion(profile, { industry: "Technology", location: "Berlin", skills: ["Analytics"] }); expect(result.score).toBeGreaterThan(0); expect(result.reason).toContain("Technology"); expect(JSON.stringify(result)).not.toMatch(/age|gender|email/i); });
});
