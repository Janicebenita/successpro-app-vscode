import { createHash } from "node:crypto";
import type { JobPreferences } from "@successpro/contracts";
import type { JobRecord, JobSource } from "@successpro/contracts/jobs";
import { adzunaCountryForLocation } from "@/lib/geography";
import { adminDb } from "@/lib/firebase-admin";

type IncomingJob = Omit<JobRecord, "id" | "fingerprint" | "firstSeenOn" | "lastSeenOn" | "freshness">;

function plainText(value: unknown) {
  return String(value ?? "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

function workMode(text: string): JobRecord["workMode"] { const value = text.toLowerCase(); return value.includes("remote") ? "remote" : value.includes("hybrid") ? "hybrid" : value ? "onsite" : "unknown"; }
function skillTerms(text: string) { const common = ["javascript", "typescript", "python", "java", "sql", "aws", "azure", "gcp", "product management", "project management", "analytics", "data analysis", "machine learning", "artificial intelligence", "cybersecurity", "leadership", "customer success", "sales", "marketing", "finance", "design", "research", "communication"]; const lower = text.toLowerCase(); return common.filter((term) => lower.includes(term)); }
function digest(value: string) { return createHash("sha256").update(value.toLowerCase().replace(/\s+/g, " ")).digest("hex").slice(0, 32); }

async function fetchJson(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12_000);
  try { const response = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: controller.signal, cache: "no-store", redirect: "error" }); if (!response.ok) throw new Error(`JOB_SOURCE_HTTP_${response.status}`); return await response.json(); }
  finally { clearTimeout(timer); }
}

async function greenhouse(source: JobSource): Promise<IncomingJob[]> {
  if (!/^[a-z0-9_-]{1,100}$/i.test(source.token)) throw new Error("INVALID_GREENHOUSE_TOKEN");
  const body = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.token)}/jobs?content=true`);
  return (Array.isArray(body?.jobs) ? body.jobs : []).slice(0, 500).map((item: Record<string, unknown>) => { const description = plainText(item.content); const location = plainText((item.location as { name?: string })?.name); return { sourceId: source.id, sourceName: source.name, sourceJobId: String(item.id), canonicalUrl: String(item.absolute_url), postedOn: String(item.updated_at ?? "").slice(0, 10), employer: source.employer || source.name, title: plainText(item.title), location, employmentType: "", salaryText: "", description, normalizedSkills: skillTerms(description), workMode: workMode(`${location} ${description.slice(0, 600)}`) }; });
}

async function lever(source: JobSource): Promise<IncomingJob[]> {
  if (!/^[a-z0-9_-]{1,100}$/i.test(source.token)) throw new Error("INVALID_LEVER_SITE");
  const host = source.region === "eu" ? "api.eu.lever.co" : "api.lever.co";
  const body = await fetchJson(`https://${host}/v0/postings/${encodeURIComponent(source.token)}?mode=json&limit=500`);
  return (Array.isArray(body) ? body : []).slice(0, 500).map((item: Record<string, unknown>) => { const categories = item.categories as Record<string, unknown> | undefined; const description = plainText(`${item.descriptionPlain ?? item.description ?? ""} ${item.additionalPlain ?? ""}`); const location = plainText(categories?.location); return { sourceId: source.id, sourceName: source.name, sourceJobId: String(item.id), canonicalUrl: String(item.hostedUrl ?? item.applyUrl), postedOn: item.createdAt ? new Date(Number(item.createdAt)).toISOString().slice(0, 10) : "", employer: source.employer || source.name, title: plainText(item.text), location, employmentType: plainText(categories?.commitment), salaryText: plainText(item.salaryDescription), description, normalizedSkills: skillTerms(description), workMode: workMode(`${categories?.workplaceType ?? ""} ${location} ${description.slice(0, 600)}`) }; });
}

