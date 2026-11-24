import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { jobPreferencesSchema } from "@successpro/contracts";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const snapshot = await adminDb.collection("job_preferences").doc(user.uid).get();
  return NextResponse.json({ preferences: snapshot.exists ? snapshot.data() : null });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = jobPreferencesSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Review the job preference fields." }, { status: 400 });
  await adminDb.collection("job_preferences").doc(user.uid).set({ ...parsed.data, id: user.uid, ownerId: user.uid, schemaVersion: 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return NextResponse.json({ ok: true });
}
