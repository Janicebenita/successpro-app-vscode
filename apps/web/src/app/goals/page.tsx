import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canonicalProfileSchema } from "@successpro/contracts";
import { AppShell } from "@/components/app-shell";
import { GoalsWorkspace } from "@/components/goals-workspace";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Career goals",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function GoalsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?returnTo=/goals");
  const [snapshot, profileSnapshot] = await Promise.all([adminDb.collection("career_goals").doc(user.uid).get(), adminDb.collection("profiles").doc(user.uid).get()]);
  const profile = canonicalProfileSchema.safeParse(profileSnapshot.data());
  return <AppShell><GoalsWorkspace initial={snapshot.exists ? snapshot.data() : null} profile={profile.success ? profile.data : null} /></AppShell>;
}
