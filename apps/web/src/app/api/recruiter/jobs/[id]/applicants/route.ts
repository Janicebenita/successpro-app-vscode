import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to view applicants." }, { status: 401 });
  const id = (await params).id; const job = await adminDb.collection("recruiter_jobs").doc(id).get();
  if (!job.exists || job.data()?.recruiterId !== user.uid) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const applications = await adminDb.collection("job_applications").where("jobId", "==", id).limit(500).get();
  const candidates = await Promise.all(applications.docs.map(async (application) => { const value = application.data(); const profile = await adminDb.collection("profiles").doc(String(value.candidateId)).get(); const data = profile.data() ?? {}; return { application: { id: application.id, status: value.status, submittedAt: value.submittedAt?.toDate?.()?.toISOString?.() ?? null }, profile: { id: profile.id, fullName: data.fullName, headline: data.headline, location: data.location, summary: data.summary, skills: data.skills ?? [], experience: data.experience ?? [], education: data.education ?? [] } }; }));
  return NextResponse.json({ candidates }, { headers: { "Cache-Control": "private, no-store" } });
}
