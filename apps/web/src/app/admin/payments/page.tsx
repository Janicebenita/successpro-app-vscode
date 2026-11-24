import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import { AppShell } from "@/components/app-shell";
import { AdminWebhookReplayQueue } from "@/components/admin-webhook-replay-queue";
import { requireAdmin } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase-admin";

export const metadata: Metadata = {
  title: "Billing recovery",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const admin = await requireAdmin(["ops_admin", "finance_admin", "auditor"]);
  if (!admin) redirect("/dashboard");
  const snapshot = await adminDb.collection("webhook_events").orderBy("receivedAt", "desc").limit(200).get();
  const events = snapshot.docs.flatMap((document) => {
    const value = document.data(); const result = String(value.processingResult ?? ""); const attempts = Number(value.processingAttempts ?? 0);
    if (!["failed", "unmatched"].includes(result) || !Number.isInteger(attempts) || attempts >= 5) return [];
    return [{ id: document.id, type: String(value.type ?? "Unknown event"), processingResult: result, processingAttempts: attempts, receivedAt: value.receivedAt?.toDate?.()?.toISOString?.() ?? null, providerCreatedAt: typeof value.providerCreatedAt === "number" ? value.providerCreatedAt : null, recordKind: typeof value.providerSubscriptionId === "string" && value.providerSubscriptionId.trim() ? "subscription" as const : "payment" as const }];
  });
  const auditRef = adminDb.collection("admin_audit_events").doc();
  await auditRef.create({ id: auditRef.id, actorId: admin.user.uid, actorRoles: admin.roles, action: "payment-webhook-recovery-queue-viewed", targetType: "admin_console", targetId: "payment-webhook-recovery", before: null, after: { recoverableWebhookCount: events.length, rawPaymentPayloadIncluded: false, cardDataIncluded: false }, reason: "Authorized billing-recovery review under least-privilege payment operations policy.", outcome: "completed", createdAt: FieldValue.serverTimestamp(), schemaVersion: 1 });
  const canReplay = admin.roles.some((role) => role === "super_admin" || role === "ops_admin" || role === "finance_admin");
  return <AppShell admin><section className="welcome"><div><span className="status-pill">BILLING RECOVERY</span><h2>Signed webhook exceptions</h2><p>Review only the minimum event metadata needed to recover a failed or unmatched payment update.</p></div><span className="quota-badge">{admin.roles.join(", ")}</span></section><AdminWebhookReplayQueue initialEvents={events} canReplay={canReplay} /></AppShell>;
}
