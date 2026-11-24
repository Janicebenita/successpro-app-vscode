import { z } from "zod";
import type { PlanId } from "@successpro/domain";

export const paidPlanIdSchema = z.enum(["premium-monthly", "premium-quarterly", "premium-annual"]);
export const supportedBillingCurrencySchema = z.enum(["INR", "USD", "GBP", "EUR", "AED", "SGD", "AUD", "CAD", "JPY", "CHF", "NZD", "ZAR", "SAR"]);

export type PaidPlanId = z.infer<typeof paidPlanIdSchema>;
export type SupportedBillingCurrency = z.infer<typeof supportedBillingCurrencySchema>;

const inrPlanAmounts: Record<PaidPlanId, number> = {
  "premium-monthly": 49_900,
  "premium-quarterly": 129_900,
  "premium-annual": 399_900,
};

export const fxReferenceSchema = z.object({
  base: z.literal("INR").default("INR"),
  asOf: z.string().date(),
  fetchedAt: z.string().datetime(),
  source: z.string().trim().min(1).max(200),
  rates: z.partialRecord(supportedBillingCurrencySchema.exclude(["INR"]), z.number().positive()),
});

export const razorpayPlanMapSchema = z.partialRecord(
  supportedBillingCurrencySchema,
  z.object({
    "premium-monthly": z.string().trim().regex(/^plan_[A-Za-z0-9]+$/),
    "premium-quarterly": z.string().trim().regex(/^plan_[A-Za-z0-9]+$/),
    "premium-annual": z.string().trim().regex(/^plan_[A-Za-z0-9]+$/),
  }),
);

function monthVersion(now: Date) {
  return `plans-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function charmMinorUnits(value: number, currency: SupportedBillingCurrency) {
  const zeroDecimal = currency === "JPY";
  const major = zeroDecimal ? value : value / 100;
  const magnitude = major >= 10_000 ? 100 : major >= 1_000 ? 50 : major >= 100 ? 10 : 1;
  const ceiling = Math.ceil(major / magnitude) * magnitude;
  return zeroDecimal ? Math.max(1, ceiling - 1) : Math.max(99, ceiling * 100 - 1);
}

export function createMonthlyPriceBook(input: { currency: string; fx?: unknown; now?: Date }) {
  const now = input.now ?? new Date();
  const currency = supportedBillingCurrencySchema.safeParse(input.currency.toUpperCase());
  if (!currency.success) return { available: false as const, reason: "unsupported-currency" as const, fallbackCurrency: "INR" as const };
  const version = monthVersion(now);
  if (currency.data === "INR") return {
    available: true as const, currency: "INR" as const, version, fxRate: 1, fxAsOf: "base", fxSource: "SuccessPro INR base price",
    plans: { ...inrPlanAmounts },
  };
  const fx = fxReferenceSchema.safeParse(input.fx);
  if (!fx.success) return { available: false as const, reason: "fx-unavailable" as const, fallbackCurrency: "INR" as const };
  const ageMs = now.getTime() - new Date(`${fx.data.asOf}T23:59:59.999Z`).getTime();
  if (ageMs > 72 * 60 * 60 * 1_000) return { available: false as const, reason: "fx-stale" as const, fallbackCurrency: "INR" as const };
  const rate = fx.data.rates[currency.data];
  if (!rate) return { available: false as const, reason: "rate-unavailable" as const, fallbackCurrency: "INR" as const };
  return {
    available: true as const, currency: currency.data, version, fxRate: rate, fxAsOf: fx.data.asOf, fxSource: fx.data.source,
    pricingRuleVersion: "international-130-charm-v1",
    plans: Object.fromEntries(Object.entries(inrPlanAmounts).map(([plan, amount]) => [plan, charmMinorUnits(amount * rate * 1.3, currency.data)])) as Record<PaidPlanId, number>,
  };
}

export function resolveSignupPriceLock(input: { planId: PlanId; currency: string; fx?: unknown; now?: Date }) {
  const now = input.now ?? new Date();
  if (input.planId === "free") return { planId: "free" as const, currency: "INR" as const, amount: 0, priceBookVersion: monthVersion(now), fxRate: 1, fxAsOf: "base", lockedAt: now.toISOString() };
  const plan = paidPlanIdSchema.parse(input.planId);
  const book = createMonthlyPriceBook({ currency: input.currency, fx: input.fx, now });
  if (!book.available) return null;
  return { planId: plan, currency: book.currency, amount: book.plans[plan], priceBookVersion: book.version, fxRate: book.fxRate, fxAsOf: book.fxAsOf, lockedAt: now.toISOString() };
}

export function razorpayPlanId(planId: PaidPlanId, currency: SupportedBillingCurrency, raw = process.env.RAZORPAY_PLAN_IDS_JSON) {
  if (!raw) return null;
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return null; }
  const parsed = razorpayPlanMapSchema.safeParse(json);
  return parsed.success ? parsed.data[currency]?.[planId] ?? null : null;
}

export function configuredFxReference(raw = process.env.FX_REFERENCE_JSON) {
  if (!raw) return null;
  try { const parsed = fxReferenceSchema.safeParse(JSON.parse(raw)); return parsed.success ? parsed.data : null; } catch { return null; }
}

export function parseEcbReferenceXml(xml: string, fetchedAt = new Date()) {
  if (xml.length > 500_000) throw new Error("FX reference response is too large");
  const date = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/i)?.[1];
  if (!date) throw new Error("FX reference date is missing");
  const euroRates = new Map<string, number>();
  for (const match of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/gi)) euroRates.set(match[1].toUpperCase(), Number(match[2]));
  const inrPerEuro = euroRates.get("INR");
  if (!inrPerEuro || !Number.isFinite(inrPerEuro)) throw new Error("FX reference does not contain INR");
  const rates: Partial<Record<Exclude<SupportedBillingCurrency, "INR">, number>> = {};
  for (const currency of supportedBillingCurrencySchema.options) {
    if (currency === "INR") continue;
    const perEuro = euroRates.get(currency);
    if (perEuro && Number.isFinite(perEuro)) rates[currency] = Number((perEuro / inrPerEuro).toPrecision(12));
  }
  return fxReferenceSchema.parse({ base: "INR", asOf: date, fetchedAt: fetchedAt.toISOString(), source: "European Central Bank euro reference rates", rates });
}
