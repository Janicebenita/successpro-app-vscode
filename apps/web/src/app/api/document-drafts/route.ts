import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { documentDraftSchema } from "@/lib/document-draft";

export async function GET() { const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to view document drafts." }, { status: 401 }); const snapshot = await adminDb.collection("document_drafts").doc(user.uid).get(); return NextResponse.json({ draft: snapshot.exists ? snapshot.data() : null }, { headers: { "Cache-Control": "private, no-store" } }); }

export async function PUT(request: Request) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to save document drafts." }, { status: 401 });
  const parsed = documentDraftSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "The document draft contains invalid fields." }, { status: 400 });
  const current = adminDb.collection("document_drafts").doc(user.uid); const version = adminDb.collection("document_draft_versions").doc(); const now = FieldValue.serverTimestamp(); const batch = adminDb.batch();
  batch.set(current, { ...parsed.data, id: user.uid, ownerId: user.uid, latestVersionId: version.id, updatedAt: now, schemaVersion: 1 });
  batch.set(version, { ...parsed.data, id: version.id, ownerId: user.uid, createdAt: now, schemaVersion: 1 });
  await batch.commit(); return NextResponse.json({ ok: true, versionId: version.id });
}
