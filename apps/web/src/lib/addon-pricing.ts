import { z } from "zod";

export const addonIdSchema = z.enum(["resume-writer", "career-document-suite"]);
export type AddonId = z.infer<typeof addonIdSchema>;

const catalog = {
  "resume-writer": { name: "Professional resume writing", inr: 1_000_000, description: "One resume-writing project with an assigned professional writer." },
  "career-document-suite": { name: "Resume, cover letter and LinkedIn writing", inr: 1_500_000, description: "One coordinated resume, cover-letter and LinkedIn-profile writing project." },
} as const;

const fxSchema = z.object({ asOf: z.string().date(), rates: z.record(z.string().length(3), z.number().positive()) });
const supported = new Set(["INR", "USD", "GBP", "EUR", "AED", "SGD", "AUD", "CAD", "JPY", "CHF", "NZD", "ZAR", "SAR"]);

function charm(value: number) { const whole = Math.max(1, Math.round(value / 100)); const magnitude = whole >= 10_000 ? 100 : whole >= 1_000 ? 50 : whole >= 100 ? 10 : 1; return Math.max(magnitude - 1, Math.ceil(whole / magnitude) * magnitude - 1) * 100; }

export function addonPrice(addonId: AddonId, currency: string) {
  const product = catalog[addonId]; const normalized = currency.toUpperCase();
  if (normalized === "INR") return { ...product, currency: "INR", amount: product.inr, fxRate: 1, fxAsOf: "base", pricingVersion: "addons-v1" };
  if (!supported.has(normalized)) return null;
  const parsed = fxSchema.safeParse(JSON.parse(process.env.FX_REFERENCE_JSON || "{}"));
  if (!parsed.success) return null;
  const rate = parsed.data.rates[normalized];
  if (!rate) return null;
  return { ...product, currency: normalized, amount: charm(product.inr * rate * 1.3), fxRate: rate, fxAsOf: parsed.data.asOf, pricingVersion: "addons-v1-international-130" };
}

export function addonCatalog(currency: string) { return addonIdSchema.options.map((id) => ({ id, price: addonPrice(id, currency) })); }
