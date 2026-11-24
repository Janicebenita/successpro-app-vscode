import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

const version = "successpro-external-ai-data-use-2026-09-24";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to view this choice." }, { status: 401 });
  const snapshot = await adminDb.collection("registration_consents").doc(user.uid).get();
  const value = snapshot.data();
  return NextResponse.json({ accepted: value?.externalAiDataUseAccepted === true, acceptedVersion: value?.externalAiDataUseVersion ?? null, currentVersion: version }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST() {
  const user = await getSessionUser({ allowWithdrawn: true });
  if (!user) return NextResponse.json({ error: "Sign in to record this choice." }, { status: 401 });
  const now = FieldValue.serverTimestamp(); const event = adminDb.collection("consent_events").doc();
  const batch = adminDb.batch();
  batch.set(adminDb.collection("registration_consents").doc(user.uid), { ownerId: user.uid, externalAiDataUseAccepted: true, externalAiDataUseVersion: version, externalAiDataUseAcceptedAt: now, updatedAt: now }, { merge: true });
  batch.set(event, { ownerId: user.uid, event: "external-ai-data-use-accepted", externalAiDataUseAccepted: true, externalAiDataUseVersion: version, acceptedAt: now, schemaVersion: 1 });
  await batch.commit(); return NextResponse.json({ ok: true, version });
}
