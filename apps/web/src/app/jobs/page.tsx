import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RecruiterJobBoard, type RecruiterBoardJob } from "@/components/recruiter-job-board";
import { getSessionUser } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";

export const metadata: Metadata = {
  title: "Recruiter jobs",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function JobsPage() { if (!await getSessionUser()) redirect("/login?returnTo=/jobs"); const snapshot = await adminDb.collection("recruiter_jobs").where("status", "==", "active").limit(100).get(); const jobs: RecruiterBoardJob[] = snapshot.docs.map((doc) => { const value = doc.data(); return { id: doc.id, title: String(value.title ?? ""), department: String(value.department ?? ""), location: String(value.location ?? ""), organizationName: String(value.organizationName ?? "Verified employer"), workMode: String(value.workMode ?? ""), employmentType: String(value.employmentType ?? ""), experienceMinimum: Number(value.experienceMinimum ?? 0), experienceMaximum: Number(value.experienceMaximum ?? 0), ctcMinimum: Number(value.ctcMinimum ?? 0), ctcMaximum: Number(value.ctcMaximum ?? 0), currency: String(value.currency ?? "INR"), description: String(value.description ?? ""), skills: Array.isArray(value.skills) ? value.skills.map(String) : [], publishedOn: String(value.publishedOn ?? "") }; }); return <AppShell><RecruiterJobBoard initialJobs={jobs} /></AppShell>; }
