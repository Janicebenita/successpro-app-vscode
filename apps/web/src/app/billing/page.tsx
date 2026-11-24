import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { WriterAddons } from "@/components/writer-addons";
import { BillingHistory } from "@/components/billing-history";
import { addonCatalog } from "@/lib/addon-pricing";
import { adminDb } from "@/lib/firebase-admin";
import { currencyForLocation } from "@/lib/geography";
import { getSessionUser } from "@/lib/session";
import { resolveUserEntitlements } from "@/lib/feature-entitlements";
import { subscriptionsOpen } from "@/lib/billing-config";
import { formatIndiaDate } from "@/lib/format-date";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await getSessionUser(); if (!user) redirect("/login?returnTo=/billing");
  const [profile, access, orderSnapshot, subscriptionSnapshot] = await Promise.all([adminDb.collection("profiles").doc(user.uid).get(), resolveUserEntitlements(user.uid), adminDb.collection("addon_orders").where("ownerId", "==", user.uid).limit(100).get(), adminDb.collection("subscriptions").where("ownerId", "==", user.uid).limit(100).get()]); const currency = currencyForLocation(String(profile.data()?.location ?? ""));
  const products = addonCatalog(currency).flatMap(({ id, price }) => price ? [{ id, ...price }] : []).map(({ id, name, description, amount, currency: productCurrency }) => ({ id, name, description, amount, currency: productCurrency }));
  const records = [...orderSnapshot.docs.map((document) => { const value = document.data(); return { id: document.id, type: "writing" as const, name: String(value.addonId === "career-document-suite" ? "Resume, cover letter and LinkedIn writing" : "Professional resume writing"), state: String(value.state ?? "created"), amount: Number.isFinite(Number(value.amount)) ? Number(value.amount) : null, currency: String(value.currency ?? "INR"), createdAt: value.createdAt?.toDate?.()?.toISOString?.() ?? null, paidThrough: null, renewalEnabled: null }; }), ...subscriptionSnapshot.docs.map((document) => { const value = document.data(); return { id: document.id, type: "subscription" as const, name: `SuccessPro ${String(value.planId ?? "subscription").replaceAll("-", " ")}`, state: String(value.state ?? "created"), amount: Number.isFinite(Number(value.amount)) ? Number(value.amount) : null, currency: String(value.currency ?? "INR"), createdAt: value.createdAt?.toDate?.()?.toISOString?.() ?? null, paidThrough: value.currentPeriodEnd?.toDate?.()?.toISOString?.() ?? null, renewalEnabled: value.renewalEnabled === true, cancelAtCycleEnd: value.cancelAtCycleEnd === true }; })].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return <AppShell><section className="work-card profile-intro"><div><span className="status-pill">{access.planId.replaceAll("-", " ").toUpperCase()}</span><h2>Your plan</h2><p>You can complete {access.entitlements.atsReviewsPerMonth} Resume Checker checks each month. Failed file reading never uses a check.</p></div><Link className="button button-primary" href="/pricing">Compare plans</Link></section><section className="profile-grid billing-grid"><article className="work-card"><h3>Current access</h3><div className="billing-plan"><strong>{access.planId === "free" ? "SuccessPro Free" : `SuccessPro ${access.planId.replace("premium-", "Premium ")}`}</strong><span>{access.entitlements.contactInitiationsPerMonth} new contacts · {access.entitlements.atsReviewsPerMonth} checks monthly</span></div><p>{(!access.activeUntil && !subscriptionsOpen()) ? "Premium purchases are not open yet. You are on the Free plan and nothing is charged." : access.activeUntil ? `Access is active until ${formatIndiaDate(access.activeUntil) ?? "the end of your paid period"}.` : "Your saved content remains available even when paid access ends."}</p></article><article className="work-card"><h3>Payment protections</h3><ul className="plain-list"><li>The server selects the price; it is never accepted from the browser.</li><li>Razorpay creates and processes the payment order.</li><li>A signed payment event confirms the project before fulfilment begins.</li><li>One-time writing projects do not renew.</li></ul></article></section><BillingHistory records={records} />{products.length ? <div id="expert-writing"><WriterAddons currency={currency} products={products} /></div> : <section id="expert-writing" className="work-card"><h2>Expert writing service</h2><p>A verified local-currency price is not available yet. INR checkout remains the base catalog; international currencies open only when the current controlled price book supports them.</p></section>}</AppShell>;
}
