import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CareerPortrait } from "@/components/career-portrait";
import { listReviews } from "@/lib/review-storage";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { canonicalProfileSchema } from "@successpro/contracts";
import { resolveUserEntitlements } from "@/lib/feature-entitlements";
import { adminRolesFor } from "@/lib/admin-access";
import { SubscribedBanner } from "@/components/subscribed-banner";

export const metadata: Metadata = {
  title: "Career workspace",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function monthKey() {
  const date = new Date();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const user = await getSessionUser();
  if (!user) redirect("/login?returnTo=/dashboard");
  const [profileSnapshot, allowanceSnapshot, analysisSnapshot, goalSnapshot, jobFeedSnapshot, access] = await Promise.all([
    adminDb.collection("profiles").doc(user.uid).get(),
    adminDb.collection("usage_allowances").doc(`${user.uid}_${monthKey()}_ats`).get(),
    listReviews(user.uid),
    adminDb.collection("career_goals").doc(user.uid).get(),
    adminDb.collection("daily_job_feeds").doc(user.uid).get(),
    resolveUserEntitlements(user.uid),
  ]);
  const storedProfile = profileSnapshot.data();
  const parsedProfile = canonicalProfileSchema.safeParse(storedProfile);
  const profile = parsedProfile.success ? parsedProfile.data : storedProfile;
  const goal = goalSnapshot.data();
  const dailyJobs = (jobFeedSnapshot.data()?.jobs ?? []) as Array<{ id: string; title: string; employer: string; location: string; canonicalUrl: string; locationFit: "preferred" | "close"; sourceName: string }>;
  const analyses = analysisSnapshot;
  const latest = analyses[0];
  const used = allowanceSnapshot.data()?.completed ?? 0;
  const firstName = (profile?.fullName ?? user.name ?? "there").split(" ")[0];
  const profileSignals = [profile?.headline, profile?.summary, profile?.skills?.length, profile?.targetRoles?.length, profile?.location].filter(Boolean).length;
  const strength = Math.round((profileSignals / 5) * 100);
  const adminAccess = adminRolesFor(user).length > 0;

  return <AppShell adminAccess={adminAccess}>
    {params.subscribed === "1" && access.planId !== "free" && !access.testAccess && <SubscribedBanner activeUntil={access.activeUntil} />}
    <section className="welcome"><div><span className="status-pill">PROFILE {strength}% COMPLETE</span><h2>Good to see you, {firstName}.</h2><p>{profile ? "Your career profile helps personalize the tools in your workspace." : "Add your career details to get more useful guidance."}</p></div><Link className="button button-dark" href="/review">Open Resume Checker</Link></section>
    <section className="metric-grid" aria-label="Career metrics">
      <article className="metric-card"><span>Latest resume score</span><strong>{latest?.result?.score ?? " - "}{latest ? " / 100" : ""}</strong><small>{latest ? "Your latest SuccessPro review" : "Review your first resume"}</small></article>
      <article className="metric-card"><span>Profile strength</span><strong>{strength}%</strong><small>{profile ? `${profile.skills?.length ?? 0} confirmed skills` : "Profile setup required"}</small></article>
      <article className="metric-card"><span>Monthly reviews</span><strong>{used}{` of ${access.entitlements.atsReviewsPerMonth}`}</strong><small>Completed reviews only</small></article>
    </section>
    {parsedProfile.success && <CareerPortrait profile={parsedProfile.data} premium={access.planId !== "free"} publicProfileId={storedProfile?.publicProfileEnabled ? storedProfile.publicProfileId : undefined} />}
    <section className="dashboard-command-grid">
      <article className="dashboard-focus-card"><span className="section-kicker">YOUR FOCUS</span><h3>{goal?.targetRole || profile?.targetRoles?.[0] || "Shape the next chapter"}</h3><p>{goal?.targetDate ? `Target date: ${goal.targetDate}` : "Set a goal and SuccessPro will keep your next practical step in view."}</p><Link href="/goals">{goal ? "Review my plan" : "Set my career goal"}</Link></article>
      <article className="dashboard-steps-card"><span className="section-kicker">NEXT, SIMPLIFIED</span><div className="dashboard-steps"><Link href={profile ? "/profile" : "/review?setup=profile&next=/dashboard"}><i>01</i><span>{profile ? "Refine profile" : "Add your resume"}</span></Link><Link href="/review"><i>02</i><span>Review resume</span></Link><Link href="/documents"><i>03</i><span>Create documents</span></Link></div></article>
      <article className="dashboard-feed-card"><div><span className="section-kicker">OPPORTUNITIES</span><h3>{dailyJobs.length ? "New roles for you" : "Set your job preferences"}</h3></div>{dailyJobs.length ? <div className="dashboard-feed-list">{dailyJobs.slice(0, 3).map((job) => <a href={job.canonicalUrl} target="_blank" rel="noreferrer" key={job.id}><strong>{job.title}</strong><span>{job.employer} · {job.location}</span></a>)}</div> : <p>Choose roles and locations to receive a focused daily shortlist.</p>}<Link href="/opportunities">Explore opportunities</Link></article>
      <article className="dashboard-review-card"><span className="section-kicker">RESUME CHECKER</span><strong>{latest ? latest.result.score === null ? "Score Pending" : `${latest.result.score}/100` : "Ready when you are"}</strong><p>{latest ? "Your latest review is saved securely." : "Get clear feedback, grounded in your resume, on what to improve."}</p><Link href="/review">{latest ? "Open latest review" : "Check my resume"}</Link></article>
    </section>
  </AppShell>;
}
