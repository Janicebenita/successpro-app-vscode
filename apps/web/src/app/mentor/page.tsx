import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PartnerShell } from "@/components/partner-shell";
import { MentorApplicationForm } from "@/components/mentor-application-form";
import { MentorBookings } from "@/components/mentor-bookings";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Mentor workspace",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export default async function MentorWorkspace() {
  const user = await getSessionUser();
  if (!user) redirect("/mentor/login?returnTo=/mentor");
  const [application, bookings] = await Promise.all([adminDb.collection("mentor_applications").doc(user.uid).get(), adminDb.collection("mentor_bookings").where("mentorId", "==", user.uid).limit(200).get()]);
  const value = application.data();
  const list = bookings.docs.map((doc) => {
    const item = doc.data();
    return { id: doc.id, customerId: String(item.customerId), mentorId: String(item.mentorId), mentorName: String(item.mentorName), scheduledStart: item.scheduledStart?.toDate?.()?.toISOString?.() ?? "", status: String(item.status), currency: String(item.currency), grossAmount: Number(item.grossAmount), paymentMode: String(item.paymentMode), paymentStatus: String(item.paymentStatus), meetingUrl: item.meetingUrl ?? null, ...(item.review ? { review: { rating: Number(item.review.rating), text: String(item.review.text) } } : {}) };
  });
  return <PartnerShell kind="mentor"><section className="work-card"><h1>Share your experience. Help someone grow.</h1><p>Apply to become a SuccessPro mentor. Our team reviews your experience and credentials before your services appear to customers.</p></section><MentorApplicationForm initialStatus={String(value?.status ?? "not-submitted")} decisionReason={String(value?.decisionReason ?? "")} /><MentorBookings audience="mentor" mentors={[]} initialBookings={list} viewerId={user.uid} /></PartnerShell>;
}
