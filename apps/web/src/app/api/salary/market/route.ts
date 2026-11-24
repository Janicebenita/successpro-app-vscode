import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { featureAvailable, resolveUserEntitlements } from "@/lib/feature-entitlements";
import { researchSalaryMarket } from "@/lib/salary-market";

const inputSchema = z.object({ role: z.string().trim().min(2).max(140), location: z.string().trim().min(2).max(160), yearsExperience: z.number().min(0).max(60), industry: z.string().trim().max(120).optional(), currency: z.string().trim().length(3).default("INR") });

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to research salary benchmarks." }, { status: 401 });
  if (!featureAvailable(await resolveUserEntitlements(user.uid), "salaryAnalyses")) return NextResponse.json({ error: "Salary benchmarking is not included in your current plan." }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add a role, present-job geography, and relevant experience." }, { status: 400 });
  const result = await researchSalaryMarket(parsed.data);
  // Sparse markets and a temporarily unavailable research provider are normal
  // outcomes, not a member error. Keep the workspace usable and let its
  // no-evidence state explain that a range will not be guessed.
  if (!result) return NextResponse.json({
    sources: [],
    currency: parsed.data.currency,
    summary: "No reliable current online salary evidence was available for this exact comparison.",
    queries: [],
    disclaimer: "We could not verify a salary range for this role and location today, so no estimate has been shown. Your saved profile is unchanged; try again later or refine the role, location, experience, or industry.",
  }, { headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
