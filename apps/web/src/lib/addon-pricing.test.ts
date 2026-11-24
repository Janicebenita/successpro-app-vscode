import { afterEach, describe, expect, it, vi } from "vitest";
import { addonPrice } from "@/lib/addon-pricing";

afterEach(() => vi.unstubAllEnvs());
describe("one-time writing add-on prices", () => {
  it("keeps authoritative INR prices in minor units", () => {
    expect(addonPrice("resume-writer", "INR")?.amount).toBe(1_000_000);
    expect(addonPrice("career-document-suite", "INR")?.amount).toBe(1_500_000);
  });
  it("requires a dated controlled FX reference for international pricing", () => {
    expect(addonPrice("resume-writer", "USD")).toBeNull();
    vi.stubEnv("FX_REFERENCE_JSON", JSON.stringify({ asOf: "2026-09-23", rates: { USD: 0.012 } }));
    const price = addonPrice("resume-writer", "USD");
    expect(price?.currency).toBe("USD");
    expect(price?.pricingVersion).toBe("addons-v1-international-130");
    expect(price?.amount).toBeGreaterThan(0);
  });
});
