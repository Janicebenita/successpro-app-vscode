import Link from "next/link";
import { canonicalProfileSchema } from "@successpro/contracts";
import { buildCareerMilestones } from "@/lib/career-visualization";

export function PublicPortrait({ profile, premium }: { profile: Record<string, unknown>; premium: boolean }) {
  // Only the published projection is passed here. Private profile fields must
  // never be fetched to fill gaps in a public portrait.
  const parsed = canonicalProfileSchema.safeParse({ ...profile, targetRoles: [] });
  const milestones = parsed.success ? buildCareerMilestones(parsed.data) : [];
  return <section className={`public-story public-story-${premium ? "signature" : "essential"}`} aria-label="Career highlights">
    <span className="public-story-kicker">THE EXPERIENCE BEHIND THE PERSON</span>
    <h2>A career with a story.</h2>
    {milestones.length > 0 && <ol className="public-story-road">{milestones.map((item) => <li key={item.id}><span>{item.kind === "role" ? "Experience" : "Education"}</span><h3>{item.label}</h3><p>{item.detail}</p><time>{item.date}</time></li>)}</ol>}
    <div className="public-story-invite"><p>Your experience deserves a place of its own.</p><Link className="button button-dark" href="/signup">Create your career profile ↗</Link></div>
  </section>;
}
