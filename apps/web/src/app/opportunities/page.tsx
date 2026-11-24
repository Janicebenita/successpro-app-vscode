import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OpportunitiesWorkspace } from "@/components/opportunities-workspace";
import { canonicalProfileSchema, jobPreferencesSchema } from "@successpro/contracts";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { jobSuggestionsFromProfile } from "@/lib/profile-suggestions";

export const metadata: Metadata = {
  title: "Opportunities",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function OpportunitiesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?returnTo=/opportunities");
  const [snapshot, profileSnapshot] = await Promise.all([adminDb.collection("job_preferences").doc(user.uid).get(), adminDb.collection("profiles").doc(user.uid).get()]);
  const saved = jobPreferencesSchema.safeParse(snapshot.data());
  const profile = canonicalProfileSchema.safeParse(profileSnapshot.data());
  const suggested = profile.success ? jobSuggestionsFromProfile(profile.data) : null;
  return <AppShell><OpportunitiesWorkspace initial={saved.success ? saved.data : suggested} inferred={!saved.success && Boolean(suggested)} /></AppShell>;
}
