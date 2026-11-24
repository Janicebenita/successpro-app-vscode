import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { CanonicalProfile } from "@successpro/contracts";
import { extractCanonicalProfile, reconcileExtractedProfile } from "@successpro/domain";
import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/profile-form";
import { ProfileStart } from "@/components/profile-start";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "My profile",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?returnTo=/profile");
  const query = await searchParams;
  const rawNext = typeof query.next === "string" ? query.next : "/dashboard";
  const nextPath = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const manual = query.manual === "1";
  const fromResume = query.from === "resume";
  const [snapshot, resumeSnapshot] = await Promise.all([
    adminDb.collection("profiles").doc(user.uid).get(),
    adminDb.collection("resumes").doc(user.uid).get(),
  ]);
  const raw = snapshot.exists ? snapshot.data() : null;
  const latestVersionId = resumeSnapshot.data()?.latestVersionId;
  const latestVersion = latestVersionId ? await adminDb.collection("resume_versions").doc(latestVersionId).get() : null;
  const versionData = latestVersion?.data();
  const storedDraft = versionData?.profileDraft as Partial<CanonicalProfile> | undefined;
  const resumeDraft = typeof versionData?.extractedText === "string" && versionData?.profileDraftStatus !== "transformed-pending-user-review" ? reconcileExtractedProfile(extractCanonicalProfile(versionData.extractedText).draft, storedDraft ?? {}) : storedDraft;
  if (!raw && !resumeDraft && !manual) return <AppShell><ProfileStart nextPath={nextPath} /></AppShell>;
  const draftApplied = !!resumeDraft && (!raw || fromResume);
  const storedProfile = raw ? {
    fullName: raw.fullName,
    headline: raw.headline,
    location: raw.location,
    summary: raw.summary,
    currentRole: raw.currentRole,
    industry: raw.industry,
    skills: raw.skills,
    experience: raw.experience,
    education: raw.education,
    projects: raw.projects ?? [],
    certifications: raw.certifications ?? [],
    awards: raw.awards ?? [],
    publications: raw.publications ?? [],
    volunteerExperience: raw.volunteerExperience ?? [],
    languages: raw.languages ?? [],
    preferredLanguage: raw.preferredLanguage ?? "en",
    links: raw.links ?? [],
    targetRoles: raw.targetRoles,
    openToWork: raw.openToWork,
    publicProfileEnabled: raw.publicProfileEnabled,
    publicProfileVisibility: raw.publicProfileVisibility ?? { summary: true, location: true, currentRole: true, industry: true, skills: true, experience: true, education: true },
    searchEngineIndexable: raw.searchEngineIndexable ?? false,
  } satisfies Partial<CanonicalProfile> : null;
  const initial = storedProfile ? fromResume && resumeDraft ? { ...storedProfile, ...resumeDraft, fullName: resumeDraft.fullName || storedProfile.fullName || user.name || "", openToWork: storedProfile.openToWork, publicProfileEnabled: storedProfile.publicProfileEnabled, publicProfileVisibility: storedProfile.publicProfileVisibility, searchEngineIndexable: storedProfile.searchEngineIndexable } : storedProfile : resumeDraft ? { ...resumeDraft, fullName: resumeDraft.fullName || user.name || "" } : { fullName: user.name ?? "" };
  const publicProfileId = raw?.publicProfileEnabled ? raw.publicProfileId as string | undefined : undefined;
  return <AppShell><ProfileForm initial={initial} resumeDraft={resumeDraft ?? null} resumeDraftName={versionData?.originalName ?? null} resumeDraftWarnings={versionData?.profileDraftQuestionsReviewed !== true && Array.isArray(versionData?.profileDraftWarnings) ? versionData.profileDraftWarnings.filter((item: unknown): item is string => typeof item === "string") : []} initialReviewAnswers={Array.isArray(versionData?.profileDraftReviewAnswers) ? versionData.profileDraftReviewAnswers.filter((item: unknown): item is string => typeof item === "string") : []} publicProfileId={publicProfileId ?? null} draftApplied={draftApplied} resumeDraftTransformed={versionData?.profileDraftStatus === "transformed-pending-user-review"} nextPath={nextPath} /></AppShell>;
}