async function usajobs(source: JobSource): Promise<IncomingJob[]> {
  const apiKey = process.env.USAJOBS_API_KEY?.trim();
  const userAgent = process.env.USAJOBS_USER_AGENT?.trim();
  if (!apiKey || !userAgent) throw new Error("USAJOBS_CREDENTIALS_NOT_CONFIGURED");
  if (!source.token.trim() || source.token.length > 120) throw new Error("INVALID_USAJOBS_KEYWORD");
  const parameters = new URLSearchParams({ Keyword: source.token.trim(), ResultsPerPage: "500" });
  const body = await fetchJson(`https://data.usajobs.gov/api/search?${parameters.toString()}`, { "Authorization-Key": apiKey, "User-Agent": userAgent, Host: "data.usajobs.gov" });
  const items = body?.SearchResult?.SearchResultItems;
  return (Array.isArray(items) ? items : []).slice(0, 500).map((entry: Record<string, unknown>) => {
    const item = (entry.MatchedObjectDescriptor ?? {}) as Record<string, unknown>;
    const userArea = (item.UserArea ?? {}) as Record<string, unknown>;
    const details = (userArea.Details ?? {}) as Record<string, unknown>;
    const locations = Array.isArray(item.PositionLocation) ? item.PositionLocation as Array<Record<string, unknown>> : [];
    const location = plainText(item.PositionLocationDisplay ?? locations.map((value) => value.LocationName).join(", "));
    const schedules = Array.isArray(item.PositionSchedule) ? item.PositionSchedule as Array<Record<string, unknown>> : [];
    const remuneration = Array.isArray(item.PositionRemuneration) ? item.PositionRemuneration as Array<Record<string, unknown>> : [];
    const pay = remuneration[0];
    const salaryText = pay ? plainText(`${pay.MinimumRange ?? ""}-${pay.MaximumRange ?? ""} ${pay.Description ?? ""}`) : "";
    const description = plainText(`${details.JobSummary ?? ""} ${details.MajorDuties ?? ""} ${details.Requirements ?? ""}`);
    return { sourceId: source.id, sourceName: source.name, sourceJobId: String(item.PositionID ?? entry.MatchedObjectId ?? ""), canonicalUrl: String(item.PositionURI ?? ""), postedOn: String(item.PublicationStartDate ?? "").slice(0, 10), employer: plainText(item.OrganizationName ?? source.employer ?? source.name), title: plainText(item.PositionTitle), location, employmentType: plainText(schedules.map((value) => value.Name).join(", ")), salaryText, description, normalizedSkills: skillTerms(description), workMode: workMode(`${location} ${description.slice(0, 600)}`) };
  });
}

async function adzuna(source: JobSource): Promise<IncomingJob[]> {
  const appId = process.env.ADZUNA_APP_ID?.trim();
  const appKey = process.env.ADZUNA_APP_KEY?.trim();
  if (!appId || !appKey) throw new Error("ADZUNA_CREDENTIALS_NOT_CONFIGURED");
  if (!/^[a-z]{2}$/.test(source.countryCode)) throw new Error("INVALID_ADZUNA_COUNTRY");
  const parameters = new URLSearchParams({ app_id: appId, app_key: appKey, results_per_page: "50", max_days_old: "30", sort_by: "date", "content-type": "application/json" });
  if (source.token.trim()) parameters.set("what", source.token.trim().slice(0, 160));
  if (source.location.trim()) parameters.set("where", source.location.trim().slice(0, 160));
  const body = await fetchJson(`https://api.adzuna.com/v1/api/jobs/${source.countryCode}/search/1?${parameters.toString()}`);
  return (Array.isArray(body?.results) ? body.results : []).slice(0, 500).map((item: Record<string, unknown>) => {
    const description = plainText(item.description);
    const location = plainText((item.location as { display_name?: string })?.display_name);
    const employer = plainText((item.company as { display_name?: string })?.display_name ?? source.name);
    const salaryMin = Number(item.salary_min); const salaryMax = Number(item.salary_max);
    const salaryText = Number.isFinite(salaryMin) && Number.isFinite(salaryMax) ? `${salaryMin}-${salaryMax}` : "";
    return { sourceId: source.id, sourceName: source.name, sourceJobId: String(item.id), canonicalUrl: String(item.redirect_url ?? ""), postedOn: String(item.created ?? "").slice(0, 10), employer, title: plainText(item.title), location, employmentType: plainText(item.contract_time ?? item.contract_type), salaryText, description, normalizedSkills: skillTerms(description), workMode: workMode(`${location} ${description.slice(0, 600)}`) };
  });
}

