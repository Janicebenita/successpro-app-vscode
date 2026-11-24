import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canonicalProfileSchema } from "@successpro/contracts";
import { AppShell } from "@/components/app-shell";
import { DocumentStudio, type SavedDocumentDraft } from "@/components/document-studio";
import { documentDraftSchema } from "@/lib/document-draft";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Resume and cover letter studio",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?returnTo=/documents");
  const [snapshot, draftSnapshot] = await Promise.all([adminDb.collection("profiles").doc(user.uid).get(), adminDb.collection("document_drafts").doc(user.uid).get()]);
  const profile = canonicalProfileSchema.safeParse(snapshot.data());
  if (!profile.success) redirect("/review?setup=profile&next=/documents");
  // Firestore metadata includes Timestamp instances. Validate and strip them
  // before crossing the Server Component → Client Component boundary.
  const savedDraft = draftSnapshot.exists ? documentDraftSchema.safeParse(draftSnapshot.data()) : null;
  return <AppShell><DocumentStudio profile={profile.data} email={user.email ?? ""} initialDraft={savedDraft?.success ? savedDraft.data as SavedDocumentDraft : null} /></AppShell>;
}
