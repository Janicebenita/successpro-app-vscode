import { NextResponse } from "next/server";
import { canonicalProfileSchema, jobPreferencesSchema } from "@successpro/contracts";
import { adminDb } from "@/lib/firebase-admin";
import { runAiTask } from "@/lib/ai/orchestrator";
import { currentJobs } from "@/lib/jobs/ingestion";
import { fetchRegionalJobsForPreferences, postedWithinDays } from "@/lib/jobs/connectors";
import { getSessionUser } from "@/lib/session";
import { locationMatches } from "@/lib/geography";
import { recordProductEvent } from "@/lib/product-telemetry";
import { featureAvailable, resolveUserEntitlements } from "@/lib/feature-entitlements";
import { jobSuggestionsFromProfile } from "@/lib/profile-suggestions";

function score(job: { title: string; description: string; location: string; workMode: string }, roles: string[], locations: string[], skills: string[], workModes: string[], keywords: string[]) {
  const title = job.title.toLowerCase(); const body = job.description.toLowerCase(); const location = job.location.toLowerCase();
  const exactRoleHits = roles.filter((term) => title.includes(term.toLowerCase())).length;
  const roleTokens = [...new Set(roles.flatMap((role) => role.toLowerCase().split(/[^\p{L}\p{N}]+/u)).filter((term) => term.length >= 4 && !["senior", "junior", "lead", "head", "manager", "director", "chief"].includes(term)))];
  const roleTokenHits = roleTokens.filter((term) => title.includes(term)).length;
  const skillHits = [...skills, ...keywords].filter((term) => term.length >= 3 && body.includes(term.toLowerCase())).length;
  if (!exactRoleHits && !roleTokenHits && skillHits < 2) return 0;
  return exactRoleHits * 8 + roleTokenHits * 3 + skillHits * 2 + locations.filter((term) => location.includes(term.toLowerCase())).length * 3 + (workModes.includes(job.workMode) ? 2 : 0);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to view job suggestions." }, { status: 401 });
  if (!featureAvailable(await resolveUserEntitlements(user.uid), "jobSearch")) return NextResponse.json({ error: "Job search is not included in your current plan." }, { status: 403 });
  const [preferenceSnapshot, profileSnapshot, storedJobs, recruiterSnapshot] = await Promise.all([adminDb.collection("job_preferences").doc(user.uid).get(), adminDb.collection("profiles").doc(user.uid).get(), currentJobs(), adminDb.collection("recruiter_jobs").where("status", "==", "active").limit(100).get()]);
  const savedPreferences = jobPreferencesSchema.safeParse(preferenceSnapshot.data());
  const profile = canonicalProfileSchema.safeParse(profileSnapshot.data());
  const preferences = savedPreferences.success ? savedPreferences.data : profile.success ? jobSuggestionsFromProfile(profile.data) : null;
  if (!preferences?.roleTitles.length) return NextResponse.json({ jobs: [], recruiterJobs: [], matches: [], message: "Add a current or target role to your profile to see relevant openings." });
  const regionalJobs = await fetchRegionalJobsForPreferences(preferences).catch(() => []);
  const jobs = [...storedJobs, ...regionalJobs].filter((job, index, all) => all.findIndex((candidate) => candidate.fingerprint === job.fingerprint) === index);
  const skills = profile.success ? profile.data.skills : [];
  const ranked = jobs.map((job) => ({ job, locationFit: job.workMode === "remote" && /^remote\s*$/i.test(job.location) ? "close" as const : locationMatches(job.location, preferences.locations), score: score(job, preferences.roleTitles, preferences.locations, skills, preferences.workModes, preferences.keywords) })).filter((item) => item.score > 0 && item.locationFit !== "outside").sort((a, b) => (a.locationFit === b.locationFit ? b.score - a.score : a.locationFit === "preferred" ? -1 : 1)).slice(0, 30);
  const recruiterCandidates = recruiterSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Record<string, unknown> & { id: string })).filter((job) => postedWithinDays(String(job.publishedOn ?? "")) && job.recruiterId !== user.uid)
    .map((job) => ({ job, locationFit: String(job.workMode).toLowerCase() === "remote" && /^remote\s*$/i.test(String(job.location ?? "")) ? "close" as const : locationMatches(String(job.location ?? ""), preferences.locations), score: score({ title: String(job.title ?? ""), description: String(job.description ?? ""), location: String(job.location ?? ""), workMode: String(job.workMode ?? "") }, preferences.roleTitles, preferences.locations, skills, preferences.workModes, preferences.keywords) }))
    .filter((item) => item.score > 0 && item.locationFit !== "outside").sort((a, b) => b.score - a.score).slice(0, 20);
  if (!ranked.length && !recruiterCandidates.length) { await recordProductEvent({ ownerId: user.uid, name: "job_search_completed", outcome: "empty", count: 0, source: "manual" }).catch(() => undefined); return NextResponse.json({ jobs: [], recruiterJobs: [], matches: [], message: jobs.length || recruiterSnapshot.size ? "No verified listings currently match your profile and location." : "No approved job source has supplied current listings yet." }); }
  const approvedJobs = [...ranked.map(({ job }) => ({ id: job.id, title: job.title, employer: job.employer, location: job.location, description: job.description.slice(0, 1_500), canonicalUrl: job.canonicalUrl, sourceName: job.sourceName, postedOn: job.postedOn, lastSeenOn: job.lastSeenOn, salaryText: job.salaryText })), ...recruiterCandidates.map(({ job }) => ({ id: `recruiter:${job.id}`, title: String(job.title ?? ""), employer: String(job.organizationName ?? "Verified employer"), location: String(job.location ?? ""), description: String(job.description ?? "").slice(0, 1_500), canonicalUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/jobs`, sourceName: "SuccessPro verified recruiter", postedOn: String(job.publishedOn ?? ""), lastSeenOn: new Date().toISOString().slice(0, 10), salaryText: "" }))];
  const profileContext = profile.success ? { headline: profile.data.headline, summary: profile.data.summary.slice(0, 1_000), currentRole: profile.data.currentRole, industry: profile.data.industry, achievements: profile.data.experience.flatMap((role) => role.achievements).slice(0, 12).map((item) => item.slice(0, 300)) } : undefined;
  const assistant = await runAiTask("researchJobs", { roleTitles: preferences.roleTitles, locations: preferences.locations, skills, workModes: preferences.workModes, profileContext, approvedJobs }, { ownerId: user.uid, sensitivity: "personal" }).catch(() => null);
  const selectedIds = new Set(assistant?.meta.validation === "passed" ? assistant.output.matches.map((match) => match.jobId) : approvedJobs.map((job) => job.id));
  const selected = ranked.filter((item) => selectedIds.has(item.job.id));
  const selectedRecruiter = recruiterCandidates.filter((item) => selectedIds.has(`recruiter:${item.job.id}`));
  const total = selected.length + selectedRecruiter.length;
  await recordProductEvent({ ownerId: user.uid, name: "job_search_completed", outcome: total ? "success" : "empty", count: total, source: "manual" }).catch(() => undefined);
  const message = assistant?.meta.validation === "passed"
    ? total ? `Found ${total} profile-relevant listing${total === 1 ? "" : "s"} from current approved sources and verified recruiters.` : "No current approved listing met the profile and location checks. Adjusting preferences can broaden the search."
    : `Showing ${total} basic title, skill and location match${total === 1 ? "" : "es"}. Tailored job analysis is temporarily unavailable; confirm requirements on the source page.`;
  return NextResponse.json({ jobs: selected.map((item) => ({ ...item.job, locationFit: item.locationFit })), recruiterJobs: selectedRecruiter.map(({ job, locationFit }) => ({ id: job.id, title: String(job.title ?? ""), organizationName: String(job.organizationName ?? "Verified employer"), department: String(job.department ?? ""), location: String(job.location ?? ""), workMode: String(job.workMode ?? ""), employmentType: String(job.employmentType ?? ""), experienceMinimum: Number(job.experienceMinimum ?? 0), experienceMaximum: Number(job.experienceMaximum ?? 0), ctcMinimum: Number(job.ctcMinimum ?? 0), ctcMaximum: Number(job.ctcMaximum ?? 0), currency: String(job.currency ?? "INR"), description: String(job.description ?? ""), skills: Array.isArray(job.skills) ? job.skills.map(String) : [], publishedOn: String(job.publishedOn ?? ""), locationFit })), matches: assistant?.meta.validation === "passed" ? assistant.output.matches : [], meta: assistant?.meta ?? null, message }, { headers: { "Cache-Control": "private, no-store" } });
}
