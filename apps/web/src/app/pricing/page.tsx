import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { SubscribeButton } from "@/components/subscribe-button";
import { PricingHeaderAction } from "@/components/pricing-header-action";

export const metadata: Metadata = {
  title: "Pricing & Plans",
  description: "Affordable, transparent plans for individuals and job seekers. Start with 3 free resume checks every month or upgrade for full career guidance.",
  alternates: {
    canonical: "/pricing",
  },
};
export const dynamic = "force-dynamic";

const plans = [
  { name: "Free", price: "₹0", cadence: "forever", detail: "Understand your resume and start planning your next career move.", features: ["3 Resume Checker checks each month", "Your career profile", "Career goals and job preferences", "Private workspace"], href: "/signup", action: "Start free", planId: null, renewal: "" },
  { name: "Premium Monthly", price: "₹499", cadence: "per month", detail: "Improve your resume and professional story with the complete set of tools.", features: ["30 Resume Checker checks each month", "10 in-depth resume reports", "Resume and cover-letter builders", "LinkedIn profile guidance", "Job alerts and salary insights"], href: "/signup?plan=premium-monthly", action: "Subscribe", planId: "premium-monthly", renewal: "Renews every month. Cancel anytime." },
  { name: "Premium Quarterly", price: "₹1,299", cadence: "every 3 months", detail: "Three focused months to prepare for your next career move.", features: ["Everything in Premium", "Price stays the same for three months", "Cancel future renewals at any time", "Your saved content remains available if you downgrade"], href: "/signup?plan=premium-quarterly", action: "Subscribe", planId: "premium-quarterly", renewal: "Renews every 3 months. Cancel anytime." },
  { name: "Premium Annual", price: "₹3,999", cadence: "per year", detail: "Year-round career support with the best monthly value.", features: ["Everything in Premium", "Price stays the same for one year", "Payment and usage history", "Early access to selected updates"], href: "/signup?plan=premium-annual", action: "Subscribe", planId: "premium-annual", renewal: "Renews every year. Cancel anytime." },
] as const;

export default function PricingPage() {
  return <main className="pricing-page"><header className="pricing-header container"><Brand /><PricingHeaderAction /></header><section className="container pricing-intro"><span className="eyebrow">CLEAR, FLEXIBLE PLANS</span><h1>Start free. Upgrade when you need more.</h1><p>Choose a plan. Premium renews until you cancel.</p></section><section className="container pricing-grid">{plans.map((plan, index) => <article className={`pricing-card${index === 1 ? " featured" : ""}`} key={plan.name}>{index === 1 && <span className="pricing-label">MONTH-TO-MONTH</span>}<h2>{plan.name}</h2><div className="price"><strong>{plan.price}</strong><span>{plan.cadence}</span></div><p>{plan.detail}</p><ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>{plan.planId ? <><SubscribeButton planId={plan.planId} label={plan.action} planName={plan.name} className="button button-primary full" /><small>{plan.renewal}</small></> : <Link className="button button-dark full" href={plan.href}>{plan.action}</Link>}</article>)}</section><p className="container pricing-note">Prices are shown in Indian rupees. Prices for other countries will be added before international payments open.</p></main>;
}
