import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canonicalProfileSchema, careerGoalSchema } from "@successpro/contracts";
import { AppShell } from "@/components/app-shell";
import { LearningWorkspace } from "@/components/learning-workspace";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { activeCourseCatalog } from "@/lib/courses";

export const metadata: Metadata = {
  title: "Learning recommendations",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?returnTo=/learning");
  const [profileSnapshot, goalSnapshot] = await Promise.all([adminDb.collection("profiles").doc(user.uid).get(), adminDb.collection("career_goals").doc(user.uid).get()]);
  const profile = canonicalProfileSchema.safeParse(profileSnapshot.data());
  if (!profile.success) redirect("/review?setup=profile&next=/learning");
  const goal = careerGoalSchema.safeParse(goalSnapshot.data());
  const courses = await activeCourseCatalog();
  return <AppShell><LearningWorkspace profile={profile.data} goal={goal.success ? goal.data : null} courses={courses} /></AppShell>;
}
