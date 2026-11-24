import { FieldValue } from "firebase-admin/firestore";
import { canonicalProfileSchema, jobPreferencesSchema } from "@successpro/contracts";
import { adminDb } from "@/lib/firebase-admin";
import { locationMatches } from "@/lib/geography";
import { currentJobs } from "./ingestion";
import { postedWithinDays } from "./connectors";
import { createNotification } from "@/lib/notifications";
import { recordProductEvent } from "@/lib/product-telemetry";
import { jobSuggestionsFromProfile } from "@/lib/profile-suggestions";

export async function buildDailyJobFeeds() {
  const [profiles, externalJobs, recruiterSnapshot] = await Promise.all([adminDb.collection("profiles").limit(1_000).get(), currentJobs(1_000), adminDb.collection("recruiter_jobs").where("status", "==", "active").limit(500).get()]);
  const today = new Date().toISOString().slice(0, 10);
  const recruiterJobs = recruiterSnapshot.docs.map((doc) => ({ ...doc.data(), id: `recruiter:${doc.id}` } as Record<string, unknown> & { id: string })).filter((job) => postedWithinDays(String(job.publishedOn ?? ""))).map((job) => ({ id: job.id, title: String(job.title ?? ""), employer: String(job.organizationName ?? "Verified employer"), location: String(job.location ?? ""), workMode: String(job.workMode ?? "unknown"), description: String(job.description ?? ""), canonicalUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/jobs`, sourceName: "SuccessPro verified recruiter", lastSeenOn: today }));
  const jobs = [...externalJobs, ...recruiterJobs];
  let saved = 0;
  for (const doc of profiles.docs) {
    const profile = canonicalProfileSchema.safeParse(doc.data()); if (!profile.success) continue;
    const preferencesSnapshot = await adminDb.collection("job_preferences").doc(doc.id).get();
    const savedPreferences = jobPreferencesSchema.safeParse(preferencesSnapshot.data());
    const preferences = savedPreferences.success ? savedPreferences.data : jobSuggestionsFromProfile(profile.data);
    if (!preferences.roleTitles.length) continue;
    const ranked = jobs.map((job) => { const text = `${job.title} ${job.description}`.toLowerCase(); const title = job.title.toLowerCase(); const roleHits = preferences.roleTitles.filter((role) => title.includes(role.toLowerCase())).length; const roleTokens = [...new Set(preferences.roleTitles.flatMap((role) => role.toLowerCase().split(/[^\p{L}\p{N}]+/u)).filter((term) => term.length >= 4 && !["senior", "junior", "lead", "head", "manager", "director", "chief"].includes(term)))]; const relatedRoleHits = roleTokens.filter((term) => title.includes(term)).length; const keywordHits = preferences.keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length; const locationFit = job.workMode === "remote" && /^remote\s*$/i.test(job.location) ? "close" : locationMatches(job.location, preferences.locations); const score = !roleHits && !relatedRoleHits && keywordHits < 2 ? 0 : roleHits * 10 + relatedRoleHits * 3 + keywordHits * 2 + (locationFit === "preferred" ? 4 : locationFit === "close" ? 2 : 0); return { id: job.id, title: job.title, employer: job.employer, location: job.location, workMode: job.workMode, canonicalUrl: job.canonicalUrl, sourceName: job.sourceName, lastSeenOn: job.lastSeenOn, locationFit, score }; }).filter((job) => job.score > 0 && job.locationFit !== "outside").sort((a, b) => b.score - a.score).slice(0, 20);
    await adminDb.collection("daily_job_feeds").doc(doc.id).set({ ownerId: doc.id, generatedAt: FieldValue.serverTimestamp(), preferenceVersion: savedPreferences.success ? 1 : 0, jobs: ranked, schemaVersion: 1 });
    if (ranked.length) await createNotification({ ownerId: doc.id, category: "jobs", title: `${ranked.length} job matches are ready`, message: "Your daily feed has new preferred or close-location matches.", href: "/opportunities", dedupeKey: `jobs-${doc.id}-${new Date().toISOString().slice(0, 10)}` }).catch(() => undefined);
    saved += 1;
  }
  await recordProductEvent({ name: "job_feed_generated", outcome: saved ? "success" : "empty", count: saved, source: "scheduled" }).catch(() => undefined);
  return { feedsSaved: saved, currentJobs: jobs.length };
}
