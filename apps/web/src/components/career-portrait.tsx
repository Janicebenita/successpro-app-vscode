/* eslint-disable @next/next/no-img-element -- the private, authenticated profile-photo route cannot be optimized by Next Image. */
import Link from "next/link";
import { PublicShareActions } from "./public-share-actions";
import type { CanonicalProfile } from "@successpro/contracts";
import { buildCareerMilestones, detectCareerRegions, industryTheme, roleSignature } from "@/lib/career-visualization";

const kindLabels = { role: "Role", education: "Education", credential: "Credential", recognition: "Recognition", achievement: "Career achievement" };
const kindMarks = { role: "●", education: "◇", credential: "✓", recognition: "✦", achievement: "↗" };

export function CareerPortrait({ profile, publicProfileId, premium = false }: { profile: CanonicalProfile; publicProfileId?: string; premium?: boolean }) {
  const regions = detectCareerRegions(profile);
  const milestones = buildCareerMilestones(profile);
  const theme = industryTheme(profile.industry || `${profile.headline} ${profile.currentRole}`);
  const signature = roleSignature(profile.currentRole || profile.headline);
  const themeLabels = { technology: "Technology & innovation", finance: "Finance & business", healthcare: "Health & care", creative: "Ideas & creativity", industry: "Engineering & operations", professional: "Professional excellence" };
  const themeMarks = { technology: "⌘", finance: "↗", healthcare: "+", creative: "✦", industry: "⚙", professional: "◈" };
  const initials = profile.fullName.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("");
  const recognition = [...profile.awards.map((item) => ({ id: `award-${item.id}`, title: item.title, meta: [item.issuer, item.date].filter(Boolean).join(" · "), kind: item.kind === "award" ? "Award" : "Achievement" })), ...profile.certifications.map((item) => ({ id: `cert-${item.id}`, title: item.name, meta: [item.issuer, item.date].filter(Boolean).join(" · "), kind: "Credential" }))].slice(0, 6);
  const currentRoleMilestoneId = profile.experience.find((item) => /\b(?:present|current|ongoing|now)\b/i.test(item.endDate))?.id;
  const profileSignals = [
    { label: "roles", value: profile.experience.length },
    { label: "skills", value: profile.skills.length },
    { label: "projects", value: profile.projects.length },
    { label: "achievements", value: profile.awards.length },
    { label: "credentials", value: profile.certifications.length },
  ].filter((signal) => signal.value > 0);
  const supplementarySignals = profileSignals.filter((signal) => signal.label !== "roles");

  return <section className={`career-portrait career-portrait-${theme} career-edition-${premium ? "signature" : "essential"}`} aria-labelledby="career-portrait-title">
    <div className="career-portrait-glow" aria-hidden="true" />
    <header className="career-portrait-header">
      <div className="career-identity">
        <div className="career-photo-stage"><div className="career-identity-avatar">{profile.profilePhotoUpdatedAt ? <img src={`/api/profile/photo?v=${encodeURIComponent(profile.profilePhotoUpdatedAt)}`} alt="Your private profile photograph" /> : <span aria-hidden="true">{initials}</span>}</div><span className="career-photo-orbit" aria-hidden="true" /></div>
        <div><span className="career-overline">CAREER PORTRAIT · {profile.industry || "PROFESSIONAL"}</span><h2 id="career-portrait-title">{profile.fullName}</h2><p>{profile.headline || profile.currentRole || "Your professional story"}</p><div className="career-role-signature"><span>{signature}</span><i aria-hidden="true" /> <span>{profile.industry || themeLabels[theme]}</span></div></div>
      </div>
      <Link className="career-edit-link" href="/profile">Edit profile <span aria-hidden="true">↗</span></Link>
    </header>
    {profile.openToWork && <div className="career-availability" role="status"><span aria-hidden="true" /><div><strong>Open to work</strong><p>Available for new opportunities</p></div><Link href="/profile">Update availability ↗</Link></div>}

    <div className="career-personal-statement"><div className="career-industry-emblem" aria-hidden="true">{themeMarks[theme]}</div><div><span>{profile.industry || themeLabels[theme]}</span><p>{profile.summary || "Your experience, achievements and ambitions, brought together."}</p><div className="career-featured-skills">{profile.skills.slice(0, 6).map((skill) => <span key={skill}>{skill}</span>)}</div></div></div>

    {(regions.length > 0 || profileSignals.length > 0 || profile.industry) && <div className="career-portrait-grid">
      {regions.length > 0 && <div className="career-exposure-strip"><div><span>CAREER FOOTPRINT</span><strong>{regions.length} {regions.length === 1 ? "region" : "regions"} reflected in your profile</strong></div><div className="career-region-list">{regions.map((region) => <span key={region.id}><i />{region.label}</span>)}</div></div>}
      {(profileSignals.length > 0 || profile.industry) && <aside className="career-signal-panel">
        <span className="career-signal-label">AT A GLANCE</span>
        {profile.experience.length > 0 && <div className="career-signal-orb"><strong>{profile.experience.length}</strong><span>{profile.experience.length === 1 ? "role" : "roles"}</span></div>}
        {supplementarySignals.length > 0 && <div className="career-signal-stats">{supplementarySignals.map((signal) => <div key={signal.label}><strong>{signal.value}</strong><span>{signal.label}</span></div>)}</div>}
        {profile.industry && <div className="career-industry-chip"><span>Industry</span><strong>{profile.industry}</strong></div>}
      </aside>}
    </div>}

    <article className="career-journey-panel">
      <div className="career-panel-heading"><div><span>CAREER ROADMAP</span><h3>Your journey, led by today</h3></div><small>Most recent chapter first</small></div>
      {milestones.length ? <div className="career-roadmap" aria-label="Career milestones in reverse chronological order">{milestones.map((item, index) => <div className={`career-milestone career-milestone-${item.kind}${item.id === `role-${currentRoleMilestoneId}` ? " career-milestone-current" : ""}`} key={item.id}><div className="career-rail"><span className="career-step">{String(index + 1).padStart(2, "0")}</span><div className="career-flag" aria-hidden="true"><span>{kindMarks[item.kind]}</span></div></div><div className="career-milestone-copy"><small>{item.id === `role-${currentRoleMilestoneId}` ? "Current chapter" : kindLabels[item.kind]}</small><strong>{item.label}</strong>{item.detail && <p>{item.detail}</p>}<time>{item.date || "Timing to confirm"}</time></div></div>)}</div> : <div className="career-portrait-empty">Add experience, education or credentials to build your visual journey.</div>}
    </article>

    {recognition.length > 0 && <article className="career-recognition-panel">
      <div className="career-panel-heading"><div><span>HIGHLIGHTS</span><h3>Awards, achievements and credentials</h3></div><Link href="/profile">Add a highlight</Link></div>
      <div className="career-recognition-list">{recognition.map((item, index) => <div key={item.id}><div className="career-medallion" aria-hidden="true">{index + 1}</div><span>{item.kind}</span><strong>{item.title}</strong>{item.meta && <small>{item.meta}</small>}</div>)}</div>
    </article>
    }
    <div className="career-sharing-panel">{publicProfileId ? <PublicShareActions name={profile.fullName} profilePath={`/p/${publicProfileId}`} /> : <div><h3>Share a career worth discovering</h3><p>Choose which profile details visitors can see, then publish your personal career page.</p><Link className="button button-primary" href="/profile">Choose my sharing settings</Link></div>}</div>
  </section>;
}
