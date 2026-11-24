import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { matchesRecruiterJob, recruiterJobInputSchema } from "@/lib/recruiter-jobs";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to browse recruiter-posted jobs." }, { status: 401 });
  const filters = new URL(request.url).searchParams;
  if (filters.get("mine") === "true") { const recruiter = await adminDb.collection("recruiter_accounts").doc(user.uid).get(); if (!recruiter.exists || recruiter.data()?.recruiterEnabled !== true) return NextResponse.json({ error: "Verified recruiter access is required." }, { status: 403 }); const own = await adminDb.collection("recruiter_jobs").where("recruiterId", "==", user.uid).limit(200).get(); return NextResponse.json({ jobs: own.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: undefined, updatedAt: undefined })) }, { headers: { "Cache-Control": "private, no-store" } }); }
  const snapshot = await adminDb.collection("recruiter_jobs").where("status", "==", "active").limit(500).get();
  const jobs: Array<Record<string, unknown> & { id: string }> = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const filtered = jobs.filter((job) => matchesRecruiterJob(job, filters)).sort((a, b) => String(b.publishedOn).localeCompare(String(a.publishedOn))).slice(0, 100);
  return NextResponse.json({ jobs: filtered }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to post a job." }, { status: 401 });
  const recruiter = await adminDb.collection("recruiter_accounts").doc(user.uid).get();
  if (!recruiter.exists || recruiter.data()?.dueDiligenceStatus !== "approved" || recruiter.data()?.recruiterEnabled !== true) return NextResponse.json({ error: "Recruiter posting is enabled only after SuccessPro due diligence is approved." }, { status: 403 });
  const parsed = recruiterJobInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the job details." }, { status: 400 });
  const id = randomUUID(); const now = new Date().toISOString();
  await adminDb.collection("recruiter_jobs").doc(id).create({ id, ...parsed.data, ownerId: user.uid, recruiterId: user.uid, organizationName: recruiter.data()?.organizationName ?? "Verified employer", status: "active", sourceType: "successpro_recruiter", publishedOn: now.slice(0, 10), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), schemaVersion: 1 });
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
