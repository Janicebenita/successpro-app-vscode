"use client";

import { useMemo, useState } from "react";
import type { LinkedInMakeover as LinkedInMakeoverResult } from "@successpro/domain";
import type { CanonicalProfile } from "@successpro/contracts";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  return <button className="text-button" type="button" onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button>;
}

function CopyBlock({ title, value }: { title: string; value: string }) {
  return <article className="linkedin-copy-block"><div className="card-heading"><h3>{title}</h3><CopyButton value={value} /></div><p>{value}</p></article>;
}

export function LinkedInMakeover({ result, profile }: { result: LinkedInMakeoverResult; profile: CanonicalProfile }) {
  const [displayed, setDisplayed] = useState(result);
  const [profileText, setProfileText] = useState("");
  const [status, setStatus] = useState("Optional: compare these recommendations with your current LinkedIn profile PDF.");
  const [working, setWorking] = useState(false);
  const comparison = useMemo(() => {
    if (!profileText) return null;
    const normalized = profileText.toLowerCase();
    const terms = displayed.searchKeywords.filter((term) => term.length >= 3);
    const present = terms.filter((term) => normalized.includes(term.toLowerCase()));
    const missing = terms.filter((term) => !normalized.includes(term.toLowerCase()));
    return { present, missing, coverage: terms.length ? Math.round((present.length / terms.length) * 100) : 0 };
  }, [profileText, displayed.searchKeywords]);

  async function tailor() {
    setWorking(true); setStatus("Preparing tailored profile wording from your confirmed details…");
    try {
    const response = await fetch("/api/ai/generateLinkedInMakeover", { method: "POST", signal: AbortSignal.timeout(90_000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, currentProfileText: profileText, targetRole: profile.targetRoles[0] ?? "" }) });
    const body = await response.json();
    if (response.ok) {
      const experience = profile.experience.map((role, index) => ({ title: role.title, employer: role.employer, dates: [role.startDate, role.endDate].filter(Boolean).join(" - "), copy: body.output.experience.find((item: { roleId: string }) => item.roleId === role.id)?.text ?? displayed.experience[index]?.copy ?? "" }));
      setDisplayed({ ...displayed, headlines: body.output.headlines, about: body.output.about, experience, prioritySkills: body.output.skills, featuredSuggestions: body.output.featured, recommendationPrompts: body.output.recommendationPrompts, visibilityChecklist: body.output.visibilityChecks });
      setStatus(body.meta.validation === "fallback" ? "A profile-based version is ready. Tailored writing suggestions are temporarily unavailable." : "Your tailored version is ready. Confirm every statement before publishing.");
    } else setStatus(body.error ?? "Unable to prepare a tailored version.");
    } catch {
      setStatus("Your profile wording has not changed. The request could not finish; please try again.");
    } finally { setWorking(false); }
  }

  async function inspect(file?: File) {
    if (!file) return;
    setWorking(true); setStatus("Reading your LinkedIn profile PDF privately…");
    try {
    const form = new FormData(); form.set("profile", file);
    const response = await fetch("/api/linkedin-profile", { method: "POST", body: form, signal: AbortSignal.timeout(90_000) });
    const body = await response.json();
    if (response.ok) { setProfileText(body.text); setStatus(body.message); } else setStatus(body.error ?? "Unable to read this PDF.");
    } catch {
      setStatus("We could not finish reading that file. Your current profile is unchanged; please try again.");
    } finally { setWorking(false); }
  }

  return <div className="linkedin-workspace">
    <p role="status" aria-live="polite">{status}</p>
    <section className="work-card profile-intro"><div><span className="status-pill">LINKEDIN MAKEOVER</span><h2>Make every section clear and credible</h2><p>Use your confirmed career profile to create copy-ready sections. Nothing is posted to LinkedIn, and SuccessPro never scrapes or edits your account.</p></div><button className="button button-primary" type="button" disabled={working} onClick={() => void tailor()}>{working ? "Preparing your version…" : "Tailor my profile"}</button></section>
    <section className="linkedin-top-grid">
      <article className="work-card form-grid"><span className="section-kicker">OPTIONAL COMPARISON</span><h3>Upload your current LinkedIn PDF</h3><ol className="linkedin-steps"><li>Open LinkedIn on a desktop browser and view your profile.</li><li>Choose Resources or More, then Save to PDF.</li><li>Upload that PDF here to compare visible keywords.</li></ol><label className="upload-zone"><strong>{working ? "Reading profile…" : "Choose LinkedIn profile PDF"}</strong><span>{status}</span><input type="file" accept="application/pdf,.pdf" disabled={working} onChange={(event) => void inspect(event.target.files?.[0])} /></label></article>
      <article className="work-card linkedin-comparison"><span className="section-kicker">PROFILE SEARCH COVERAGE</span>{comparison ? <><strong>{comparison.coverage}%</strong><p>This is a simple text-coverage check, not a ranking prediction.</p><h4>Already visible</h4><div className="skill-cloud">{comparison.present.map((term) => <span key={term}>{term}</span>)}</div><h4>Consider adding where accurate</h4><div className="skill-cloud missing">{comparison.missing.map((term) => <span key={term}>{term}</span>)}</div></> : <><strong> - </strong><p>Upload your LinkedIn PDF to compare its visible text with the role and skills in your confirmed profile.</p></>}</article>
    </section>
    <section className="work-card"><div className="card-heading"><div><span className="section-kicker">HEADLINE OPTIONS</span><h3>Choose the positioning that sounds most like you</h3></div></div><div className="linkedin-headlines">{displayed.headlines.map((headline, index) => <div key={headline}><span>{String(index + 1).padStart(2, "0")}</span><p>{headline}</p><CopyButton value={headline} /></div>)}</div></section>
    <CopyBlock title="About" value={displayed.about} />
    <section className="work-card"><div className="card-heading"><div><span className="section-kicker">EXPERIENCE</span><h3>Copy-ready role descriptions</h3></div></div><div className="linkedin-experience">{displayed.experience.map((item) => <article key={`${item.title}-${item.employer}`}><div className="card-heading"><div><strong>{item.title}</strong><span>{item.employer} · {item.dates}</span></div><CopyButton value={item.copy} /></div><p>{item.copy}</p></article>)}</div></section>
    <section className="career-highlights-grid">
      <article className="work-card"><h3>Skills and search terms</h3><p className="document-note">Use only skills you can demonstrate. Put the most relevant skills first.</p><div className="skill-cloud">{displayed.prioritySkills.map((skill) => <span key={skill}>{skill}</span>)}</div><div className="linkedin-keywords"><CopyButton value={displayed.searchKeywords.join(", ")} /><p>{displayed.searchKeywords.join(" · ")}</p></div></article>
      <article className="work-card"><h3>Featured section</h3><ul className="plain-list">{displayed.featuredSuggestions.map((item) => <li key={item}>{item}</li>)}</ul></article>
      <article className="work-card"><h3>Projects, credentials, and education</h3><div className="linkedin-detail-groups"><strong>Projects</strong>{displayed.projects.length ? displayed.projects.map((item) => <p key={item}>{item}</p>) : <p>Add relevant projects to your career profile first.</p>}<strong>Credentials</strong>{displayed.credentials.length ? displayed.credentials.map((item) => <p key={item}>{item}</p>) : <p>Add verified credentials only.</p>}<strong>Education</strong>{displayed.education.map((item) => <p key={item}>{item}</p>)}</div></article>
      <article className="work-card"><h3>Recommendations strategy</h3><ul className="plain-list">{displayed.recommendationPrompts.map((item) => <li key={item}>{item}</li>)}</ul></article>
      <article className="work-card"><h3>Privacy and visibility check</h3><ul className="plain-list">{displayed.visibilityChecklist.map((item) => <li key={item}>{item}</li>)}</ul></article>
    </section>
  </div>;
}
