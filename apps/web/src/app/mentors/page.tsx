import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MentorBookings } from "@/components/mentor-bookings";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
export const metadata: Metadata = {
  title: "Mentorship",
  robots: { index: false, follow: false },
}; export const dynamic = "force-dynamic";
export default async function MentorsPage() { const user = await getSessionUser(); if (!user) redirect("/login?returnTo=/mentors"); const [mentors, customerBookings] = await Promise.all([adminDb.collection("mentors").where("published", "==", true).limit(100).get(), adminDb.collection("mentor_bookings").where("customerId", "==", user.uid).limit(200).get()]); const mentorList = mentors.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Parameters<typeof MentorBookings>[0]["mentors"]; const bookingMap = new Map(customerBookings.docs.map((doc) => [doc.id, doc])); const bookingList = [...bookingMap.values()].map((doc) => { const value = doc.data(); return { id: doc.id, ...value, scheduledStart: value.scheduledStart?.toDate?.()?.toISOString?.() ?? new Date().toISOString() }; }) as Parameters<typeof MentorBookings>[0]["initialBookings"]; return <AppShell><div className="opportunities-layout"><section className="work-card profile-intro"><div><span className="status-pill">MENTORSHIP</span><h2>Learn from verified professionals</h2><p>Find an experienced professional to help you plan your next step. Sessions take place online. Booking is currently in preview; no payment is collected.</p></div></section><MentorBookings mentors={mentorList} initialBookings={bookingList} viewerId={user.uid} /></div></AppShell>; }
