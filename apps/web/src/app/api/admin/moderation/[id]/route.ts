import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase-admin";
import { moderationStatuses, moderationTransition } from "@/lib/moderation";

const inputSchema = z.object({ status: z.enum(moderationStatuses), reason: z.string().trim().min(10).max(1_000) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(["ops_admin", "support_admin"]);
  if (!admin) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const { id } = await params;
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid outcome and record a reason of at least 10 characters." }, { status: 400 });
  const reportRef = adminDb.collection("moderation_reports").doc(id);
  const auditRef = adminDb.collection("admin_audit_events").doc();
  const result = await adminDb.runTransaction(async (transaction) => {
    const report = await transaction.get(reportRef);
    if (!report.exists) return { status: 404, error: "Report not found." };
    const current = String(report.data()?.status ?? "new");
    if (!moderationTransition(current, parsed.data.status)) return { status: 409, error: "This report cannot move to that status." };
    const now = FieldValue.serverTimestamp();
    transaction.set(reportRef, { status: parsed.data.status, reviewedBy: admin.user.uid, reviewReason: parsed.data.reason, reviewedAt: now, updatedAt: now }, { merge: true });
    transaction.create(auditRef, { id: auditRef.id, actorId: admin.user.uid, actorRoles: admin.roles, action: "moderation-report-status-changed", targetType: "moderation_report", targetId: id, before: { status: current }, after: { status: parsed.data.status }, reason: parsed.data.reason, outcome: "completed", createdAt: now, schemaVersion: 1 });
    return { status: 200 };
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
