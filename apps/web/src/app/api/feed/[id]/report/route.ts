import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { consumeRateLimit } from "@/lib/rate-limit";
import { feedReportSchema } from "@/lib/feed";
import { canViewFeedEvent } from "@/lib/feed-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to report this update." }, { status: 401 }); const rate = await consumeRateLimit(user.uid, { feature: "feed-report", limit: 10, windowSeconds: 86_400 }); if (!rate.allowed) return NextResponse.json({ error: "Too many reports were submitted. Try again tomorrow." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }); const parsed = feedReportSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the report." }, { status: 400 }); const eventId = (await params).id; const event = await adminDb.collection("feed_events").doc(eventId).get(); if (!event.exists) return NextResponse.json({ error: "This update is unavailable." }, { status: 404 }); if (!await canViewFeedEvent(user.uid, String(event.data()?.ownerId ?? ""))) return NextResponse.json({ error: "This update is not available to you." }, { status: 403 }); const id = randomUUID(); await adminDb.collection("moderation_reports").doc(id).create({ id, reporterId: user.uid, targetType: "feed_event", targetId: eventId, reportedOwnerId: event.data()?.ownerId, category: parsed.data.reason, details: parsed.data.details, status: "new", createdAt: FieldValue.serverTimestamp(), schemaVersion: 1 }); return NextResponse.json({ ok: true }, { status: 201 }); }
