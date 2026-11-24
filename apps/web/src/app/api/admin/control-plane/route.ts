import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-access";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

const settingsSchema = z.object({
  tracking: z.object({ googleAnalyticsId: z.string().trim().max(80), googleTagManagerId: z.string().trim().max(80), googleAdsId: z.string().trim().max(80), metaPixelId: z.string().trim().max(80), linkedInInsightTagId: z.string().trim().max(80) }),
  delivery: z.object({ emailProvider: z.string().trim().max(80), senderAddress: z.union([z.literal(""), z.string().email().max(254)]), replyToAddress: z.union([z.literal(""), z.string().email().max(254)]), monthlyOperatingCostInr: z.number().min(0).max(100_000_000), monthlyAiBudgetInr: z.number().min(0).max(100_000_000) }),
  payment: z.object({ mode: z.string().trim().max(40), keyIdConfigured: z.boolean(), keySecretConfigured: z.boolean(), webhookSecretConfigured: z.boolean(), enabled: z.boolean() }),
});
const roleSchema = z.enum(["ops_admin", "support_admin", "finance_admin", "mentor_admin", "content_admin", "advertiser_admin", "auditor"]);
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save-settings"), settings: settingsSchema }),
  z.object({ action: z.literal("update-member"), memberId: z.string().min(8).max(128), disabled: z.boolean().optional(), roles: z.array(roleSchema).max(3).optional(), reason: z.string().trim().min(20).max(500) }),
  z.object({ action: z.literal("send-reminder"), memberId: z.string().min(8).max(128), title: z.string().trim().min(3).max(120), message: z.string().trim().min(8).max(600) }),
]);

function cleanTracking(value: string) { return value.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 80); }

export async function POST(request: Request) {
  const admin = await requireAdmin(["ops_admin", "support_admin", "finance_admin", "advertiser_admin"]);
  if (!admin) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The administrative request is not valid." }, { status: 400 });
  const input = parsed.data;
  const audit = adminDb.collection("admin_audit_events").doc();
  const now = FieldValue.serverTimestamp();

  if (input.action === "save-settings") {
    if (!admin.roles.includes("super_admin")) return NextResponse.json({ error: "Only a super administrator may change platform settings." }, { status: 403 });
    const safeSettings = { ...input.settings, payment: { mode: "deployment-controlled", keyIdConfigured: false, keySecretConfigured: false, webhookSecretConfigured: false, enabled: false }, tracking: Object.fromEntries(Object.entries(input.settings.tracking).map(([key, value]) => [key, cleanTracking(value)])) } as z.infer<typeof settingsSchema>;
    await adminDb.collection("system_config").doc("admin_operational_settings").set({ ...safeSettings, updatedBy: admin.user.uid, updatedAt: now, schemaVersion: 1 }, { merge: true });
    await audit.set({ id: audit.id, actorId: admin.user.uid, actorRoles: admin.roles, action: "admin-operational-settings-updated", targetType: "system_config", targetId: "admin_operational_settings", before: null, after: { trackingConfigured: Object.values(safeSettings.tracking).filter(Boolean).length, emailProviderConfigured: Boolean(safeSettings.delivery.emailProvider), operatingCostConfigured: safeSettings.delivery.monthlyOperatingCostInr > 0, aiBudgetConfigured: safeSettings.delivery.monthlyAiBudgetInr > 0, paymentEnablementRequested: false }, reason: "Super administrator updated non-secret operational settings.", outcome: "completed", createdAt: now, schemaVersion: 1 });
    return NextResponse.json({ ok: true });
  }

  if (input.action === "update-member") {
    if (!admin.roles.includes("super_admin")) return NextResponse.json({ error: "Only a super administrator may change member access." }, { status: 403 });
    if (input.memberId === admin.user.uid) return NextResponse.json({ error: "Use a second super administrator for changes to your own access." }, { status: 409 });
    const member = await adminAuth.getUser(input.memberId).catch(() => null);
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    const existingClaims = member.customClaims ?? {};
    const nextClaims = input.roles === undefined ? existingClaims : { ...existingClaims, adminRoles: input.roles };
    if (input.disabled !== undefined) await adminAuth.updateUser(input.memberId, { disabled: input.disabled });
    if (input.roles !== undefined) await adminAuth.setCustomUserClaims(input.memberId, nextClaims);
    await adminAuth.revokeRefreshTokens(input.memberId);
    await adminDb.collection("users").doc(input.memberId).set({ accessDisabled: input.disabled ?? member.disabled, adminRoles: input.roles ?? existingClaims.adminRoles ?? [], accessUpdatedAt: now }, { merge: true });
    await audit.set({ id: audit.id, actorId: admin.user.uid, actorRoles: admin.roles, action: "member-access-updated", targetType: "member", targetId: input.memberId, before: { disabled: member.disabled, roles: existingClaims.adminRoles ?? [] }, after: { disabled: input.disabled ?? member.disabled, roles: input.roles ?? existingClaims.adminRoles ?? [] }, reason: input.reason, outcome: "completed", createdAt: now, schemaVersion: 1 });
    return NextResponse.json({ ok: true });
  }

  const user = await adminAuth.getUser(input.memberId).catch(() => null);
  if (!user || user.disabled) return NextResponse.json({ error: "An active member is required for a reminder." }, { status: 404 });
  const notification = adminDb.collection("notifications").doc();
  await notification.create({ id: notification.id, ownerId: input.memberId, category: "service", title: input.title, message: input.message, href: "/notifications", readAt: null, createdAt: now, schemaVersion: 1 });
  await audit.set({ id: audit.id, actorId: admin.user.uid, actorRoles: admin.roles, action: "member-reminder-sent", targetType: "member", targetId: input.memberId, before: null, after: { notificationId: notification.id, delivery: "in_app" }, reason: "Administrator sent an in-app operational reminder.", outcome: "completed", createdAt: now, schemaVersion: 1 });
  return NextResponse.json({ ok: true });
}
