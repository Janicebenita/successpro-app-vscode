const countryCurrencies: Array<[RegExp, string]> = [
  [/\b(india|bengaluru|bangalore|mumbai|delhi|gurugram|gurgaon|hyderabad|chennai|pune|kolkata)\b/i, "INR"],
  [/\b(united states|usa|u\.s\.|new york|california|texas|washington|chicago|boston)\b/i, "USD"],
  [/\b(united kingdom|uk|england|scotland|wales|london|manchester|edinburgh)\b/i, "GBP"],
  [/\b(united arab emirates|uae|dubai|abu dhabi)\b/i, "AED"],
  [/\b(singapore)\b/i, "SGD"],
  [/\b(australia|sydney|melbourne|brisbane|perth)\b/i, "AUD"],
  [/\b(canada|toronto|vancouver|montreal|ottawa)\b/i, "CAD"],
  [/\b(japan|tokyo|osaka)\b/i, "JPY"],
  [/\b(switzerland|zurich|geneva)\b/i, "CHF"],
  [/\b(new zealand|auckland|wellington)\b/i, "NZD"],
  [/\b(south africa|johannesburg|cape town)\b/i, "ZAR"],
  [/\b(saudi arabia|riyadh|jeddah)\b/i, "SAR"],
  [/\b(germany|france|spain|italy|ireland|netherlands|belgium|portugal|austria|finland|greece)\b/i, "EUR"],
];

export function currencyForLocation(location: string, fallback = "INR") {
  return countryCurrencies.find(([pattern]) => pattern.test(location))?.[1] ?? fallback;
}

const adzunaCountries: Array<[RegExp, string]> = [
  [/\b(india|bengaluru|bangalore|mumbai|delhi|gurugram|gurgaon|hyderabad|chennai|pune|kolkata)\b/i, "in"],
  [/\b(united states|usa|u\.s\.|new york|california|texas|washington|chicago|boston)\b/i, "us"],
  [/\b(united kingdom|uk|england|scotland|wales|london|manchester|edinburgh)\b/i, "gb"],
  [/\b(singapore)\b/i, "sg"], [/\b(australia|sydney|melbourne|brisbane|perth)\b/i, "au"], [/\b(canada|toronto|vancouver|montreal|ottawa)\b/i, "ca"],
  [/\b(germany)\b/i, "de"], [/\b(france)\b/i, "fr"], [/\b(spain)\b/i, "es"], [/\b(italy)\b/i, "it"], [/\b(netherlands)\b/i, "nl"],
  [/\b(switzerland|zurich|geneva)\b/i, "ch"], [/\b(new zealand|auckland|wellington)\b/i, "nz"], [/\b(south africa|johannesburg|cape town)\b/i, "za"],
];

export function adzunaCountryForLocation(location: string) { return adzunaCountries.find(([pattern]) => pattern.test(location))?.[1] ?? null; }

export function locationMatches(jobLocation: string, preferences: string[]) {
  const job = jobLocation.toLocaleLowerCase();
  const exact = preferences.some((location) => location.toLocaleLowerCase().split(",").map((part) => part.trim()).filter(Boolean).every((part) => job.includes(part)));
  if (exact) return "preferred" as const;
  const countries = preferences.flatMap((location) => countryCurrencies.filter(([pattern]) => pattern.test(location)).map(([, currency]) => currency));
  const close = countryCurrencies.some(([pattern, currency]) => countries.includes(currency) && pattern.test(job));
  return close ? "close" as const : "outside" as const;
}
