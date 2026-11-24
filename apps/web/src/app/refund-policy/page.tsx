import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Transparent terms and criteria for refund evaluations, billing corrections, and dispute resolution on SuccessPro.",
  alternates: {
    canonical: "/refund-policy",
  },
};

export default function Page() {
  return <PolicyPage title="Refund policy" effective="1 October 2026" summary="We review refund requests against the order, actual delivery, payment records, and the consumer rights that apply to you." sections={[
    { heading: "Situations we will remedy", items: ["A duplicate or incorrect charge, including a renewal after an effective cancellation.", "A paid service SuccessPro cannot provide, or a material failure we cannot correct within a reasonable time.", "A one-time writing project cancelled before substantive work begins, or a mentor session cancelled by the provider without an acceptable reschedule.", "A refund or other remedy required by applicable consumer, payment, or contract law."] },
    { heading: "Work already performed and subscriptions", paragraphs: ["Where a one-time project is cancelled after substantive work begins, we will explain any proportionate amount retained for agreed work actually completed and any non-recoverable cost disclosed before purchase. A completed digital deliverable does not automatically remove your rights if it was defective, misdescribed, or not delivered as agreed. A change of mind after proper delivery alone may not qualify for a full refund where law permits, but we will assess the particular facts."], items: ["Stopping a subscription normally prevents future charges rather than refunding a period already used. A failed service, undisclosed renewal, billing error, or mandatory local right may justify a different result.", "An employer's rejection, a job closing, salary-market movement, or an independent third party's decision is not by itself a defect in a SuccessPro service.", "Test-mode features do not create a live charge and therefore have no live payment to refund."] },
    { heading: "How to request a refund", paragraphs: ["Email support@successpro.xfactor.ltd from your registered account with the order or payment reference, service, charge date, reason, and any relevant screenshots. Do not send full card details, bank credentials, passwords, or identity documents unless requested through a secure verification process. We may ask for reasonable information needed to investigate and will provide a reasoned decision and any available escalation route."], items: ["A chargeback or payment-provider dispute may follow its own process. Please tell us if you have already opened one so we do not issue inconsistent instructions.", "Approved refunds normally go to the original payment method. We will communicate the initiation date and expected processing window; card networks and banks control the final credit timing.", "If a refund method is unavailable, we will agree another lawful method rather than treating the refund as forfeited."] },
    { heading: "No waiver of legal rights", paragraphs: ["Nothing in this policy limits a statutory refund, repair, repeat performance, compensation, payment reversal, or consumer-commission remedy. If a term here conflicts with mandatory law, the mandatory rule governs. The Chennai court clause in the Terms does not take away a consumer forum or regulator that the law makes available."] },
  ]} />;
}
