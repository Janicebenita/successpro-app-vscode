import { adminPaymentSummary } from "@/lib/billing-status";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { redirect } from "next/navigation";
import { AdminModerationQueue } from "@/components/admin-moderation-queue";
import { AdminSupportQueue } from "@/components/admin-support-queue";
import { AdminRecruiterQueue } from "@/components/admin-recruiter-queue";
import { AdminMentorQueue } from "@/components/admin-mentor-queue";
import { AdminCourseManager } from "@/components/admin-course-manager";
import { AdminCommandCenter, type AdminMember, type AdminSettings } from "@/components/admin-command-center";
import { courseCatalogEntrySchema } from "@successpro/contracts/learning";
import { requireAdmin } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase-admin";
import { productTelemetrySummary } from "@/lib/product-telemetry";
import { FieldValue } from "firebase-admin/firestore";

export const metadata: Metadata = {
  title: "Admin console",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin(["ops_admin", "support_admin", "mentor_admin", "auditor"]);
  if (!admin) redirect("/dashboard");
  const [snapshot, ticketSnapshot, eventSnapshot, recruiterSnapshot, mentorSnapshot, courseSnapshot, memberSnapshot, profileSnapshot, orderSnapshot, aiRunSnapshot, notificationSnapshot, settingsSnapshot] = await Promise.all([adminDb.collection("moderation_reports").orderBy("createdAt", "desc").limit(100).get(), adminDb.collection("support_tickets").orderBy("createdAt", "desc").limit(100).get(), adminDb.collection("product_events").orderBy("createdAt", "desc").limit(1_000).get(), adminDb.collection("recruiter_accounts").where("dueDiligenceStatus", "==", "pending").limit(100).get(), adminDb.collection("mentor_applications").where("status", "==", "pending").limit(100).get(), adminDb.collection("courses").limit(500).get(), adminDb.collection("users").orderBy("createdAt", "desc").limit(100).get(), adminDb.collection("profiles").limit(1_000).get(), adminDb.collection("addon_orders").orderBy("createdAt", "desc").limit(1_000).get(), adminDb.collection("ai_runs").orderBy("createdAt", "desc").limit(1_000).get(), adminDb.collection("notifications").orderBy("createdAt", "desc").limit(1_000).get(), adminDb.collection("system_config").doc("admin_operational_settings").get()]);
  const reports = snapshot.docs.map((document) => { const value = document.data(); return { id: document.id, category: String(value.category ?? "other"), details: String(value.details ?? ""), status: String(value.status ?? "new"), conversationId: String(value.conversationId ?? ""), createdAt: value.createdAt?.toDate?.()?.toISOString?.() ?? null }; });
  const tickets = ticketSnapshot.docs.map((document) => { const value = document.data(); return { id: document.id, category: String(value.category ?? "other"), subject: String(value.subject ?? "Support request"), description: String(value.description ?? ""), priority: String(value.priority ?? "normal"), status: String(value.status ?? "open"), createdAt: value.createdAt?.toDate?.()?.toISOString?.() ?? null }; });
  const telemetry = productTelemetrySummary(eventSnapshot.docs.map((document) => { const value = document.data(); return { name: value.name, outcome: value.outcome, durationMs: value.durationMs, createdAtMs: value.createdAt?.toMillis?.() ?? 0 }; }));
  const recruiterApplications = recruiterSnapshot.docs.map((document) => { const value = document.data(); return { id: document.id, organizationName: String(value.organizationName ?? ""), organizationWebsite: String(value.organizationWebsite ?? ""), workEmail: String(value.workEmail ?? ""), recruiterTitle: String(value.recruiterTitle ?? ""), registrationJurisdiction: String(value.registrationJurisdiction ?? ""), registrationNumber: String(value.registrationNumber ?? ""), hiringPurpose: String(value.hiringPurpose ?? ""), status: String(value.dueDiligenceStatus ?? "pending"), submittedAt: value.submittedAt?.toDate?.()?.toISOString?.() ?? null }; });
  const mentorApplications = mentorSnapshot.docs.map((document) => { const value = document.data(); return { id: document.id, displayName: String(value.displayName ?? ""), headline: String(value.headline ?? ""), categories: Array.isArray(value.categories) ? value.categories.map(String) : [], skills: Array.isArray(value.skills) ? value.skills.map(String) : [], experienceYears: Number(value.experienceYears ?? 0), mentoringExperience: String(value.mentoringExperience ?? ""), rateAmount: Number(value.rateAmount ?? 0), currency: String(value.currency ?? ""), sessionMinutes: Number(value.sessionMinutes ?? 0) }; });
  const courses = courseSnapshot.docs.flatMap((document) => { const parsed = courseCatalogEntrySchema.safeParse({ id: document.id, ...document.data() }); return parsed.success ? [{ ...parsed.data, active: document.data().active === true }] : []; });
  const settingsData = settingsSnapshot.data() ?? {};
  const adminSettings: AdminSettings = {
    tracking: { googleAnalyticsId: String(settingsData.tracking?.googleAnalyticsId ?? ""), googleTagManagerId: String(settingsData.tracking?.googleTagManagerId ?? ""), googleAdsId: String(settingsData.tracking?.googleAdsId ?? ""), metaPixelId: String(settingsData.tracking?.metaPixelId ?? ""), linkedInInsightTagId: String(settingsData.tracking?.linkedInInsightTagId ?? "") },
    delivery: { emailProvider: String(settingsData.delivery?.emailProvider ?? ""), senderAddress: String(settingsData.delivery?.senderAddress ?? ""), replyToAddress: String(settingsData.delivery?.replyToAddress ?? ""), monthlyOperatingCostInr: Number(settingsData.delivery?.monthlyOperatingCostInr ?? 0), monthlyAiBudgetInr: Number(settingsData.delivery?.monthlyAiBudgetInr ?? 0) },
    payment: adminPaymentSummary(),
  };
  const members: AdminMember[] = memberSnapshot.docs.map((document) => { const value = document.data(); return { id: document.id, email: String(value.email ?? "Member email unavailable"), createdAt: value.createdAt?.toDate?.()?.toISOString?.() ?? null, plan: String(value.planId ?? "free"), disabled: value.accessDisabled === true, roles: Array.isArray(value.adminRoles) ? value.adminRoles.map(String) : [] }; });
  const paidOrders = orderSnapshot.docs.filter((document) => ["paid", "fulfilled", "completed"].includes(String(document.data().state ?? "")));
  const paidRevenueInr = paidOrders.reduce((total, document) => { const value = document.data(); return String(value.currency ?? "").toUpperCase() === "INR" ? total + Number(value.amount ?? 0) / 100 : total; }, 0);
  const summary = { users: memberSnapshot.size, activeProfiles: profileSnapshot.size, paidOrders: paidOrders.length, paidRevenueInr: Math.round(paidRevenueInr), pendingOrders: orderSnapshot.docs.filter((document) => ["created", "pending"].includes(String(document.data().state ?? ""))).length, aiRuns: aiRunSnapshot.size, aiFallbacks: aiRunSnapshot.docs.filter((document) => String(document.data().validation ?? document.data().outcome ?? "") === "fallback").length, aiTokens: aiRunSnapshot.docs.reduce((total, document) => total + Math.max(0, Number(document.data().inputTokens ?? 0)) + Math.max(0, Number(document.data().outputTokens ?? 0)), 0), notifications: notificationSnapshot.size };
  const accessAudit = adminDb.collection("admin_audit_events").doc();
  await accessAudit.create({ id: accessAudit.id, actorId: admin.user.uid, actorRoles: admin.roles, action: "admin-operations-queue-viewed", targetType: "admin_console", targetId: "operations-queues", before: null, after: { moderationReportCount: reports.length, supportTicketCount: tickets.length, recruiterApplicationCount: recruiterApplications.length, mentorApplicationCount: mentorApplications.length, privateConversationContentIncluded: false }, reason: "Authorized operational queue review under least-privilege support and safety policy.", outcome: "completed", createdAt: FieldValue.serverTimestamp(), schemaVersion: 1 });
  return (
    <AppShell admin>
      <section className="welcome"><div><span className="status-pill">AUTHORIZED ADMIN</span><h2>Operations overview</h2><p>Review member-submitted safety reports without opening private conversation content.</p></div><span className="quota-badge">{admin.roles.join(", ")}</span></section>
      <section className="metric-grid"><article className="metric-card"><span>Service status</span><strong>Online</strong><small>Staging service is available</small></article><article className="metric-card"><span>Safety reports</span><strong>{reports.filter((report) => report.status === "new" || report.status === "reviewing").length}</strong><small>Awaiting review</small></article><article className="metric-card"><span>Support requests</span><strong>{tickets.filter((ticket) => ticket.status !== "resolved").length}</strong><small>Awaiting human action</small></article></section>
      <section className="metric-grid"><article className="metric-card"><span>Resume uploads · 24h</span><strong>{telemetry.uploads}</strong><small>{telemetry.reviews} completed checks</small></article><article className="metric-card"><span>Job searches · 24h</span><strong>{telemetry.jobSearches}</strong><small>{telemetry.paymentEvents} payment events</small></article><article className="metric-card"><span>AI fallback · 24h</span><strong>{telemetry.aiFallbacks}/{telemetry.aiRuns}</strong><small>{telemetry.medianLatencyMs === null ? "No latency sample" : `${telemetry.medianLatencyMs} ms median event latency`}</small></article></section>
      <AdminCommandCenter members={members} settings={adminSettings} summary={summary} />
      <section className="workspace-grid">
        <AdminModerationQueue initialReports={reports} />
        <AdminSupportQueue initialTickets={tickets} />
        <AdminRecruiterQueue initialApplications={recruiterApplications} canDecide={admin.roles.some((role) => role === "super_admin" || role === "ops_admin")} />
        <AdminMentorQueue initialApplications={mentorApplications} canDecide={admin.roles.some((role) => role === "super_admin" || role === "ops_admin" || role === "mentor_admin")} />
        <AdminCourseManager initialCourses={courses} canManage={admin.roles.some((role) => role === "super_admin" || role === "ops_admin" || role === "content_admin")} />
        <article className="work-card"><h3>Protecting member privacy</h3><p>Support team members will see only the information needed to resolve an issue. Access to private resume content will require a recorded reason.</p><p className="status-pill">LIMITED ACCESS</p></article>
      </section>
    </AppShell>
  );
}
