import { NextResponse } from "next/server";
import { z } from "zod";
import { aiTaskSchemas } from "@successpro/contracts/ai";
import { adminDb } from "@/lib/firebase-admin";
import { runAiTask } from "@/lib/ai/orchestrator";
import { getSessionUser } from "@/lib/session";
import { featureAvailable, resolveUserEntitlements } from "@/lib/feature-entitlements";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to explain this result." }, { status: 401 });
  if (!featureAvailable(await resolveUserEntitlements(user.uid), "detailedReports")) return NextResponse.json({ error: "Detailed report explanations are not included in your current plan." }, { status: 403 });
  const { id } = await context.params; const reference = adminDb.collection("analyses").doc(id); const snapshot = await reference.get();
  if (!snapshot.exists || snapshot.data()?.ownerId !== user.uid) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  const parsed = aiTaskSchemas.explainResumeIssue.input.extend({ factorId: z.string().min(1).max(120) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "This review item could not be explained." }, { status: 400 });
  const factor = snapshot.data()?.result?.factors?.find((item: { id: string }) => item.id === parsed.data.factorId);
  if (!factor) return NextResponse.json({ error: "Review factor not found." }, { status: 404 });
  const profile = await adminDb.collection("profiles").doc(user.uid).get();
  const result = await runAiTask("explainResumeIssue", { factor: factor.label, evidence: factor.evidence, issue: factor.issues.map((item: { severity: string; message: string }) => `${item.severity}: ${item.message}`).join(" ") || factor.action, targetRole: parsed.data.targetRole }, { ownerId: user.uid, sensitivity: "personal", preferredLanguage: String(profile.data()?.preferredLanguage ?? "en") });
  await reference.update({ [`detailedExplanations.${factor.id}`]: result.output, detailedUpdatedAt: new Date().toISOString() });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
