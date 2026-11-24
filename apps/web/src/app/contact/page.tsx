import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = {
  title: "Contact and Grievance Support",
  description: "Get support for your SuccessPro account, consumer inquiries, grievance redressal, or enterprise partnerships.",
  alternates: {
    canonical: "/contact",
  },
};

export default function Page() {
  return <PolicyPage title="Contact and grievance support" effective="1 October 2026" summary="A single route for account help, consumer complaints, privacy rights, payment disputes, safety reports, and concerns from rights holders." sections={[
    { heading: "Operator and grievance contact", items: ["Service: SuccessPro, part of X Factor.", "Postal address: 5/750, SAAC, 3rd Floor, Sabari Salai, Madipakkam, Chennai 600091, Tamil Nadu, India.", "Grievance contact: Grievance Officer, SuccessPro, at support@successpro.xfactor.ltd.", "Account support: use the Help Center after signing in, or the same email if you cannot access your account."] },
    { heading: "What to send", items: ["Account or billing issue: your registered email, order or payment reference, date, amount, and a concise description. Never send a password, one-time code, full card number, or bank credentials.", "Privacy request: the account involved and whether you seek access, correction, export, consent withdrawal, or deletion. We may use a secure identity check before acting.", "Impersonation, unlawful job, harassment, or safety report: the relevant profile, job, post, or message link, a description, and any necessary evidence. Do not send unnecessary personal data about a third party.", "Copyright or trademark concern: identify the work or mark, the material's URL, your claimed rights and authority, the action requested, and contact details so we can assess the notice and any response."] },
    { heading: "Handling and escalation", paragraphs: ["We will record and triage complaints, prioritize urgent security and safety reports, and communicate a reasoned outcome or request for information. For complaints covered by India's e-commerce grievance rules, we will acknowledge receipt within the applicable 48-hour period and seek redress within the applicable one-month period. Other statutory deadlines take precedence. Complex matters may require further investigation; we will explain the status rather than silently close the case."], items: ["If you disagree with an outcome, reply to the case email and ask for escalation. You may also use any consumer commission, data-protection authority, payment-provider route, or other lawful forum available to you.", "We may restrict access to reported content while reviewing it, but a report does not guarantee removal; we also consider the rights of the person who posted it and applicable law."] },
  ]} />;
}