export function normalizeJobicyJobs(body: unknown, source: JobSource): IncomingJob[] {
  const root = body && typeof body === "object" ? body as Record<string, unknown> : {};
  return (Array.isArray(root.jobs) ? root.jobs as Array<Record<string, unknown>> : []).slice(0, 200).map((item) => {
    const geo = plainText(item.jobGeo);
    const location = /^(?:anywhere|worldwide|global)$/i.test(geo) ? "Remote" : geo;
    const minimum = Number(item.salaryMin); const maximum = Number(item.salaryMax);
    const salaryText = minimum > 0 && maximum >= minimum && /^[A-Z]{3}$/.test(String(item.salaryCurrency ?? ""))
      ? `${item.salaryCurrency} ${minimum}–${maximum}${item.salaryPeriod ? ` / ${plainText(item.salaryPeriod)}` : ""}` : "";
    const description = plainText(item.jobDescription);
    return { sourceId: source.id, sourceName: "Jobicy", sourceJobId: String(item.id ?? ""), canonicalUrl: String(item.url ?? ""), postedOn: String(item.pubDate ?? "").slice(0, 10), employer: plainText(item.companyName), title: plainText(item.jobTitle), location, employmentType: plainText(Array.isArray(item.jobType) ? item.jobType.join(", ") : item.jobType), salaryText, description, normalizedSkills: skillTerms(description), workMode: "remote" as const };
  });
}

async function jobicy(source: JobSource): Promise<IncomingJob[]> {
  // Public integration is permitted with attribution and Jobicy's canonical
  // URL. Poll only through the shared ingestion job, never per customer view.
  const body = await fetchJson("https://jobicy.com/api/v2/remote-jobs?count=200");
  return normalizeJobicyJobs(body, source);
}

export function normalizeJoobleJobs(body: unknown, source: JobSource): IncomingJob[] {
  const root = body && typeof body === "object" ? body as Record<string, unknown> : {};
  return (Array.isArray(root.jobs) ? root.jobs as Array<Record<string, unknown>> : []).slice(0, 100).map((item) => {
    const description = plainText(item.snippet);
    return { sourceId: source.id, sourceName: "Jooble", sourceJobId: String(item.id ?? ""), canonicalUrl: String(item.link ?? ""), postedOn: String(item.updated ?? "").slice(0, 10), employer: plainText(item.company), title: plainText(item.title), location: plainText(item.location), employmentType: plainText(item.type), salaryText: plainText(item.salary), description, normalizedSkills: skillTerms(description), workMode: workMode(`${item.location ?? ""} ${description}`) };
  });
}

