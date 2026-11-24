import { NextResponse } from "next/server";
import { courseCatalogEntrySchema } from "@successpro/contracts/learning";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  const admin = await requireAdmin(["content_admin", "ops_admin"]);
  if (!admin) return NextResponse.json({ error: "Content-admin access is required." }, { status: 403 });
  const parsed = courseCatalogEntrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the course details." }, { status: 400 });
  const reference = adminDb.collection("courses").doc(parsed.data.id); const audit = adminDb.collection("admin_audit_events").doc();
  const created = await adminDb.runTransaction(async (transaction) => {
    if ((await transaction.get(reference)).exists) return false;
    const now = FieldValue.serverTimestamp();
    transaction.create(reference, { ...parsed.data, active: true, createdAt: now, updatedAt: now, createdBy: admin.user.uid, updatedBy: admin.user.uid, schemaVersion: 1 });
    transaction.create(audit, { id: audit.id, actorId: admin.user.uid, actorRoles: admin.roles, action: "course-created", targetType: "course", targetId: parsed.data.id, before: null, after: { ...parsed.data, active: true }, reason: "Publish a verified learning source for member recommendations.", outcome: "completed", createdAt: now, schemaVersion: 1 });
    return true;
  });
  return created ? NextResponse.json({ ok: true, course: parsed.data }, { status: 201 }) : NextResponse.json({ error: "A course with this ID already exists." }, { status: 409 });
}
