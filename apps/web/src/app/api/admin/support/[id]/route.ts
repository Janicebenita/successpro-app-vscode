import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase-admin";

const inputSchema = z.object({ status: z.enum(["reviewing", "resolved"]), reason: z.string().trim().min(10).max(1_000) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(["ops_admin", "support_admin"]);
  if (!admin) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const { id } = await params;
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return NextResponse.json({ error: "Support request not found." }, { status: 404 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Record a reason of at least 10 characters." }, { status: 400 });
  const ticketRef = adminDb.collection("support_tickets").doc(id); const auditRef = adminDb.collection("admin_audit_events").doc();
  const result = await adminDb.runTransaction(async (transaction) => { const ticket = await transaction.get(ticketRef); if (!ticket.exists) return { status: 404, error: "Support request not found." }; const current = String(ticket.data()?.status ?? "open"); if (current === "resolved" || current === parsed.data.status) return { status: 409, error: "This support request cannot move to that status." }; const now = FieldValue.serverTimestamp(); transaction.set(ticketRef, { status: parsed.data.status, assignedTo: admin.user.uid, decisionReason: parsed.data.reason, updatedAt: now, resolvedAt: parsed.data.status === "resolved" ? now : null }, { merge: true }); transaction.create(auditRef, { id: auditRef.id, actorId: admin.user.uid, actorRoles: admin.roles, action: "support-ticket-status-changed", targetType: "support_ticket", targetId: id, before: { status: current }, after: { status: parsed.data.status }, reason: parsed.data.reason, outcome: "completed", createdAt: now, schemaVersion: 1 }); return { status: 200 }; });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status }); return NextResponse.json({ ok: true });
}
