import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { HelpCenter } from "@/components/help-center";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Help center",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function HelpPage() { const user = await getSessionUser({ allowWithdrawn: true }); return user ? <AppShell><HelpCenter signedIn /></AppShell> : <main className="container section"><HelpCenter signedIn={false} /></main>; }
