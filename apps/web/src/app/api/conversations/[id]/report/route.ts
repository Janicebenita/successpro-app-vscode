import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { consumeRateLimit } from "@/lib/rate-limit";

const CATEGORIES = new Set(["spam", "harassment", "misleading", "other"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  const rate = await consumeRateLimit(user.uid, { feature: "conversation-report", limit: 3, windowSeconds: 86_400 });
  if (!rate.allowed) return NextResponse.json({ error: "You have sent several reports recently. Wait before sending another report, or use the support channel if someone is in immediate danger." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const { id } = await params;
  if (!/^[a-f0-9]{32}$/.test(id)) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const conversation = await adminDb.collection("conversations").doc(id).get();
  if (!conversation.exists || !(conversation.data()?.participantIds as string[] | undefined)?.includes(user.uid)) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { category?: unknown; details?: unknown } | null;
  const category = typeof body?.category === "string" ? body.category : "";
  const details = typeof body?.details === "string" ? body.details.trim() : "";
  if (!CATEGORIES.has(category) || details.length > 1_000) return NextResponse.json({ error: "Choose a reason and keep additional details under 1,000 characters." }, { status: 400 });
  const reference = adminDb.collection("moderation_reports").doc();
  await reference.set({ id: reference.id, reporterId: user.uid, conversationId: id, category, details, status: "new", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), schemaVersion: 1 });
  return NextResponse.json({ ok: true });
}
