import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { supportCategories, supportPriority, mandatoryHumanEscalation } from "@/lib/help-center";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session";
import { createNotification } from "@/lib/notifications";
import { recordProductEvent } from "@/lib/product-telemetry";
import { sendTransactionalEmail } from "@/lib/email-delivery";

const ticketSchema = z.object({ category: z.enum(supportCategories), subject: z.string().trim().min(5).max(160), description: z.string().trim().min(20).max(5_000), relatedPage: z.string().trim().max(200).default("") });

export async function POST(request: Request) {
  const user = await getSessionUser({ allowWithdrawn: true });
  if (!user) return NextResponse.json({ error: "Sign in to send a support request." }, { status: 401 });
  const rate = await consumeRateLimit(user.uid, { feature: "support-ticket", limit: 5, windowSeconds: 86_400 });
  if (!rate.allowed) return NextResponse.json({ error: "Several requests were submitted recently. Wait before sending another, or contact emergency services if someone is in immediate danger." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = ticketSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add a clear subject and at least 20 characters describing what happened." }, { status: 400 });
  const reference = adminDb.collection("support_tickets").doc();
  const now = FieldValue.serverTimestamp();
  const humanRequired = mandatoryHumanEscalation.has(parsed.data.category);
  await reference.set({ id: reference.id, ownerId: user.uid, ...parsed.data, priority: supportPriority(parsed.data.category), humanRequired, status: "open", createdAt: now, updatedAt: now, schemaVersion: 1 });
  const notificationCategory = parsed.data.category === "security-concern" ? "security" : parsed.data.category === "privacy-grievance" || parsed.data.category === "data-correction" ? "privacy" : parsed.data.category === "payment-dispute" ? "payments" : "career";
  await createNotification({ ownerId: user.uid, category: notificationCategory, title: "Support request received", message: `Your request ${reference.id} is in the ${humanRequired ? "human review" : "support"} queue.`, href: "/help", dedupeKey: `support-${reference.id}` }).catch(() => undefined);
  if (user.email_verified === true && user.email) {
    const delivery = await sendTransactionalEmail({
      to: user.email,
      subject: `SuccessPro support request ${reference.id}`,
      text: `We received your support request ${reference.id}. You can view updates in your SuccessPro account. If your concern is urgent, reply to this email at support@successpro.xfactor.ltd.`,
    });
    await adminDb.collection("email_events").doc().set({
      ownerId: user.uid,
      template: "support-request-received",
      referenceType: "support_ticket",
      referenceId: reference.id,
      provider: delivery.provider,
      outcome: delivery.status,
      createdAt: FieldValue.serverTimestamp(),
      schemaVersion: 1,
    }).catch(() => undefined);
  }
  await recordProductEvent({ ownerId: user.uid, name: "support_ticket_created", outcome: "success" }).catch(() => undefined);
  return NextResponse.json({ ok: true, ticketId: reference.id, humanRequired, message: humanRequired ? "Your request has been placed in the human review queue." : "Your support request has been received." });
}