async function jooble(source: JobSource): Promise<IncomingJob[]> {
  const key = process.env.JOOBLE_INDIA_API_KEY?.trim();
  if (!key || process.env.JOOBLE_INDIA_APPROVED !== "true") throw new Error("JOOBLE_NOT_CONFIGURED");
  if (source.countryCode !== "in" || !source.token.trim() || !source.location.trim()) throw new Error("INVALID_JOOBLE_INDIA_QUERY");
  // The quota is lifetime, not monthly. Reserve before dispatch, including failed
  // requests; never exceed 500 or retry automatically. Key rotation changes ledger.
  const ledger = adminDb.collection("job_provider_usage").doc(`jooble-in-${digest(key)}`);
  const cached = adminDb.collection("job_provider_cache").doc(`jooble-${digest(`${key}|${source.token}|${source.location}`)}`);
  const reservation = await adminDb.runTransaction(async (transaction) => {
    const [usage, entry] = await Promise.all([transaction.get(ledger), transaction.get(cached)]);
    const data = entry.data();
    if (data && Date.now() - Number(data.savedAt) < 24 * 60 * 60_000 && data.body) return { body: data.body };
    if (data && Date.now() - Number(data.attemptAt) < 60_000) throw new Error("JOOBLE_QUERY_IN_PROGRESS");
    const count = Number(usage.data()?.requests ?? 0);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("JOOBLE_INVALID_QUOTA_LEDGER");
    if (count >= 500) throw new Error("JOOBLE_QUOTA_EXHAUSTED");
    transaction.set(ledger, { requests: count + 1, limit: 500 }, { merge: true });
    transaction.set(cached, { attemptAt: Date.now() }, { merge: true });
    return { body: null };
  });
  if (reservation.body) return normalizeJoobleJobs(reservation.body, source);
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://jooble.org/api/${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ keywords: source.token.slice(0, 160), location: source.location.slice(0, 160), page: 1, ResultOnPage: 100, companysearch: false }), signal: controller.signal, redirect: "error", cache: "no-store" });
    if (!response.ok) throw new Error(`JOOBLE_HTTP_${response.status}`);
    const body = await response.json();
    if (!body || !Array.isArray(body.jobs)) throw new Error("JOOBLE_INVALID_RESPONSE");
    await cached.set({ body: { jobs: body.jobs.slice(0, 100) }, savedAt: Date.now() }, { merge: true });
    return normalizeJoobleJobs(body, source);
  } catch { throw new Error("JOOBLE_REQUEST_FAILED"); }
  finally { clearTimeout(timer); }
}

function relativePostedDate(value: unknown, now = new Date()) {
  const text = plainText(value).toLowerCase();
  const direct = new Date(text);
  if (/^\d{4}-\d{2}-\d{2}/.test(text) && !Number.isNaN(direct.valueOf())) return direct.toISOString().slice(0, 10);
  const match = text.match(/(\d+)\s+(hour|day|week)s?\s+ago/);
  if (!match) return text.includes("today") || text.includes("just posted") ? now.toISOString().slice(0, 10) : "";
  const count = Number(match[1]); const days = match[2] === "hour" ? 0 : match[2] === "week" ? count * 7 : count;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days)).toISOString().slice(0, 10);
}

function firstHttpsUrl(...values: unknown[]) {
  const candidates = values.flatMap((value) => Array.isArray(value) ? value : [value]);
  for (const candidate of candidates) {
    const raw = typeof candidate === "object" && candidate ? (candidate as Record<string, unknown>).link ?? (candidate as Record<string, unknown>).url : candidate;
    try { const url = new URL(String(raw ?? "")); if (url.protocol === "https:") return url.toString(); } catch { /* malformed provider URL */ }
  }
  return "";
}

export function normalizeBrightDataJobs(body: unknown, source: JobSource, now = new Date()): IncomingJob[] {
  const root = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const result = root.result && typeof root.result === "object" ? root.result as Record<string, unknown> : {};
  const candidates = [root.jobs, root.jobs_results, result.jobs, result.jobs_results].find(Array.isArray) as Array<Record<string, unknown>> | undefined;
  return (candidates ?? []).slice(0, 100).map((item, index) => {
    const applications = item.apply_options ?? item.apply_links;
    const description = plainText(item.description ?? item.snippet);
    const extensions = Array.isArray(item.extensions) ? item.extensions.join(" ") : "";
    const salary = item.salary && typeof item.salary === "object" ? item.salary as Record<string, unknown> : undefined;
    const salaryText = plainText(item.salary_text ?? (salary ? `${salary.min ?? ""}-${salary.max ?? ""} ${salary.currency ?? ""} ${salary.period ?? ""}` : ""));
    const detected = item.detected_extensions && typeof item.detected_extensions === "object" ? item.detected_extensions as Record<string, unknown> : {};
    return { sourceId: source.id, sourceName: plainText(item.via) || source.name, sourceJobId: plainText(item.job_id ?? item.id) || digest(`${item.title}|${item.company_name ?? item.company}|${item.location}|${index}`), canonicalUrl: firstHttpsUrl(applications, item.url, item.link, item.share_link), postedOn: relativePostedDate(item.posted_at ?? item.posted_on ?? detected.posted_at ?? extensions, now), employer: plainText(item.company_name ?? item.company ?? item.employer), title: plainText(item.title), location: plainText(item.location), employmentType: plainText(item.job_type ?? item.schedule_type ?? item.employment_type), salaryText, description, normalizedSkills: skillTerms(description), workMode: workMode(`${item.work_from_home ? "remote" : ""} ${item.work_mode ?? ""} ${item.location ?? ""} ${description.slice(0, 600)}`) };
  });
}

