import { chromium } from "@playwright/test";

const base = process.env.TRACKING_QA_BASE_URL;
if (base !== "https://successpro.xfactor.ltd") throw new Error("Tracking QA must use the live custom domain, with synthetic IDs intercepted in-browser.");
const qaOrigin = process.env.TRACKING_QA_REVISION_ORIGIN;
if (qaOrigin && !/^https:\/\/(?:tracking-consent|auth-domain-proxy)-qa---successpro-web-staging-[a-z0-9-]+\.a\.run\.app$/.test(qaOrigin)) throw new Error("Tracking QA revision URL is not recognized.");

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const tagRequests: string[] = [];
  const cspErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && /content security policy/i.test(message.text())) cspErrors.push(message.text()); });
  if (qaOrigin) await page.route(`${base}/**`, async (route) => {
    const incoming = new URL(route.request().url());
    try {
      const upstream = await route.fetch({ url: `${qaOrigin}${incoming.pathname}${incoming.search}` });
      await route.fulfill({ response: upstream });
    } catch {
      // Next.js may cancel speculative prefetches while the browser closes.
      await route.abort().catch(() => undefined);
    }
  });
  await page.route("**/api/public/tracking", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ googleAnalyticsId: "G-TESTONLY", googleTagManagerId: "GTM-TESTONLY", googleAdsId: "", metaPixelId: "", linkedInInsightTagId: "" }) }));
  await page.route("https://www.googletagmanager.com/gtm.js**", (route) => { tagRequests.push(route.request().url()); return route.fulfill({ status: 200, contentType: "application/javascript", body: "window.__successproSyntheticTagLoaded = true;" }); });
  await page.goto(`${base}/cookie-policy?email=private%40example.com`, { waitUntil: "networkidle" });
  if (tagRequests.length) throw new Error("Tag Manager loaded before visitor consent.");
  const choice = page.locator(".tracking-choice-control");
  await choice.getByRole("button", { name: "Decline optional cookies" }).click();
  await page.waitForTimeout(300);
  if (tagRequests.length) throw new Error("Tag Manager loaded after decline.");
  await choice.getByRole("button", { name: "Allow optional cookies" }).click();
  await page.waitForFunction(() => Boolean((window as Window & { __successproSyntheticTagLoaded?: boolean }).__successproSyntheticTagLoaded));
  if (tagRequests.length !== 1) throw new Error(`Expected one Tag Manager script, found ${tagRequests.length}.`);
  const events = await page.evaluate(() => window.dataLayer?.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object" && !Array.isArray(entry) && "event" in entry)) ?? []);
  const pageView = events.find((entry) => entry.event === "successpro_page_view");
  if (pageView?.page_path !== "/cookie-policy" || String(pageView.page_location).includes("email=")) throw new Error("Page view leaked URL parameters or used the wrong page category.");
  await choice.getByRole("button", { name: "Decline optional cookies" }).click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500);
  const prior = tagRequests.length;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  if (tagRequests.length !== prior) throw new Error("Tag Manager reloaded after consent withdrawal.");
  if (cspErrors.length) throw new Error(`Tracking CSP error: ${cspErrors[0]}`);
  console.log(JSON.stringify({ consentDefault: "off", decline: "no-tags", allow: "one-synthetic-tag", pageView: "/cookie-policy", queryParameters: "excluded", withdrawal: "no-tags-on-reload", csp: "passed" }));
} finally {
  await browser.close();
}
