import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase-admin";

const updateSchema = z.object({ active: z.boolean(), reason: z.string().trim().min(20).max(1_000) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(["content_admin", "ops_admin"]);
  if (!admin) return NextResponse.json({ error: "Content-admin access is required." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Add a reason." }, { status: 400 });
  const id = (await params).id;
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id)) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  const reference = adminDb.collection("courses").doc(id); const audit = adminDb.collection("admin_audit_events").doc();
  const changed = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference); if (!snapshot.exists) return false;
    const before = Boolean(snapshot.data()?.active); const now = FieldValue.serverTimestamp();
    transaction.set(reference, { active: parsed.data.active, updatedAt: now, updatedBy: admin.user.uid }, { merge: true });
    transaction.create(audit, { id: audit.id, actorId: admin.user.uid, actorRoles: admin.roles, action: parsed.data.active ? "course-activated" : "course-deactivated", targetType: "course", targetId: id, before: { active: before }, after: { active: parsed.data.active }, reason: parsed.data.reason, outcome: "completed", createdAt: now, schemaVersion: 1 }); return true;
  });
  return changed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Course not found." }, { status: 404 });
}
