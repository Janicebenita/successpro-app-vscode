import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canonicalProfileSchema } from "@successpro/contracts";
import { createLinkedInMakeover } from "@successpro/domain";
import { AppShell } from "@/components/app-shell";
import { LinkedInMakeover } from "@/components/linkedin-makeover";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "LinkedIn profile makeover",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function LinkedInPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?returnTo=/linkedin");
  const snapshot = await adminDb.collection("profiles").doc(user.uid).get();
  const profile = canonicalProfileSchema.safeParse(snapshot.data());
  if (!profile.success) redirect("/review?setup=profile&next=/linkedin");
  return <AppShell><LinkedInMakeover result={createLinkedInMakeover(profile.data)} profile={profile.data} /></AppShell>;
}
