/* eslint-disable @next/next/no-img-element -- this member-controlled public image uses an authorization-aware route. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { PublicContact } from "@/components/public-contact";
import { PublicShareActions } from "@/components/public-share-actions";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { resolveUserEntitlements } from "@/lib/feature-entitlements";
import { PublicPortrait } from "@/components/public-portrait";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ contact?: string }> };

async function readPublicProfile(id: string) {
  if (!/^sp-[a-f0-9]{16}$/.test(id)) return null;
  const snapshot = await adminDb.collection("public_profiles").doc(id).get();
  const data = snapshot.data();
  return snapshot.exists && data?.published ? data : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const profile = await readPublicProfile(id);
  if (!profile) return { title: "Profile unavailable", robots: { index: false, follow: false } };
  const base = process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://successpro.ai";
  const url = new URL(`/p/${id}`, base).href;
  const image = new URL(`/api/public-profiles/${id}/image?preview=1`, base).href;
  const title = `${profile.fullName} · ${profile.headline}`;
  const description = profile.summary || `${profile.fullName}'s professional profile on SuccessPro.`;
  return { title, description, alternates: { canonical: url }, openGraph: { type: "profile", url, title, description, siteName: "SuccessPro", images: [{ url: image, width: 1200, height: 630, alt: `${profile.fullName}'s career snapshot` }] }, twitter: { card: "summary_large_image", title, description, images: [image] }, robots: { index: profile.searchEngineIndexable === true, follow: profile.searchEngineIndexable === true } };
}

export default async function PublicProfilePage({ params, searchParams }: Props) {
  const { id } = await params;
  const profile = await readPublicProfile(id);
  if (!profile) notFound();
  const [user, query, ownerAccess] = await Promise.all([getSessionUser(), searchParams, resolveUserEntitlements(profile.ownerId)]);
  const initials = String(profile.fullName).split(" ").map((part) => part[0]).slice(0, 2).join("");
  const returnTo = `/p/${id}?contact=1`;
  return <main className={`public-profile-page public-edition-${ownerAccess.planId !== "free" ? "signature" : "essential"}`}><header className="public-profile-header"><Brand /><Link className="button button-secondary" href="/">About SuccessPro</Link></header><div className="public-profile-wrap"><section className="public-profile-hero"><div className="public-profile-avatar">{profile.photoPublic === true ? <img src={`/api/public-profiles/${id}/photo`} alt={`${profile.fullName}'s profile photograph`} /> : initials}</div><div><div className="public-profile-badges"><span className="status-pill">SUCCESSPRO PROFILE</span>{profile.openToWork && <span className="open-badge">OPEN TO WORK</span>}</div><h1>{profile.fullName}</h1><p className="public-headline">{profile.headline}</p><p>{[profile.currentRole, profile.industry, profile.location].filter(Boolean).join(" · ")}</p></div></section><PublicPortrait profile={profile} premium={ownerAccess.planId !== "free"} /><div className="public-profile-grid"><div className="public-profile-main">{profile.summary && <section className="public-section"><h2>About</h2><p>{profile.summary}</p></section>}{profile.experience?.length > 0 && <section className="public-section"><h2>Experience</h2><div className="public-timeline">{profile.experience.map((item: { id: string; title: string; employer: string; startDate: string; endDate: string; achievements: string[] }) => <article key={item.id}><span className="timeline-dot" /><div><h3>{item.title}</h3><strong>{item.employer}</strong><small>{[item.startDate, item.endDate].filter(Boolean).join(" – ")}</small>{item.achievements?.slice(0, 4).map((achievement) => <p key={achievement}>{achievement}</p>)}</div></article>)}</div></section>}{profile.education?.length > 0 && <section className="public-section"><h2>Education</h2>{profile.education.map((item: { id: string; qualification: string; institution: string; startDate: string; endDate: string }) => <article className="public-education" key={item.id}><h3>{item.qualification}</h3><strong>{item.institution}</strong><small>{[item.startDate, item.endDate].filter(Boolean).join(" – ")}</small></article>)}</section>}</div><aside className="public-profile-aside"><section className="public-section"><h2>Skills</h2><div className="skill-cloud">{(profile.skills ?? []).slice(0, 20).map((skill: string) => <span key={skill}>{skill}</span>)}</div></section><PublicShareActions name={profile.fullName} /><a className="button button-dark full" href={`/api/public-profiles/${id}/image`}>Download landscape image</a><a className="button button-secondary full" href={`/api/public-profiles/${id}/image?format=portrait`}>Download portrait image</a>{profile.openToWork && (user ? <PublicContact publicProfileId={id} /> : <div className="public-contact"><h2>Send a message</h2><p>Sign in or create an account to contact this member. Everyone’s contact details stay private.</p><Link className="button button-primary full" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in to send a message</Link>{query.contact && <p className="save-status">You’ll return to this profile after signing in.</p>}</div>)}</aside></div></div></main>;
}
