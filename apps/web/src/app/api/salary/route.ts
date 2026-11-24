import { NextResponse } from "next/server";
import { salaryResearchSchema } from "@successpro/contracts";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { featureAvailable, resolveUserEntitlements } from "@/lib/feature-entitlements";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to view salary research." }, { status: 401 });
  const snapshot = await adminDb.collection("salary_research").doc(user.uid).get();
  return NextResponse.json({ research: snapshot.exists ? snapshot.data() : null });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to save salary research." }, { status: 401 });
  if (!featureAvailable(await resolveUserEntitlements(user.uid), "salaryAnalyses")) return NextResponse.json({ error: "Salary benchmarking is not included in your current plan." }, { status: 403 });
  const parsed = salaryResearchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the salary research details." }, { status: 400 });
  await adminDb.collection("salary_research").doc(user.uid).set({ ...parsed.data, userId: user.uid, schemaVersion: 1, updatedAt: new Date().toISOString() });
  return NextResponse.json({ research: parsed.data });
}
