import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeedWorkspace } from "@/components/feed-workspace";
import { feedForUser } from "@/lib/feed-service";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Professional feed",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function FeedPage() { const user = await getSessionUser(); if (!user) redirect("/login?returnTo=/feed"); return <AppShell><FeedWorkspace initialEvents={await feedForUser(user.uid)} viewerId={user.uid} /></AppShell>; }
