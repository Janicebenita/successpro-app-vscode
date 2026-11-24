import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NotificationsWorkspace } from "@/components/notifications-workspace";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
}; export const dynamic = "force-dynamic";
export default async function NotificationsPage() { const user = await getSessionUser(); if (!user) redirect("/login?returnTo=/notifications"); const snapshot = await adminDb.collection("notifications").where("ownerId", "==", user.uid).limit(200).get(); const items = snapshot.docs.map((doc) => { const value = doc.data(); return { id: doc.id, category: String(value.category), title: String(value.title), message: String(value.message), href: String(value.href), read: Boolean(value.readAt), createdAt: value.createdAt?.toDate?.()?.toISOString?.() ?? null, createdAtMs: value.createdAt?.toMillis?.() ?? 0 }; }).sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, 100).map((item) => ({ id: item.id, category: item.category, title: item.title, message: item.message, href: item.href, read: item.read, createdAt: item.createdAt })); return <AppShell><NotificationsWorkspace initial={items} /></AppShell>; }
