import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { createNotification } from "@/lib/notifications";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to apply." }, { status: 401 });
  const id = (await params).id; const jobRef = adminDb.collection("recruiter_jobs").doc(id); const profileRef = adminDb.collection("profiles").doc(user.uid);
  const [job, profile] = await Promise.all([jobRef.get(), profileRef.get()]);
  if (!job.exists || job.data()?.status !== "active") return NextResponse.json({ error: "This job is no longer accepting applications." }, { status: 404 });
  if (!profile.exists || !profile.data()?.fullName || !Array.isArray(profile.data()?.experience)) return NextResponse.json({ error: "Complete your SuccessPro profile and career timeline before applying." }, { status: 409 });
  if (job.data()?.recruiterId === user.uid) return NextResponse.json({ error: "You cannot apply to your own job." }, { status: 400 });
  const applicationId = createHash("sha256").update(`${id}:${user.uid}`).digest("hex").slice(0, 32); const applicationRef = adminDb.collection("job_applications").doc(applicationId);
  const conversationId = createHash("sha256").update(`job:${id}:${user.uid}`).digest("hex").slice(0, 32); const conversationRef = adminDb.collection("conversations").doc(conversationId); const messageId = randomUUID(); const now = FieldValue.serverTimestamp();
  const result = await adminDb.runTransaction(async (transaction) => { const existing = await transaction.get(applicationRef); if (existing.exists) return false; transaction.create(applicationRef, { id: applicationId, jobId: id, candidateId: user.uid, recruiterId: job.data()?.recruiterId, profileId: user.uid, profileVersionUpdatedAt: profile.data()?.updatedAt ?? null, status: "submitted", submittedAt: now, schemaVersion: 1 }); transaction.set(conversationRef, { id: conversationId, participantIds: [user.uid, job.data()?.recruiterId], jobId: id, applicationId, initiatedBy: user.uid, lastMessagePreview: `Application submitted for ${job.data()?.title}.`, lastMessageId: messageId, lastMessageSenderId: user.uid, readMessageIds: { [user.uid]: messageId }, createdAt: now, updatedAt: now, schemaVersion: 2 }); transaction.create(conversationRef.collection("messages").doc(messageId), { id: messageId, senderId: user.uid, text: `I applied for ${job.data()?.title} using my SuccessPro profile.`, createdAt: now, schemaVersion: 1 }); return true; });
  if (!result) return NextResponse.json({ error: "You have already applied for this position." }, { status: 409 });
  await createNotification({ ownerId: String(job.data()?.recruiterId), category: "jobs", title: "New job application", message: `A candidate applied for ${job.data()?.title} using their SuccessPro profile.`, href: "/messages", dedupeKey: `application-${applicationId}` }).catch(() => undefined);
  return NextResponse.json({ ok: true, applicationId, conversationId }, { status: 201 });
}
