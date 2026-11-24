import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canonicalProfileSchema, careerGoalSchema } from "@successpro/contracts";
import { AppShell } from "@/components/app-shell";
import { SalaryWorkspace } from "@/components/salary-workspace";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Salary benchmarking",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function SalaryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?returnTo=/salary");
  const [research, profile, goal] = await Promise.all([
    adminDb.collection("salary_research").doc(user.uid).get(),
    adminDb.collection("profiles").doc(user.uid).get(),
    adminDb.collection("career_goals").doc(user.uid).get(),
  ]);
  const parsedProfile = canonicalProfileSchema.safeParse(profile.data());
  const parsedGoal = careerGoalSchema.safeParse(goal.data());
  return <AppShell><SalaryWorkspace initial={research.exists ? research.data() : null} profile={parsedProfile.success ? parsedProfile.data : null} goal={parsedGoal.success ? parsedGoal.data : null} /></AppShell>;
}
