import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { JobRecord } from "@successpro/contracts/jobs";
import { postedWithinDays } from "./connectors";

export type CareerjetVisitor = { ip: string; userAgent: string; referer: string };
export type CareerjetResult = { type: "jobs"; jobs: JobRecord[] } | { type: "locations"; locations: string[] };
const clean = (value: unknown) => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const hash = (value: string) => createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 32);

export function normalizeCareerjetResponse(body: unknown, now = new Date()): CareerjetResult {
  if (!body || typeof body !== "object") throw new Error("CAREERJET_INVALID_RESPONSE");
  const root = body as Record<string, unknown>;
  if (root.type === "LOCATIONS") return { type: "locations", locations: Array.isArray(root.locations) ? root.locations.filter((value): value is string => typeof value === "string").slice(0, 20) : [] };
  if (root.type !== "JOBS" || !Array.isArray(root.jobs)) throw new Error("CAREERJET_INVALID_RESPONSE");
  const today = now.toISOString().slice(0, 10);
  const jobs: JobRecord[] = [];
  for (const item of root.jobs.slice(0, 100)) {
    if (!item || typeof item !== "object") continue;
    const job = item as Record<string, unknown>;
    let link: URL;
    try { link = new URL(String(job.url)); } catch { continue; }
    if (link.protocol !== "https:" || link.username || link.password || !["jobviewtrack.com", "www.jobviewtrack.com", "www.careerjet.co.in", "careerjet.co.in"].includes(link.hostname)) continue;
    const date = new Date(String(job.date));
    if (Number.isNaN(date.valueOf())) continue;
    const postedOn = date.toISOString().slice(0, 10);
    if (!postedWithinDays(postedOn, now)) continue;
    const title = clean(job.title), employer = clean(job.company), location = clean(job.locations);
    if (!title || !employer) continue;
    const periods: Record<string, string> = { Y: "year", M: "month", W: "week", D: "day", H: "hour" };
    const period = periods[String(job.salary_type)];
    const currency = String(job.salary_currency_code ?? "");
    const min = Number(job.salary_min), max = Number(job.salary_max);
    const salaryText = period && /^[A-Z]{3}$/.test(currency) && min > 0 && max >= min ? `${currency} ${min}–${max} / ${period}` : clean(job.salary);
    jobs.push({ id: hash(`careerjet|${link.href}`), sourceId: "careerjet-india", sourceName: "Careerjet", sourceJobId: hash(link.href), canonicalUrl: link.href, firstSeenOn: today, lastSeenOn: today, postedOn, dateBasis: "posted", title, employer, location, employmentType: "", salaryText, description: clean(job.description), normalizedSkills: [], freshness: "current", workMode: /remote/i.test(location) ? "remote" : "unknown", fingerprint: hash(`${employer}|${title}|${location}`) });
  }
  return { type: "jobs", jobs };
}

// Caller must supply a verified initiating visitor context from a trusted edge,
// not arbitrary forwarded headers or a scheduled job's fabricated user identity.
export async function searchCareerjetIndia(role: string, location: string, visitor: CareerjetVisitor): Promise<CareerjetResult> {
  const key = process.env.CAREERJET_INDIA_API_KEY?.trim();
  if (!key || process.env.CAREERJET_INDIA_APPROVED !== "true") throw new Error("CAREERJET_NOT_CONFIGURED");
  if (!isIP(visitor.ip) || !visitor.userAgent.trim() || visitor.userAgent.length > 1_000 || /[\r\n]/.test(visitor.userAgent)) throw new Error("CAREERJET_VISITOR_REQUIRED");
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  const referer = new URL(visitor.referer);
  if (!origin || referer.origin !== new URL(origin).origin || referer.pathname !== "/opportunities" || referer.search || referer.hash || referer.username || referer.password) throw new Error("CAREERJET_INVALID_REFERER");
  if (!role.trim() || role.length > 160 || location.length > 160) throw new Error("CAREERJET_INVALID_QUERY");
  const params = new URLSearchParams({ locale_code: "en_IN", keywords: role.trim(), location: location.trim(), sort: "date", page: "1", page_size: "100", fragment_size: "1500", user_ip: visitor.ip, user_agent: visitor.userAgent });
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://search.api.careerjet.net/v4/query?${params}`, { headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`, Referer: referer.href, Accept: "application/json" }, signal: controller.signal, redirect: "error", cache: "no-store" });
    if (!response.ok) throw new Error("CAREERJET_REQUEST_FAILED");
    return normalizeCareerjetResponse(await response.json());
  } catch { throw new Error("CAREERJET_REQUEST_FAILED"); }
  finally { clearTimeout(timeout); }
}
