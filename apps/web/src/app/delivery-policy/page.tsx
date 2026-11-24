import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = {
  title: "Digital Delivery Policy",
  description: "Fulfillment terms, download access, and delivery standards for SuccessPro digital reports, files, and services.",
  alternates: {
    canonical: "/delivery-policy",
  },
};

export default function Page() {
  return <PolicyPage title="Digital delivery policy" effective="1 October 2026" summary="SuccessPro provides digital access and files, not physical goods. Your order should say what will be delivered and when." sections={[
    { heading: "Automated tools and files", paragraphs: ["Eligible digital tools are ordinarily available after registration, required verification, and confirmed payment where a charge applies. Upload parsing, AI review, research, and document creation may take longer for large files or when an external service is unavailable. A progress indicator is an estimate, not proof of delivery. A generated document is delivered when it is available to view or download in your account."], items: ["You should inspect generated content and formatting before using it. Report a failed download, corrupted file, or materially incomplete result through support.", "A third-party job or course link is information and an outbound link; it is not a job offer, course enrolment, or physical delivery by SuccessPro."] },
    { heading: "Expert writing and booked services", paragraphs: ["Before a paid writing project begins, the order confirmation should state the purchased package, source information required from you, draft and final deliverables, expected first-draft date or period, number of included revisions, and delivery channel. Delays caused by missing customer information will be explained. A mentor or other booked session should show its date, time zone, duration, access method, and cancellation rules before payment."], items: ["A draft or final file may be delivered in your private workspace and, where offered, by an account notification. Do not assume an emailed attachment will be provided unless the order says so.", "If SuccessPro changes an agreed scope or delivery date materially, we will seek your agreement or offer the remedy required by the order and applicable law."] },
    { heading: "If delivery fails", paragraphs: ["Contact support@successpro.xfactor.ltd with your account email, order reference, the expected delivery time, and the problem. Do not send payment-card details. We will check payment confirmation and fulfilment records, then retry, correct, reschedule, or offer an appropriate refund. We will communicate the outcome and a reasonable next-step timeframe. Nothing here removes a mandatory consumer remedy."] },
    { heading: "No shipping", paragraphs: ["There are no physical products, shipping charges, or delivery addresses for the services described here. Any future physical offering would require separate checkout disclosures before it is sold."] },
  ]} />;
}
