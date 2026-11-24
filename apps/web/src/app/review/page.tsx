import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ResumeReview } from "@/components/resume-review";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";

export const metadata: Metadata = {
  title: "Resume Checker",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await getSessionUser(); if (!user) redirect("/login?returnTo=/review");
  const consent = await adminDb.collection("registration_consents").doc(user.uid).get();
  return <AppShell><ResumeReview externalAiConsentAccepted={consent.data()?.externalAiDataUseAccepted === true} /></AppShell>;
}
