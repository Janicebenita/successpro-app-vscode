import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { documentDraftSchema } from "@/lib/document-draft";

export async function GET() {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to view draft history." }, { status: 401 });
  const snapshot = await adminDb.collection("document_draft_versions").where("ownerId", "==", user.uid).limit(50).get();
  const versions = snapshot.docs.flatMap((doc) => { const parsed = documentDraftSchema.safeParse(doc.data()); return parsed.success ? [{ id: doc.id, savedAt: doc.data().createdAt?.toDate?.().toISOString() ?? "", draft: parsed.data }] : []; }).sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 20);
  return NextResponse.json({ versions }, { headers: { "Cache-Control": "private, no-store" } });
}
