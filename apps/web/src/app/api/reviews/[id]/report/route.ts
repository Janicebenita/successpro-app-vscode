import { resolveUserEntitlements } from "@/lib/feature-entitlements";
import { projectReviewGuidance, projectWorkbookReview } from "@/lib/successpro-v2-review";
import { NextResponse } from "next/server";
import { resumeAnalysisResultSchema } from "@successpro/contracts";
import { aiTaskSchemas } from "@successpro/contracts/ai";
import { loadReview } from "@/lib/review-storage";
import { renderReviewReport } from "@/lib/review-report-renderer";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Sign in to download this report." }, { status: 401 });
  const { id } = await context.params; const value = await loadReview(id,user.uid);
  if (!value) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  const result = resumeAnalysisResultSchema.safeParse(value?.result); if (!result.success) return NextResponse.json({ error: "This report is unavailable." }, { status: 409 });
  const access = await resolveUserEntitlements(user.uid);
  const paid = access.entitlements.detailedAnalysesPerMonth > 0;
  const summary = aiTaskSchemas.analyzeResume.output.safeParse(value?.assistant?.output);
  const explanations = Object.fromEntries(Object.entries(value?.detailedExplanations ?? {}).flatMap(([key, item]) => { const parsed = aiTaskSchemas.explainResumeIssue.output.safeParse(item); return parsed.success ? [[key, parsed.data]] : []; }));
  const pdf = await renderReviewReport({ result: projectWorkbookReview(result.data, paid, value.input), summary: paid && summary.success ? projectReviewGuidance({ output: summary.data }, value.input).output : undefined, explanations: paid ? explanations : {}, targetRole: value?.input?.targetKeywords?.join(", ") ?? "", completedOn: typeof value.completedAt === "string" ? value.completedAt.slice(0,10) : new Date().toISOString().slice(0,10) });
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="successpro-detailed-review-${id.slice(0, 8)}.pdf"`, "Cache-Control": "private, no-store" } });
}
