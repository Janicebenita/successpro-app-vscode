import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase-admin";
import { recruiterDecisionSchema } from "@/lib/recruiter-account";
import { createNotification } from "@/lib/notifications";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(["ops_admin"]); if (!admin) return NextResponse.json({ error: "This action requires operations-admin access." }, { status: 403 });
  const parsed = recruiterDecisionSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Add a decision and reason." }, { status: 400 });
  const id = (await params).id; const reference = adminDb.collection("recruiter_accounts").doc(id); const audit = adminDb.collection("admin_audit_events").doc();
  const result = await adminDb.runTransaction(async (transaction) => { const snapshot = await transaction.get(reference); if (!snapshot.exists) return false; const before = String(snapshot.data()?.dueDiligenceStatus ?? "not_submitted"); if (before !== "pending") return false; const now = FieldValue.serverTimestamp(); transaction.set(reference, { dueDiligenceStatus: parsed.data.status, recruiterEnabled: parsed.data.status === "approved", decisionReason: parsed.data.reason, reviewedAt: now, reviewedBy: admin.user.uid, updatedAt: now }, { merge: true }); transaction.create(audit, { id: audit.id, actorId: admin.user.uid, actorRoles: admin.roles, action: "recruiter-due-diligence-decided", targetType: "recruiter_account", targetId: id, before: { dueDiligenceStatus: before }, after: { dueDiligenceStatus: parsed.data.status, recruiterEnabled: parsed.data.status === "approved" }, reason: parsed.data.reason, outcome: "completed", createdAt: now, schemaVersion: 1 }); return true; });
  if (!result) return NextResponse.json({ error: "This recruiter application is no longer pending." }, { status: 409 });
  await createNotification({ ownerId: id, category: "career", title: parsed.data.status === "approved" ? "Recruiter access approved" : "Recruiter application update", message: parsed.data.status === "approved" ? "You can now publish roles from your recruiter workspace." : "Your recruiter application was not approved. Review the reason in your recruiter workspace before resubmitting.", href: "/recruiter", dedupeKey: `recruiter-decision-${audit.id}` }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
