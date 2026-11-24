import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MessagesWorkspace } from "@/components/messages-workspace";
import { getSessionUser } from "@/lib/session";
import { conversationSummaries } from "@/lib/conversations";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?returnTo=/messages");
  return <AppShell><MessagesWorkspace initialItems={await conversationSummaries(user.uid)} /></AppShell>;
}
