import { randomUUID } from "node:crypto";
import { FieldValue, type DocumentReference, type Query } from "firebase-admin/firestore";
import { adminAuth, adminDb, adminStorage } from "./firebase-admin";
import { anonymizeConversationForDeletedAccount, DELETE_DIRECT_COLLECTIONS, DELETE_OWNER_COLLECTIONS, RETAIN_OWNER_ANONYMIZED_COLLECTIONS } from "./account-deletion-policy";

async function commitInChunks(actions: Array<(batch: FirebaseFirestore.WriteBatch) => void>) {
  for (let offset = 0; offset < actions.length; offset += 400) {
    const batch = adminDb.batch();
    actions.slice(offset, offset + 400).forEach((action) => action(batch));
    await batch.commit();
  }
}

async function docs(query: Query) {
  const result: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  do {
    let pageQuery = query.limit(400);
    if (cursor) pageQuery = pageQuery.startAfter(cursor);
    const page = await pageQuery.get();
    result.push(...page.docs);
    cursor = page.docs.at(-1);
    if (page.size < 400) break;
  } while (cursor);
  return result;
}

export async function deleteAccountData(uid: string) {
  const deletionReference = randomUUID();
  const deletedMarker = `deleted-${deletionReference}`;
  const counts: Record<string, number> = {};

  for (const collection of DELETE_OWNER_COLLECTIONS) {
    const owned = await docs(adminDb.collection(collection).where("ownerId", "==", uid));
    await commitInChunks(owned.map((snapshot) => (batch) => batch.delete(snapshot.ref)));
    counts[collection] = owned.length;
  }
  for (const collection of RETAIN_OWNER_ANONYMIZED_COLLECTIONS) {
    const owned = await docs(adminDb.collection(collection).where("ownerId", "==", uid));
    await commitInChunks(owned.map((snapshot) => (batch) => batch.set(snapshot.ref, { ownerId: null, ownerDeletionReference: deletionReference, email: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true })));
    counts[`${collection}Anonymized`] = owned.length;
  }
  const reports = await docs(adminDb.collection("moderation_reports").where("reporterId", "==", uid));
  await commitInChunks(reports.map((snapshot) => (batch) => batch.set(snapshot.ref, { reporterId: null, reporterDeletionReference: deletionReference, updatedAt: FieldValue.serverTimestamp() }, { merge: true })));
  counts.moderationReportsAnonymized = reports.length;
  const reviewedReports = await docs(adminDb.collection("moderation_reports").where("reviewedBy", "==", uid));
  await commitInChunks(reviewedReports.map((snapshot) => (batch) => batch.set(snapshot.ref, { reviewedBy: null, reviewerDeletionReference: deletionReference, updatedAt: FieldValue.serverTimestamp() }, { merge: true })));
  counts.reviewedReportsAnonymized = reviewedReports.length;
  const adminAudit = await docs(adminDb.collection("admin_audit_events").where("actorId", "==", uid));
  await commitInChunks(adminAudit.map((snapshot) => (batch) => batch.set(snapshot.ref, { actorId: null, actorDeletionReference: deletionReference }, { merge: true })));
  counts.adminAuditEventsAnonymized = adminAudit.length;
  const assignedTickets = await docs(adminDb.collection("support_tickets").where("assignedTo", "==", uid));
  await commitInChunks(assignedTickets.map((snapshot) => (batch) => batch.set(snapshot.ref, { assignedTo: null, assigneeDeletionReference: deletionReference, updatedAt: FieldValue.serverTimestamp() }, { merge: true })));
  counts.assignedTicketsAnonymized = assignedTickets.length;
  const [candidateApplications, recruiterApplications] = await Promise.all([docs(adminDb.collection("job_applications").where("candidateId", "==", uid)), docs(adminDb.collection("job_applications").where("recruiterId", "==", uid))]);
  const applicationMap = new Map([...candidateApplications, ...recruiterApplications].map((snapshot) => [snapshot.id, snapshot]));
  await commitInChunks([...applicationMap.values()].map((snapshot) => (batch) => batch.delete(snapshot.ref)));
  counts.jobApplications = applicationMap.size;
  const [customerBookings, mentorBookings, customerMentorPayments, mentorPayments] = await Promise.all([docs(adminDb.collection("mentor_bookings").where("customerId", "==", uid)), docs(adminDb.collection("mentor_bookings").where("mentorId", "==", uid)), docs(adminDb.collection("mentor_payments").where("customerId", "==", uid)), docs(adminDb.collection("mentor_payments").where("mentorId", "==", uid))]);
  const bookingMap = new Map([...customerBookings, ...mentorBookings].map((snapshot) => [snapshot.id, snapshot])); const paymentMap = new Map([...customerMentorPayments, ...mentorPayments].map((snapshot) => [snapshot.id, snapshot]));
  const bookingEvents = (await Promise.all([...bookingMap.keys()].map((bookingId) => docs(adminDb.collection("mentor_booking_events").where("bookingId", "==", bookingId))))).flat();
  await commitInChunks([...bookingEvents.map((snapshot) => (batch: FirebaseFirestore.WriteBatch) => batch.delete(snapshot.ref)), ...bookingMap.values().map((snapshot) => (batch: FirebaseFirestore.WriteBatch) => batch.delete(snapshot.ref)), ...paymentMap.values().map((snapshot) => (batch: FirebaseFirestore.WriteBatch) => batch.delete(snapshot.ref))]);
  counts.mentorBookings = bookingMap.size; counts.mentorPayments = paymentMap.size; counts.mentorBookingEvents = bookingEvents.length;
  const connections = await docs(adminDb.collection("connections").where("participantIds", "array-contains", uid));
  await commitInChunks(connections.map((snapshot) => (batch) => batch.delete(snapshot.ref)));
  counts.connections = connections.length;

  const conversations = await docs(adminDb.collection("conversations").where("participantIds", "array-contains", uid));
  for (const conversation of conversations) {
    const messages = await docs(conversation.ref.collection("messages").orderBy("createdAt", "asc"));
    const authored = messages.filter((message) => message.data().senderId === uid);
    await commitInChunks(authored.map((message) => (batch) => batch.set(message.ref, { senderId: deletedMarker, text: "Message removed after account deletion.", deletedAt: FieldValue.serverTimestamp() }, { merge: true })));
    const anonymized = anonymizeConversationForDeletedAccount(conversation.data(), uid, deletedMarker);
    await conversation.ref.update({ ...anonymized, deletedParticipants: FieldValue.arrayUnion(deletedMarker), updatedAt: FieldValue.serverTimestamp() });
    counts.messages = (counts.messages ?? 0) + authored.length;
  }
  counts.conversations = conversations.length;

  const directReferences: DocumentReference[] = DELETE_DIRECT_COLLECTIONS.map((collection) => adminDb.collection(collection).doc(uid));
  await commitInChunks(directReferences.map((reference) => (batch) => batch.delete(reference)));
  const bucketName = process.env.SUCCESSPRO_PRIVATE_BUCKET;
  if (!bucketName) throw new Error("Private storage is not configured");
  await adminStorage.bucket(bucketName).deleteFiles({ prefix: `resumes/${uid}/`, force: true });
  await adminStorage.bucket(bucketName).deleteFiles({ prefix: `profiles/${uid}/`, force: true });
  await adminStorage.bucket(bucketName).deleteFiles({ prefix: `feed/${uid}/`, force: true });
  await adminAuth.deleteUser(uid);
  await adminDb.collection("account_deletion_events").doc(deletionReference).set({ id: deletionReference, completedAt: FieldValue.serverTimestamp(), retainedCategories: ["anonymized-addon-orders", "anonymized-consent-events", "anonymized-safety-reports", "provider-payment-events"], counts, schemaVersion: 1 });
  return { deletionReference };
}
