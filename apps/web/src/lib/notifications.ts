import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";

export const notificationCategories = ["messages", "jobs", "career", "payments", "privacy", "security"] as const;
export type NotificationCategory = typeof notificationCategories[number];
export const mandatoryNotificationCategories = new Set<NotificationCategory>(["payments", "privacy", "security"]);

export async function createNotification(input: { ownerId: string; category: NotificationCategory; title: string; message: string; href: string; dedupeKey?: string }) {
  if (!mandatoryNotificationCategories.has(input.category)) {
    const settings = await adminDb.collection("user_settings").doc(input.ownerId).get();
    const preferences = settings.data()?.notificationPreferences as Record<string, unknown> | undefined;
    if (preferences?.[input.category] === false) return { created: false };
  }
  const reference = input.dedupeKey ? adminDb.collection("notifications").doc(input.dedupeKey) : adminDb.collection("notifications").doc();
  const record = { id: reference.id, ...input, readAt: null, createdAt: FieldValue.serverTimestamp(), schemaVersion: 1 };
  if (input.dedupeKey) {
    try { await reference.create(record); }
    catch (error) {
      const code = (error as { code?: unknown })?.code;
      if (code === 6 || code === "already-exists") return { created: false };
      throw error;
    }
  } else await reference.set(record);
  return { created: true, id: reference.id };
}

export function normalizeNotificationPreferences(value: unknown) {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(notificationCategories.map((category) => [category, mandatoryNotificationCategories.has(category) ? true : record[category] !== false])) as Record<NotificationCategory, boolean>;
}

export function paymentNotification(event: string) {
  if (event === "payment.captured" || event === "order.paid") return { title: "Payment confirmed", message: "Your writing-service payment was confirmed. Your project is ready for the next step." };
  if (event.includes("failed")) return { title: "Payment was not completed", message: "Your writing-service payment did not complete. No successful charge is recorded for this attempt." };
  return { title: "Payment update", message: "Your writing-service payment is being processed. We will keep this status updated." };
}
