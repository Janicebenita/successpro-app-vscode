import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

function portable(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if ("toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") return ((value as { toDate(): Date }).toDate()).toISOString();
  if (Array.isArray(value)) return value.map(portable);
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, portable(child)]));
}

const directCollections = ["users", "profiles", "resumes", "career_goals", "job_preferences", "salary_research", "document_drafts", "registration_consents", "signup_price_locks", "daily_job_feeds", "user_settings", "entitlements", "recruiter_accounts", "mentor_applications", "mentors", "contact_match_consents"] as const;
const ownedCollections = ["profile_versions", "resume_versions", "resume_transform_versions", "analyses", "usage_ledger", "usage_allowances", "rate_limits", "public_profiles", "document_draft_versions", "ai_runs", "ai_cache", "support_tickets", "notifications", "product_events", "addon_orders", "subscriptions", "consent_events", "recruiter_jobs", "feed_events", "feed_reactions", "mentor_payout_ledger"] as const;

export async function GET() {
  const user = await getSessionUser({ allowWithdrawn: true }); if (!user) return NextResponse.json({ error: "Sign in to export your data." }, { status: 401 });
  const direct = await Promise.all(directCollections.map(async (collection) => { const snapshot = await adminDb.collection(collection).doc(user.uid).get(); return [collection, snapshot.exists ? portable({ id: snapshot.id, ...snapshot.data() }) : null] as const; }));
  const owned = await Promise.all(ownedCollections.map(async (collection) => { const snapshot = await adminDb.collection(collection).where("ownerId", "==", user.uid).limit(2_000).get(); return [collection, snapshot.docs.map((doc) => portable({ id: doc.id, ...doc.data() }))] as const; }));
  const reported = await adminDb.collection("moderation_reports").where("reporterId", "==", user.uid).limit(2_000).get();
  const [conversationSnapshot, connectionSnapshot, candidateApplications, recruiterApplications, customerBookings, mentorBookings, customerMentorPayments, mentorPayments] = await Promise.all([adminDb.collection("conversations").where("participantIds", "array-contains", user.uid).limit(500).get(), adminDb.collection("connections").where("participantIds", "array-contains", user.uid).limit(2_000).get(), adminDb.collection("job_applications").where("candidateId", "==", user.uid).limit(2_000).get(), adminDb.collection("job_applications").where("recruiterId", "==", user.uid).limit(2_000).get(), adminDb.collection("mentor_bookings").where("customerId", "==", user.uid).limit(2_000).get(), adminDb.collection("mentor_bookings").where("mentorId", "==", user.uid).limit(2_000).get(), adminDb.collection("mentor_payments").where("customerId", "==", user.uid).limit(2_000).get(), adminDb.collection("mentor_payments").where("mentorId", "==", user.uid).limit(2_000).get()]);
  const conversations = await Promise.all(conversationSnapshot.docs.map(async (doc) => { const messages = await doc.ref.collection("messages").orderBy("createdAt", "asc").limit(2_000).get(); return portable({ id: doc.id, ...doc.data(), messages: messages.docs.map((message) => ({ id: message.id, ...message.data() })) }); }));
  const applications = new Map([...candidateApplications.docs, ...recruiterApplications.docs].map((doc) => [doc.id, portable({ id: doc.id, ...doc.data() })]));
  const mentorshipBookings = new Map([...customerBookings.docs, ...mentorBookings.docs].map((doc) => [doc.id, portable({ id: doc.id, ...doc.data() })])); const mentorshipPayments = new Map([...customerMentorPayments.docs, ...mentorPayments.docs].map((doc) => [doc.id, portable({ id: doc.id, ...doc.data() })]));
  const exportBody = { exportVersion: "successpro-account-export-v1", generatedAt: new Date().toISOString(), account: { uid: user.uid, email: user.email ?? null, displayName: user.name ?? null }, data: { ...Object.fromEntries([...direct, ...owned]), moderation_reports: reported.docs.map((doc) => portable({ id: doc.id, ...doc.data() })), connections: connectionSnapshot.docs.map((doc) => portable({ id: doc.id, ...doc.data() })), job_applications: [...applications.values()], mentor_bookings: [...mentorshipBookings.values()], mentor_payments: [...mentorshipPayments.values()], conversations }, notes: ["Original uploaded binary files are not embedded in this JSON export.", "Public employer job records and shared system catalogs are not personal account data and are not included."] };
  return new NextResponse(JSON.stringify(exportBody, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="successpro-account-export-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "private, no-store" } });
}
