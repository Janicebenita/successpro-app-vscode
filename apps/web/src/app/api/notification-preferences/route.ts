import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { normalizeNotificationPreferences } from "@/lib/notifications";
export async function GET() { const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to view notification settings." }, { status: 401 }); const snapshot = await adminDb.collection("user_settings").doc(user.uid).get(); return NextResponse.json({ preferences: normalizeNotificationPreferences(snapshot.data()?.notificationPreferences) }); }
export async function PUT(request: Request) { const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to update notification settings." }, { status: 401 }); const preferences = normalizeNotificationPreferences(await request.json().catch(() => null)); await adminDb.collection("user_settings").doc(user.uid).set({ ownerId: user.uid, notificationPreferences: preferences, updatedAt: FieldValue.serverTimestamp(), schemaVersion: 1 }, { merge: true }); return NextResponse.json({ ok: true, preferences }); }
