import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = {
  title: "Cancellation Policy",
  description: "Guidelines and procedures for cancelling subscriptions, expert writing services, and scheduled mentor sessions on SuccessPro.",
  alternates: {
    canonical: "/cancellation-policy",
  },
};

export default function Page() {
  return <PolicyPage title="Cancellation policy" effective="1 October 2026" summary="How to stop a future renewal or cancel a one-time professional service, without losing any mandatory legal right." sections={[
    { heading: "Subscriptions and future renewals", paragraphs: ["If a recurring plan is offered, the checkout will identify its renewal interval and amount before payment. You can stop a future renewal through available billing controls or by contacting support from your registered email. We will confirm the effective date. Cancellation normally leaves paid access available through the end of the current period and prevents the next charge; it does not itself reverse a charge that has already occurred."], items: ["Send a cancellation request before the renewal date shown in your account. If a payment is already in process, contact support promptly so we can review its status and any legally required refund.", "If the billing controls fail, a time-stamped request to support@successpro.xfactor.ltd will be reviewed as a cancellation request; we will not require you to keep trying a broken control.", "Deleting an account and cancelling a payment mandate are different actions. We will help coordinate both when requested, subject to the payment provider's process and lawful record retention."] },
    { heading: "One-time expert writing projects", paragraphs: ["A resume or document-writing project is a one-time purchase and does not renew. Before substantive work begins, you may ask to cancel and receive a full refund of the SuccessPro project fee. After work begins, tell us promptly; we will assess completed work, agreed deliverables, and any non-recoverable third-party costs disclosed before payment, and explain any partial refund decision. If we cannot deliver the agreed service, the Refund Policy and mandatory law apply."], items: ["Your order confirmation should state when work begins, the scope, expected first draft, revision allowance, and delivery channel.", "A request to change the project scope is not automatically a cancellation. We will quote and obtain approval for any extra charge before doing additional paid work."] },
    { heading: "Mentor bookings and other scheduled services", paragraphs: ["A booked service must display its cancellation deadline, no-show treatment, price, and any mentor-specific conditions before payment. Where those details were not clearly shown, we will not rely on an undisclosed penalty. If a mentor cancels or does not provide the agreed session, we will offer a lawful reschedule or refund. A customer may raise a dispute through support."] },
    { heading: "How to request cancellation", paragraphs: ["Write to support@successpro.xfactor.ltd from your registered email with the plan or order reference, service, and desired cancellation date. Do not send card details or passwords. We may verify account ownership and payment state. We will acknowledge and give a reasoned outcome, including the effective date and any refund route. Nothing in this policy removes a statutory cooling-off, cancellation, chargeback, or consumer remedy that applies in your location."] },
  ]} />;
}
