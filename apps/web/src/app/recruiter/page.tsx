import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PartnerShell } from "@/components/partner-shell";
import { RecruiterConsole } from "@/components/recruiter-console";
import { RecruiterJobsManager, type RecruiterManagedJob } from "@/components/recruiter-jobs-manager";
import { getSessionUser } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";

export const metadata: Metadata = {
  title: "Recruiter workspace",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function RecruiterPage() { const user = await getSessionUser(); if (!user) redirect("/recruiter/login?returnTo=/recruiter"); const snapshot = await adminDb.collection("recruiter_accounts").doc(user.uid).get(); const value = snapshot.data() ?? {}; const account = snapshot.exists ? { organizationName: String(value.organizationName ?? ""), organizationWebsite: String(value.organizationWebsite ?? ""), workEmail: String(value.workEmail ?? ""), recruiterTitle: String(value.recruiterTitle ?? ""), registrationJurisdiction: String(value.registrationJurisdiction ?? ""), registrationNumber: String(value.registrationNumber ?? ""), hiringPurpose: String(value.hiringPurpose ?? ""), dueDiligenceStatus: String(value.dueDiligenceStatus ?? ""), recruiterEnabled: Boolean(value.recruiterEnabled), decisionReason: String(value.decisionReason ?? "") } : null; let jobs: RecruiterManagedJob[] = []; if (account?.recruiterEnabled) { const jobSnapshot = await adminDb.collection("recruiter_jobs").where("recruiterId", "==", user.uid).limit(200).get(); jobs = jobSnapshot.docs.map((doc) => { const job = doc.data(); return { id: doc.id, title: String(job.title ?? ""), location: String(job.location ?? ""), status: String(job.status ?? "active"), publishedOn: String(job.publishedOn ?? "") }; }); } return <PartnerShell kind="recruiter"><RecruiterConsole initialAccount={account} initialJobs={jobs} /><RecruiterJobsManager initialJobs={jobs} /></PartnerShell>; }
