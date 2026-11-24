import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";
import { TrackingChoices } from "@/components/consent-aware-tracking";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Learn how SuccessPro uses necessary session storage and optional cookies, and how to manage your tracking preferences.",
  alternates: {
    canonical: "/cookie-policy",
  },
};

export default function Page() {
  return <><PolicyPage title="Cookie policy" effective="1 October 2026" summary="You can use SuccessPro without optional analytics or advertising cookies. This page explains what stays necessary and lets you change your choice." sections={[
    { heading: "Essential browser storage", paragraphs: ["Authentication cookies and local storage keep your account signed in, maintain security, and remember controls you request. These are necessary to provide the account service and cannot be disabled through the optional tracking switch. You can clear them in your browser, but doing so may sign you out or remove saved preferences."], items: ["Session and anti-abuse storage supports sign-in and protects private pages.", "Preference storage remembers choices such as language and optional tracking consent.", "Operational server logs may record limited security and reliability information without placing an advertising cookie."] },
    { heading: "Optional analytics and advertising", paragraphs: ["If you actively allow optional tracking and SuccessPro has configured the relevant IDs, Google Analytics or Tag Manager, Google Ads, Meta, or LinkedIn tags may load. They can set or read their own cookies or similar identifiers and receive limited page-use information under their policies. We do not send resume text, account email, search parameters, or private document contents as page-view data by design. We do not load these optional tags on staging or QA hostnames."], items: ["Declining does not restrict registration, resume tools, jobs, or other core features.", "Allowing is not required to accept the Terms or Data and Privacy Policy.", "External providers may have their own retention and cross-border practices; review their privacy notices before allowing optional tags."] },
    { heading: "Changing or withdrawing your choice", paragraphs: ["Use the controls below or in Privacy and account to allow or decline at any time. Withdrawal prevents optional tags from loading on future page views and reloads the page if a tag was already active. We attempt to remove common first-party tracking cookies, but a browser or third party may retain data collected before withdrawal. You can also clear site data in your browser or use the provider's own controls. Blocking all cookies may prevent protected features from working."] },
  ]} /><section className="container section"><h2>Your optional tracking choice</h2><TrackingChoices /></section></>;
}
