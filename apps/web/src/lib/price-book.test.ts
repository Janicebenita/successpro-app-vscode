import { describe, expect, it } from "vitest";
import { createMonthlyPriceBook, parseEcbReferenceXml, razorpayPlanId, resolveSignupPriceLock } from "@/lib/price-book";

const now = new Date("2026-09-24T10:00:00.000Z");
const fx = { base: "INR", asOf: "2026-09-24", fetchedAt: "2026-09-24T08:00:00.000Z", source: "reference-feed", rates: { USD: 0.012, GBP: 0.009, EUR: 0.011, AED: 0.044, SGD: 0.016, AUD: 0.018, CAD: 0.016, JPY: 1.75, CHF: 0.01, NZD: 0.02, ZAR: 0.21, SAR: 0.045 } };

describe("monthly price book", () => {
  it("preserves authoritative INR prices and monthly version", () => {
    const book = createMonthlyPriceBook({ currency: "INR", now });
    expect(book).toMatchObject({ available: true, currency: "INR", version: "plans-2026-09", plans: { "premium-monthly": 49_900, "premium-quarterly": 129_900, "premium-annual": 399_900 } });
  });

  it("converts and locally rounds supported currencies", () => {
    const book = createMonthlyPriceBook({ currency: "USD", fx, now });
    expect(book).toMatchObject({ available: true, currency: "USD", fxRate: 0.012, fxAsOf: "2026-09-24", pricingRuleVersion: "international-130-charm-v1" });
    if (book.available) {
      expect(book.plans["premium-monthly"]).toBeGreaterThanOrEqual(Math.ceil(49_900 * 0.012 * 1.3));
      expect(book.plans["premium-monthly"] % 100).toBe(99);
    }
  });

  it("fails safely for stale, missing, and unsupported FX", () => {
    expect(createMonthlyPriceBook({ currency: "USD", fx: { ...fx, asOf: "2026-09-01" }, now })).toMatchObject({ available: false, reason: "fx-stale", fallbackCurrency: "INR" });
    expect(createMonthlyPriceBook({ currency: "USD", now })).toMatchObject({ available: false, reason: "fx-unavailable" });
    expect(createMonthlyPriceBook({ currency: "BRL", fx, now })).toMatchObject({ available: false, reason: "unsupported-currency" });
  });

  it("locks the exact server price and FX provenance at signup", () => {
    expect(resolveSignupPriceLock({ planId: "premium-quarterly", currency: "GBP", fx, now })).toMatchObject({ planId: "premium-quarterly", currency: "GBP", priceBookVersion: "plans-2026-09", fxRate: 0.009, fxAsOf: "2026-09-24", lockedAt: now.toISOString() });
  });

  it("accepts only complete validated Razorpay per-currency mappings", () => {
    const raw = JSON.stringify({ INR: { "premium-monthly": "plan_monthly1", "premium-quarterly": "plan_quarterly1", "premium-annual": "plan_annual1" } });
    expect(razorpayPlanId("premium-annual", "INR", raw)).toBe("plan_annual1");
    expect(razorpayPlanId("premium-annual", "USD", raw)).toBeNull();
    expect(razorpayPlanId("premium-annual", "INR", "{}")).toBeNull();
  });

  it("normalizes official EUR-base reference XML into INR-base rates", () => {
    const parsed = parseEcbReferenceXml(`<Envelope><Cube><Cube time='2026-09-24'><Cube currency='INR' rate='100'/><Cube currency='USD' rate='1.2'/><Cube currency='GBP' rate='0.9'/></Cube></Cube></Envelope>`, now);
    expect(parsed).toMatchObject({ base: "INR", asOf: "2026-09-24", source: "European Central Bank euro reference rates", rates: { USD: 0.012, GBP: 0.009 } });
  });
});
