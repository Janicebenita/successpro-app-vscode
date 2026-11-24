import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { careerGoalSchema } from "@successpro/contracts";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const snapshot = await adminDb.collection("career_goals").doc(user.uid).get();
  return NextResponse.json({ goal: snapshot.exists ? snapshot.data() : null });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = careerGoalSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Add a target role and review each task." }, { status: 400 });
  await adminDb.collection("career_goals").doc(user.uid).set({ ...parsed.data, id: user.uid, ownerId: user.uid, schemaVersion: 2, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return NextResponse.json({ ok: true });
}
