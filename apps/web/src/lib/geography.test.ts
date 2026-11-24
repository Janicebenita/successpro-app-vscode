import { describe, expect, it } from "vitest";
import { currencyForLocation, locationMatches } from "@/lib/geography";

describe("geography-aware career tools", () => {
  it("selects the local salary currency from present-job geography", () => {
    expect(currencyForLocation("Bengaluru, Karnataka, India")).toBe("INR");
    expect(currencyForLocation("London, United Kingdom")).toBe("GBP");
    expect(currencyForLocation("Dubai, UAE")).toBe("AED");
  });
  it("distinguishes preferred cities from close country matches", () => {
    expect(locationMatches("Bengaluru, Karnataka, India", ["Bengaluru, India"])).toBe("preferred");
    expect(locationMatches("Mumbai, India", ["Bengaluru, India"])).toBe("close");
    expect(locationMatches("Toronto, Canada", ["Bengaluru, India"])).toBe("outside");
  });
});
