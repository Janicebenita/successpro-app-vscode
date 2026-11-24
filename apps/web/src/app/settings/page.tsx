import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AccountPrivacyControls } from "@/components/account-privacy-controls";
import { GoogleAccountLink } from "@/components/google-account-link";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { NotificationPreferences } from "@/components/notification-preferences";
import { ExternalAiConsent } from "@/components/external-ai-consent";
import { normalizeNotificationPreferences } from "@/lib/notifications";
import { TrackingChoices } from "@/components/consent-aware-tracking";

export const metadata: Metadata = {
  title: "Privacy and account settings",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser({ allowWithdrawn: true }); if (!user) redirect("/login?returnTo=/settings");
  const [consent, settings] = await Promise.all([adminDb.collection("registration_consents").doc(user.uid).get(), adminDb.collection("user_settings").doc(user.uid).get()]); const value = consent.data();
  const withdrawn = value?.automatedCareerProcessingAccepted === false;
  return <AppShell><section className="work-card profile-intro"><div><span className="status-pill">PRIVACY & ACCOUNT</span><h2>Your information and choices</h2><p>Download the career and account information held in your private workspace.</p></div><a className="button button-primary" href="/api/account/export">Download my data</a></section><section className="profile-grid"><article className="work-card"><h3>Registration record</h3>{consent.exists ? <div className="privacy-record"><span>Terms version</span><strong>{String(value?.termsVersion ?? "Recorded")}</strong><span>Privacy version</span><strong>{String(value?.privacyVersion ?? "Recorded")}</strong><span>Automated career processing</span><strong>{withdrawn ? "Withdrawn" : "Accepted"}</strong><span>External AI data use</span><strong>{value?.externalAiDataUseAccepted === true ? "Accepted" : "Not accepted"}</strong></div> : <p>No versioned registration record was found for this legacy account.</p>}<ExternalAiConsent accepted={value?.externalAiDataUseAccepted === true} /></article><article className="work-card"><h3>What the export contains</h3><ul className="plain-list"><li>Your profile, resume metadata and extracted versions</li><li>Reviews, goals, preferences and saved planning data</li><li>Messages, reports, usage records and document drafts</li><li>Consent, AI-run metadata and writing-service order records</li></ul><p className="document-note">Original uploaded files are not embedded in the JSON file. Payment and safety records may have separate retention requirements and are anonymized when the account is deleted.</p></article><article className="work-card"><h3>Analytics and advertising choices</h3><p>Optional tracking is off unless you allow it. You can change your choice at any time.</p><TrackingChoices /></article><GoogleAccountLink /><NotificationPreferences initial={normalizeNotificationPreferences(settings.data()?.notificationPreferences)} /></section><AccountPrivacyControls withdrawn={withdrawn} /></AppShell>;
}
