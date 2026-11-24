"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Tracking = { googleAnalyticsId: string; googleTagManagerId: string; googleAdsId: string; metaPixelId: string; linkedInInsightTagId: string };
type Choice = "yes" | "no";
type MetaQueue = ((...args: unknown[]) => void) & { queue: unknown[][] };
const storageKey = "successpro_optional_tracking";
const choiceEvent = "successpro-tracking-choice";
const liveHost = "successpro.xfactor.ltd";

declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; fbq?: MetaQueue; _linkedin_partner_id?: string; _linkedin_data_partner_ids?: string[]; } }

function externalScript(src: string, id: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.append(script);
}

function googleConsent(choice: Choice) {
  const value = choice === "yes" ? "granted" : "denied";
  const dataLayer = window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || ((...args: unknown[]) => { dataLayer.push(args); });
  if (choice === "yes") window.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  window.gtag("consent", "update", { analytics_storage: value, ad_storage: value, ad_user_data: value, ad_personalization: value });
}

export function isEligibleTrackingHost(hostname: string) { return hostname === liveHost; }

export function safePagePath(pathname: string) {
  const allowed = new Set(["/", "/login", "/signup", "/dashboard", "/profile", "/documents", "/review", "/linkedin", "/goals", "/learning", "/salary", "/opportunities", "/jobs", "/billing", "/pricing", "/settings", "/notifications", "/feed", "/network", "/messages", "/mentor", "/mentors", "/recruiter", "/contact", "/help", "/terms", "/data-policy", "/privacy-policy", "/cookie-policy", "/cancellation-policy", "/refund-policy", "/delivery-policy"]);
  if (pathname.startsWith("/admin")) return null;
  if (pathname.startsWith("/p/")) return "/p";
  return allowed.has(pathname) ? pathname : "/other";
}

function loadTags(tracking: Tracking) {
  const dataLayer = window.dataLayer = window.dataLayer || [];
  googleConsent("yes");
  if (tracking.googleTagManagerId) {
    dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    externalScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(tracking.googleTagManagerId)}`, "sp-gtm");
  } else if (tracking.googleAnalyticsId) {
    window.gtag?.("js", new Date());
    window.gtag?.("config", tracking.googleAnalyticsId, { anonymize_ip: true, send_page_view: false });
    externalScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tracking.googleAnalyticsId)}`, "sp-ga");
  }
  if (tracking.metaPixelId) {
    let fbq = window.fbq;
    if (!fbq) {
      const queued = ((...args: unknown[]) => { queued.queue.push(args); }) as MetaQueue;
      queued.queue = [];
      window.fbq = queued;
      fbq = queued;
    }
    externalScript("https://connect.facebook.net/en_US/fbevents.js", "sp-meta");
    fbq("init", tracking.metaPixelId);
  }
  if (tracking.linkedInInsightTagId) {
    window._linkedin_partner_id = tracking.linkedInInsightTagId;
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    if (!window._linkedin_data_partner_ids.includes(tracking.linkedInInsightTagId)) window._linkedin_data_partner_ids.push(tracking.linkedInInsightTagId);
    externalScript("https://snap.licdn.com/li.lms-analytics/insight.min.js", "sp-linkedin");
  }
}

function clearOptionalTrackingCookies() {
  const optional = /^(_ga(?:_|$)|_gid$|_gcl_|_fbp$|_fbc$|_li_|li_sugr$)/;
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (!name || !optional.test(name)) continue;
    for (const domain of ["", "; domain=successpro.xfactor.ltd", "; domain=.xfactor.ltd"]) document.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax`;
  }
}

export function setOptionalTrackingChoice(value: Choice) {
  window.localStorage.setItem(storageKey, value);
  window.dispatchEvent(new CustomEvent(choiceEvent, { detail: value }));
  if (value === "no") {
    googleConsent("no");
    clearOptionalTrackingCookies();
    // A previously loaded script cannot be reliably unloaded. Reload to stop
    // in-memory trackers without clearing essential sign-in storage.
    if (["sp-gtm", "sp-ga", "sp-meta", "sp-linkedin"].some((id) => document.getElementById(id))) window.location.reload();
  }
}

export function ConsentAwareTracking() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const lastPage = useRef("");

  useEffect(() => {
    const update = () => { const stored = window.localStorage.getItem(storageKey); setChoice(stored === "yes" || stored === "no" ? stored : null); };
    update();
    window.addEventListener(choiceEvent, update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener(choiceEvent, update); window.removeEventListener("storage", update); };
  }, []);

  useEffect(() => {
    if (choice === "no") { lastPage.current = ""; return; }
    if (choice !== "yes" || !isEligibleTrackingHost(window.location.hostname)) return;
    let cancelled = false;
    fetch("/api/public/tracking", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((config: Tracking | null) => {
      if (cancelled || !config) return;
      setTracking(config);
      loadTags(config);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [choice]);

  useEffect(() => {
    if (choice !== "yes" || !tracking || !pathname || !isEligibleTrackingHost(window.location.hostname) || lastPage.current === pathname) return;
    lastPage.current = pathname;
    // Do not forward query strings, fragments, user IDs, resume text or titles.
    const safePath = safePagePath(pathname);
    if (!safePath) return;
    const page = { page_path: safePath, page_location: `${window.location.origin}${safePath}` };
    if (tracking.googleTagManagerId) window.dataLayer?.push({ event: "successpro_page_view", ...page });
    else if (tracking.googleAnalyticsId) window.gtag?.("event", "page_view", page);
    if (tracking.metaPixelId) window.fbq?.("track", "PageView");
  }, [choice, tracking, pathname]);

  if (choice !== null) return null;
  return <aside className="tracking-consent" role="region" aria-label="Optional analytics cookies"><div><strong>Help us improve SuccessPro</strong><p>With your permission, we may use optional analytics and advertising tags to understand site use and measure campaigns. Essential sign-in and security storage always remains on.</p><Link href="/cookie-policy">Cookie policy</Link></div><div><button className="button button-secondary" onClick={() => setOptionalTrackingChoice("no")}>Decline optional cookies</button><button className="button button-primary" onClick={() => setOptionalTrackingChoice("yes")}>Allow optional cookies</button></div></aside>;
}

export function TrackingChoices() {
  const [choice, setChoice] = useState<Choice | null>(null);
  useEffect(() => {
    const update = () => { const stored = window.localStorage.getItem(storageKey); setChoice(stored === "yes" || stored === "no" ? stored : null); };
    update();
    window.addEventListener(choiceEvent, update);
    return () => window.removeEventListener(choiceEvent, update);
  }, []);
  return <div className="tracking-choice-control"><p>Optional analytics and advertising: {choice === "yes" ? "Allowed" : choice === "no" ? "Declined" : "Not chosen"}.</p><div className="form-actions"><button className="button button-secondary" type="button" onClick={() => setOptionalTrackingChoice("no")}>Decline optional cookies</button><button className="button button-primary" type="button" onClick={() => setOptionalTrackingChoice("yes")}>Allow optional cookies</button></div></div>;
}
