import { NextResponse } from "next/server";
import { jobMatchInputSchema } from "@successpro/contracts";
import { analyzeJobMatch } from "@successpro/domain";
import { getSessionUser } from "@/lib/session";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to compare a job description." }, { status: 401 });
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev) {
    const rate = await consumeRateLimit(user.uid, { feature: "job-match", limit: 30, windowSeconds: 300 });
    if (!rate.allowed) return NextResponse.json({ error: "Too many job match checks were started. Wait a few minutes and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  const parsed = jobMatchInputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Add a complete resume and job description before comparing." }, { status: 400 });
  return NextResponse.json({ result: analyzeJobMatch(parsed.data) });
}