async function brightDataGoogleJobs(source: JobSource): Promise<IncomingJob[]> {
  const apiKey = process.env.BRIGHTDATA_API_KEY?.trim(); const customer = process.env.BRIGHTDATA_CUSTOMER_ID?.trim(); const zone = process.env.BRIGHTDATA_SERP_ZONE?.trim();
  if (process.env.GOOGLE_JOBS_PROVIDER_APPROVED !== "true") throw new Error("GOOGLE_JOBS_PROVIDER_NOT_APPROVED");
  if (!apiKey || !customer || !zone) throw new Error("BRIGHTDATA_CREDENTIALS_NOT_CONFIGURED");
  const month = new Date().toISOString().slice(0, 7);
  const limit = Math.max(0, Math.min(5_000, Number(process.env.BRIGHTDATA_MONTHLY_REQUEST_LIMIT ?? 4_500)));
  const allowance = adminDb.collection("provider_usage").doc(`brightdata_google_jobs_${month}`);
  const reserved = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(allowance);
    const used = Number(snapshot.data()?.requests ?? 0);
    if (used >= limit) return false;
    transaction.set(allowance, { provider: "brightdata_google_jobs", month, requests: used + 1, limit, updatedAt: new Date() }, { merge: true });
    return true;
  });
  if (!reserved) throw new Error("BRIGHTDATA_FREE_ALLOWANCE_EXHAUSTED");
  const target = new URL("https://www.google.com/search");
  target.searchParams.set("q", `${source.token} jobs in ${source.location}`.trim()); target.searchParams.set("ibp", "htl;jobs"); target.searchParams.set("gl", source.countryCode); target.searchParams.set("hl", "en"); target.searchParams.set("brd_json", "1");
  const requestUrl = new URL("https://api.brightdata.com/serp/req"); requestUrl.searchParams.set("customer", customer); requestUrl.searchParams.set("zone", zone);
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(requestUrl, { method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ country: source.countryCode, url: target.toString() }), signal: controller.signal, cache: "no-store", redirect: "error" });
    if (!response.ok) throw new Error(`BRIGHTDATA_HTTP_${response.status}`);
    const responseId = response.headers.get("x-response-id");
    if (!responseId) return normalizeBrightDataJobs(await response.json(), source);
    const resultUrl = new URL("https://api.brightdata.com/serp/get_result"); resultUrl.searchParams.set("customer", customer); resultUrl.searchParams.set("zone", zone); resultUrl.searchParams.set("response_id", responseId);
    for (let attempt = 0; attempt < 5; attempt += 1) { const resultResponse = await fetch(resultUrl, { headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` }, signal: controller.signal, cache: "no-store", redirect: "error" }); if (resultResponse.ok) return normalizeBrightDataJobs(await resultResponse.json(), source); await new Promise((resolve) => setTimeout(resolve, 600)); }
    throw new Error("BRIGHTDATA_RESULT_TIMEOUT");
  } finally { clearTimeout(timer); }
}

export function postedWithinDays(postedOn: string, now = new Date(), maximumDays = 30) {
  const posted = new Date(`${postedOn}T00:00:00Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (Number.isNaN(posted.valueOf()) || posted.valueOf() > today) return false;
  return today - posted.valueOf() <= maximumDays * 86_400_000;
}

export async function fetchJobsFromSource(source: JobSource): Promise<JobRecord[]> {
  const incoming = source.type === "greenhouse" ? await greenhouse(source) : source.type === "lever" ? await lever(source) : source.type === "usajobs" ? await usajobs(source) : source.type === "brightdata_google_jobs" ? await brightDataGoogleJobs(source) : source.type === "jobicy" ? await jobicy(source) : source.type === "jooble" ? await jooble(source) : await adzuna(source);
  const today = new Date().toISOString().slice(0, 10);
  return incoming.filter((job) => {
    try {
      const link = new URL(job.canonicalUrl);
      return link.protocol === "https:" && !link.username && !link.password && (source.type !== "jobicy" || ["jobicy.com", "www.jobicy.com"].includes(link.hostname)) && (source.type !== "jooble" || ["jooble.org", "in.jooble.org"].includes(link.hostname)) && Boolean(job.sourceJobId && job.title && job.employer) && postedWithinDays(job.postedOn);
    } catch { return false; }
  }).map((job) => ({ ...job, dateBasis: source.type === "jooble" || source.type === "greenhouse" ? "updated" as const : "posted" as const, id: digest(`${job.sourceId}|${job.sourceJobId}`), fingerprint: digest(`${job.employer}|${job.title}|${job.location}`), firstSeenOn: today, lastSeenOn: today, freshness: "current" }));
}

export async function fetchRegionalJobsForPreferences(preferences: Pick<JobPreferences, "roleTitles" | "locations" | "keywords">) {
  const hasAdzuna = Boolean(process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim());
  const hasJooble = process.env.JOOBLE_INDIA_APPROVED === "true" && Boolean(process.env.JOOBLE_INDIA_API_KEY?.trim());
  const hasBrightData = process.env.GOOGLE_JOBS_PROVIDER_APPROVED === "true" && Boolean(process.env.BRIGHTDATA_API_KEY?.trim() && process.env.BRIGHTDATA_CUSTOMER_ID?.trim() && process.env.BRIGHTDATA_SERP_ZONE?.trim());
  if (!hasAdzuna && !hasBrightData && !hasJooble) return [];
  const queries: JobSource[] = preferences.roleTitles.slice(0, 3).flatMap((role) => preferences.locations.slice(0, 5).flatMap((location, index) => {
    const countryCode = adzunaCountryForLocation(location); if (!countryCode) return [];
    const keywordSuffix = preferences.keywords.slice(0, 5).join(" ");
    const token = `${role} ${keywordSuffix}`.trim(); const suffix = `${index}-${digest(`${role}|${location}|${keywordSuffix}`).slice(0, 8)}`;
    return [...(hasBrightData ? [{ id: `brightdata-${countryCode}-${suffix}`, type: "brightdata_google_jobs" as const, name: "Google Jobs via Bright Data", employer: "", token, region: "global" as const, countryCode, location, enabled: true, termsReviewedOn: "2026-09-24", termsUrl: "https://brightdata.com/products/serp-api/google-search/jobs" }] : []), ...(hasAdzuna ? [{ id: `adzuna-${countryCode}-${suffix}`, type: "adzuna" as const, name: `Adzuna ${countryCode.toUpperCase()}`, employer: "", token, region: "global" as const, countryCode, location, enabled: true, termsReviewedOn: "2026-09-24", termsUrl: "https://developer.adzuna.com/overview" }] : [])];
  }));
  if (hasJooble) {
    const role = preferences.roleTitles[0];
    const location = preferences.locations.find((value) => adzunaCountryForLocation(value) === "in");
    if (role && location) queries.push({ id: `jooble-in-${digest(`${role}|${location}`)}`, type: "jooble", name: "Jooble", employer: "", token: role, region: "global", countryCode: "in", location, enabled: true, termsReviewedOn: "2026-09-26", termsUrl: "https://in.jooble.org/api/about" });
  }
  const results = await Promise.allSettled(queries.map(fetchJobsFromSource));
  const jobs = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const deduplicated = new Map<string, JobRecord>();
  for (const job of jobs.sort((a, b) => b.postedOn.localeCompare(a.postedOn))) if (!deduplicated.has(job.fingerprint)) deduplicated.set(job.fingerprint, job);
  return [...deduplicated.values()].slice(0, 200);
}
