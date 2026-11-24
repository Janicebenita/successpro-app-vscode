import { NextResponse } from "next/server";
import { aiTaskNameSchema } from "@successpro/contracts/ai";
import { canonicalProfileSchema } from "@successpro/contracts";
import { runAiTask } from "@/lib/ai/orchestrator";
import { getSessionUser } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ task: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to use this assistant." }, { status: 401 });
  const { task: rawTask } = await context.params;
  const task = aiTaskNameSchema.safeParse(rawTask);
  if (!task.success) return NextResponse.json({ error: "This assistant task is not supported." }, { status: 404 });
  const rate = await consumeRateLimit(user.uid, { feature: `ai-${task.data}`, limit: 20, windowSeconds: 21_600 });
  if (!rate.allowed) return NextResponse.json({ error: "This assistant has reached its current usage limit. Try again later; your saved work is unchanged." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  try {
    const profile = await adminDb.collection("profiles").doc(user.uid).get();
    const rawInput = await request.json();
    const usesConfirmedProfile = ["generateCoverLetter", "generateLinkedInMakeover", "careerGapPlan", "recommendUpskilling"].includes(task.data);
    const confirmedProfile = usesConfirmedProfile ? canonicalProfileSchema.safeParse(profile.data()) : null;
    if (usesConfirmedProfile && !confirmedProfile?.success) return NextResponse.json({ error: "Complete and save your career details before creating this content." }, { status: 409 });
    const input = confirmedProfile?.success ? { ...rawInput, profile: confirmedProfile.data } : rawInput;
    const result = await runAiTask(task.data, input, { ownerId: user.uid, sensitivity: "personal", preferredLanguage: String(profile.data()?.preferredLanguage ?? "en") });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) return NextResponse.json({ error: "Check the information supplied and try again." }, { status: 400 });
    return NextResponse.json({ error: "The assistant is temporarily unavailable. Your saved information has not changed." }, { status: 503 });
  }
}
