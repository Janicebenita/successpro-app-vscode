import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

const lifecycleSchema = z.object({ status: z.enum(["active", "paused", "closed"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to manage this job." }, { status: 401 });
  const parsed = lifecycleSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Choose active, paused, or closed." }, { status: 400 });
  const reference = adminDb.collection("recruiter_jobs").doc((await params).id);
  const changed = await adminDb.runTransaction(async (transaction) => { const snapshot = await transaction.get(reference); if (!snapshot.exists || snapshot.data()?.recruiterId !== user.uid) return false; if (snapshot.data()?.status === "closed" && parsed.data.status !== "closed") return false; transaction.set(reference, { status: parsed.data.status, updatedAt: FieldValue.serverTimestamp(), closedAt: parsed.data.status === "closed" ? FieldValue.serverTimestamp() : null }, { merge: true }); return true; });
  if (!changed) return NextResponse.json({ error: "The job was not found or cannot be reopened after closing." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
