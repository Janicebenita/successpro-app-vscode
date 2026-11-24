"use client";

import { fetchJsonWithDeadline } from "@/lib/client-json-request";

import { useCallback, useEffect, useState } from "react";
import type { JobPreferences } from "@successpro/contracts";
import type { JobRecord } from "@successpro/contracts/jobs";
import type { RecruiterBoardJob } from "./recruiter-job-board";
import { googleJobsSearchUrl } from "@/lib/google-jobs-link";

type Match = { jobId: string; reason: string; gaps: string[]; caution: string };
type DisplayJob = JobRecord & { locationFit?: "preferred" | "close" };
type MatchedRecruiterJob = RecruiterBoardJob & { locationFit: "preferred" | "close" };

export function OpportunitiesWorkspace({ initial, inferred = false }: { initial?: Partial<JobPreferences> | null; inferred?: boolean }) {
  const [roles, setRoles] = useState(initial?.roleTitles?.join(", ") ?? "");
  const [locations, setLocations] = useState(initial?.locations ?? []);
  const [locationDraft, setLocationDraft] = useState("");
  const [industries, setIndustries] = useState(initial?.industries?.join(", ") ?? "");
  const [keywords, setKeywords] = useState(initial?.keywords?.join(", ") ?? "");
  const [experienceYears, setExperienceYears] = useState(initial?.experienceYears?.toString() ?? "");
  const [workModes, setWorkModes] = useState<JobPreferences["workModes"]>(initial?.workModes ?? ["remote", "hybrid"]);
  const [salary, setSalary] = useState(initial?.salaryMinimum?.toString() ?? "");
  const [status, setStatus] = useState(initial?.roleTitles?.length ? "Checking current openings that fit your career profile…" : "Add your current role and location to your profile to see relevant openings.");
  const [jobs, setJobs] = useState<DisplayJob[]>([]);
  const [recruiterJobs, setRecruiterJobs] = useState<MatchedRecruiterJob[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [searching, setSearching] = useState(false);
  function toggle(mode: JobPreferences["workModes"][number]) { setWorkModes((current) => current.includes(mode) ? current.filter((item) => item !== mode) : [...current, mode]); }
  async function save() {
    const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
    const payload: JobPreferences = { roleTitles: list(roles), locations, industries: list(industries), keywords: list(keywords), experienceYears: experienceYears ? Number(experienceYears) : null, workModes, employmentTypes: ["full-time"], salaryMinimum: salary ? Number(salary) : null, currency: "INR", excludedEmployers: [] };
    const response = await fetchJsonWithDeadline("/api/job-preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (response.ok) { setStatus("Your preferences are saved. Updating the matches…"); await loadJobs(false); }
    else setStatus(body.error ?? "Unable to save preferences.");
  }
  const loadJobs = useCallback(async (refresh = false) => {
    setSearching(true); setStatus(refresh ? "Checking approved public job sources…" : "Finding matches in verified listings…");
    if (refresh) {
      const refreshResponse = await fetchJsonWithDeadline("/api/jobs/refresh", { method: "POST" });
      const refreshBody = await refreshResponse.json();
      if (!refreshResponse.ok && refreshResponse.status !== 429) { setStatus(refreshBody.error ?? "Unable to refresh job sources."); setSearching(false); return; }
      if (refreshResponse.ok && refreshBody.sourceCount === 0) setStatus("No approved job source returned a current listing. You can still use the official search links below.");
    }
    const response = await fetchJsonWithDeadline("/api/jobs", { cache: "no-store" }); const body = await response.json();
    if (response.ok) { setJobs(body.jobs); setRecruiterJobs(body.recruiterJobs ?? []); setMatches(body.matches); setStatus(body.message); } else setStatus(body.error ?? "Unable to search jobs.");
    setSearching(false);
  }, []);
  useEffect(() => { if (initial?.roleTitles?.length) void loadJobs(false); }, [initial?.roleTitles?.length, loadJobs]);
  const matchFor = (id: string) => matches.find((match) => match.jobId === id);
  async function applyForRecruiterJob(id: string) {
    setStatus("Sending your SuccessPro profile to the verified recruiter…");
    const response = await fetchJsonWithDeadline(`/api/recruiter/jobs/${encodeURIComponent(id)}/apply`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Application sent. The recruiter can review your SuccessPro profile and contact you through messages." : body.error ?? "We could not send this application.");
  }
  const googleLinks = (roles.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 3).flatMap((role) => locations.slice(0, 5).map((location) => ({ role, location, href: googleJobsSearchUrl({ role, location, experienceYears: experienceYears ? Number(experienceYears) : null, keywords: keywords.split(",") }) }))));
  function addLocation() { const value = locationDraft.trim(); if (!value || locations.length >= 5 || locations.some((item) => item.toLowerCase() === value.toLowerCase())) return; setLocations([...locations, value]); setLocationDraft(""); }
  return <div className="opportunities-layout">
    <section className="work-card profile-intro"><div><span className="status-pill">OPENINGS FOR YOUR PROFILE</span><h2>Openings selected for you</h2><p>{inferred ? "We started with your current and target roles, skills, and present location. Adjust the optional preferences below to sharpen your matches." : "Your saved preferences refine the matches from your career profile. You can change them at any time."}</p></div><div className="opportunity-actions"><button className="button button-primary" onClick={() => void save()}>Save my refinements</button><button className="button button-dark" disabled={searching} onClick={() => void loadJobs(true)}>{searching ? "Checking sources…" : "Refresh current openings"}</button></div></section>
    <section className="profile-grid"><article className="work-card form-grid"><h3>Jobs you would consider</h3><label className="form-field">Job titles <span className="field-help">Separate multiple titles with commas</span><input value={roles} onChange={(event) => setRoles(event.target.value)} /></label><div className="form-field"><span>Preferred locations</span><small className="field-help">Add up to five countries, states, regions, or cities.</small><div className="location-entry"><input value={locationDraft} onChange={(event) => setLocationDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLocation(); } }} placeholder="Bengaluru, Karnataka, India" /><button className="button button-dark" type="button" onClick={addLocation} disabled={!locationDraft.trim() || locations.length >= 5}>Add</button></div><div className="location-chips">{locations.map((location) => <button type="button" key={location} onClick={() => setLocations(locations.filter((item) => item !== location))}>{location} ×</button>)}</div><small>{locations.length} of 5 locations</small></div><div className="form-columns"><label className="form-field">Relevant experience (years)<input type="number" min="0" max="60" value={experienceYears} onChange={(event) => setExperienceYears(event.target.value)} /></label><label className="form-field">Important keywords <span className="field-help">Skills, products, or sectors</span><input value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="SaaS, enterprise sales, partnerships" /></label></div><label className="form-field">Industries<input value={industries} onChange={(event) => setIndustries(event.target.value)} /></label><label className="form-field">Minimum annual salary<input type="number" min="0" value={salary} onChange={(event) => setSalary(event.target.value)} /></label><fieldset className="choice-field"><legend>How would you like to work?</legend>{(["remote", "hybrid", "onsite"] as const).map((mode) => <label key={mode}><input type="checkbox" checked={workModes.includes(mode)} onChange={() => toggle(mode)} />{mode}</label>)}</fieldset><p className="save-status" role="status">{status}</p></article><article className="work-card connector-empty"><span aria-hidden="true">◎</span><h3>Current openings, checked responsibly</h3><p>SuccessPro imports recent listings from approved feeds and APIs, including attributed remote listings. Google Jobs links open its own search interface; we do not copy result cards or imply a listing is still open without checking the source.</p><div className="source-principles"><span>Only the last 30 days</span><span>Preferred and close-location matches</span><span>Duplicate and closed-listing checks</span></div><div className="job-source-links">{googleLinks.slice(0, 5).map((item) => <a href={item.href} target="_blank" rel="noreferrer" key={`${item.role}-${item.location}`}>Google Jobs: {item.role} · {item.location}</a>)}<a href="https://www.ncs.gov.in/" target="_blank" rel="noreferrer">India National Career Service</a><a href="https://www.usajobs.gov/Search/Results" target="_blank" rel="noreferrer">USAJOBS</a></div></article></section>
    <section className="job-results">{recruiterJobs.map((job) => { const match = matchFor(`recruiter:${job.id}`); return <article className="work-card job-card" key={`recruiter-${job.id}`}><div className="card-heading"><div><span className="section-kicker">{job.organizationName}</span><h3>{job.title}</h3></div><span className="status-pill">VERIFIED RECRUITER</span></div><p>{job.department ? `${job.department} · ` : ""}{job.location} · {job.workMode}</p>{match && <div className="job-match-copy"><p>{match.reason}</p>{match.gaps.length > 0 && <p><b>Check:</b> {match.gaps.join(", ")}</p>}</div>}<div className="job-source-meta"><span>SuccessPro profile application</span><span>Posted {job.publishedOn}</span></div><button className="button button-primary" type="button" onClick={() => void applyForRecruiterJob(job.id)}>Apply with my SuccessPro profile</button></article>; })}{jobs.map((job) => { const match = matchFor(job.id); return <article className="work-card job-card" key={job.id}><div className="card-heading"><div><span className="section-kicker">{job.employer}</span><h3>{job.title}</h3></div><div className="job-labels"><span className={`match-tier match-tier-${job.locationFit}`}>{job.locationFit === "close" ? "Close location" : "Preferred location"}</span><span className={`freshness freshness-${job.freshness}`}>{job.freshness}</span></div></div><p>{job.location || "Location not supplied"}{job.workMode !== "unknown" ? ` · ${job.workMode}` : ""}</p>{job.salaryText && <strong>{job.salaryText}</strong>}{match && <div className="job-match-copy"><p>{match.reason}</p>{match.gaps.length > 0 && <p><b>Check:</b> {match.gaps.join(", ")}</p>}<small>{match.caution}</small></div>}<div className="job-source-meta"><span>{job.sourceName}</span><span>{job.dateBasis === "updated" ? "Updated" : "Posted"} {job.postedOn || "date not supplied"}</span><span>Last checked {job.lastSeenOn}</span></div><a className="button button-dark" href={job.canonicalUrl} target="_blank" rel="noreferrer">View original listing</a></article>; })}{!jobs.length && !recruiterJobs.length && !searching && <article className="work-card connector-empty"><h3>No verified matches available yet</h3><p>We checked the approved sources using your profile. You can refine the roles and locations above or use the personalized search links while more sources are connected.</p></article>}</section>
  </div>;
}
