"use client";
/* eslint-disable @next/next/no-img-element -- the private, authenticated profile-photo route cannot be optimized by Next Image. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { canonicalProfileSchema, type CanonicalProfile } from "@successpro/contracts";
import { OperationProgress, type OperationProgressState } from "./operation-progress";
import { profileReviewQuestions, unansweredProfileQuestions } from "@/lib/profile-review-questions";

const emptyProfile: CanonicalProfile = {
  fullName: "",
  headline: "",
  location: "",
  summary: "",
  currentRole: "",
  industry: "",
  skills: [],
  experience: [],
  education: [],
  projects: [],
  certifications: [],
  awards: [],
  publications: [],
  volunteerExperience: [],
  languages: [],
  preferredLanguage: "en",
  links: [],
  targetRoles: [],
  openToWork: false,
  publicProfileEnabled: false,
  publicProfileVisibility: { summary: true, location: true, currentRole: true, industry: true, skills: true, experience: true, education: true, photo: false },
  searchEngineIndexable: false,
  profilePhotoUpdatedAt: "",
};

type TransformApiResponse = {
  error?: string;
  profileDraft?: Partial<CanonicalProfile>;
  warnings?: string[];
  improvements?: Array<{ field: string; observed: string; inference: string; suggestion: string }>;
  assistant?: { validation?: string };
};

export function ProfileForm({ initial, resumeDraft, resumeDraftName, resumeDraftWarnings = [], initialReviewAnswers = [], publicProfileId, draftApplied = false, resumeDraftTransformed = false, nextPath = "/dashboard" }: { initial?: Partial<CanonicalProfile> | null; resumeDraft?: Partial<CanonicalProfile> | null; resumeDraftName?: string | null; resumeDraftWarnings?: string[]; initialReviewAnswers?: string[]; publicProfileId?: string | null; draftApplied?: boolean; resumeDraftTransformed?: boolean; nextPath?: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<CanonicalProfile>({ ...emptyProfile, ...initial });
  const [skills, setSkills] = useState(profile.skills.join(", "));
  const [targets, setTargets] = useState(profile.targetRoles.join(", "));
  const [languages, setLanguages] = useState(profile.languages.join(", "));
  const [status, setStatus] = useState("Check that each detail is correct before saving.");
  const [saving, setSaving] = useState(false);
  const [shareId, setShareId] = useState(publicProfileId);
  const [transformNotes, setTransformNotes] = useState<Array<{ field: string; observed: string; inference: string; suggestion: string }>>([]);
  const [refinementNotes, setRefinementNotes] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [hasTransformed, setHasTransformed] = useState(resumeDraftTransformed);
  const [reviewQuestions, setReviewQuestions] = useState(resumeDraftWarnings);
  const [reviewAnswers, setReviewAnswers] = useState<string[]>(initialReviewAnswers);
  const [transformProgress, setTransformProgress] = useState<OperationProgressState>({ active: false, percent: 0, title: "", detail: "", steps: [], currentStep: 0 });
  const [photoVersion, setPhotoVersion] = useState(profile.profilePhotoUpdatedAt);
  const [reviewPanelLeft, setReviewPanelLeft] = useState(false);

  function field<K extends keyof CanonicalProfile>(key: K, value: CanonicalProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function editedProfile() {
    return { ...profile, skills: skills.split(",").map((value) => value.trim()).filter(Boolean), targetRoles: targets.split(",").map((value) => value.trim()).filter(Boolean), languages: languages.split(",").map((value) => value.trim()).filter(Boolean) };
  }

  function requireReview() {
    if (!resumeDraft) return true;
    const remaining = unansweredProfileQuestions(editedProfile(), reviewQuestions, reviewAnswers);
    if (!remaining.length) return true;
    setStatus(`Please answer the ${remaining.length} highlighted detail${remaining.length === 1 ? "" : "s"} before continuing. Add or correct the information below, or confirm that it is unavailable.`);
    window.setTimeout(() => document.getElementById("resume-review-questions")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 50);
    return false;
  }

  function applyResumeDraft() {
    if (!resumeDraft) return;
    const next = { ...profile, ...resumeDraft, openToWork: profile.openToWork, publicProfileEnabled: profile.publicProfileEnabled, publicProfileVisibility: profile.publicProfileVisibility, searchEngineIndexable: profile.searchEngineIndexable };
    setProfile(next);
    setSkills((resumeDraft.skills ?? profile.skills).join(", "));
    setTargets((resumeDraft.targetRoles ?? profile.targetRoles).join(", "));
    setLanguages((resumeDraft.languages ?? profile.languages).join(", "));
    setStatus("Resume details added. Check them carefully, then save your profile.");
  }

  async function updatePhoto(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 2_000_000) { setStatus("Choose a JPG or PNG photograph under 2 MB."); return; }
    setSaving(true); setStatus("Saving your private profile photograph…");
    const form = new FormData(); form.set("photo", file);
    try {
      const response = await fetch("/api/profile/photo", { method: "POST", body: form }); const body = await response.json();
      if (!response.ok) { setStatus(body.error ?? "Unable to save the photograph."); return; }
      setPhotoVersion(body.updatedAt); field("profilePhotoUpdatedAt", body.updatedAt); setStatus("Your profile photograph is saved privately.");
    } catch { setStatus("The photograph could not be saved. Your existing profile remains unchanged."); } finally { setSaving(false); }
  }

  async function removePhoto() {
    setSaving(true); const response = await fetch("/api/profile/photo", { method: "DELETE" });
    if (response.ok) { setPhotoVersion(""); field("profilePhotoUpdatedAt", ""); setStatus("Your private profile photograph was removed."); }
    else setStatus("Unable to remove the photograph.");
    setSaving(false);
  }

  async function transformResumeDraft() {
    if (!requireReview()) return;
    setSaving(true); setStatus("Reading the complete resume and preparing an improved, editable profile draft…");
    const steps = ["Read your edits", "Verify facts", "Rewrite professionally", "Prepare editable draft"];
    setTransformProgress({ active: true, estimated: true, percent: 6, title: "Transforming your resume", detail: "Preparing your draft from your resume and latest edits. Your current content stays safe.", steps, currentStep: 0 });
    const started = Date.now();
    const timer = window.setInterval(() => { const elapsed = Date.now() - started; const percent = Math.min(92, 10 + Math.floor(elapsed / 650)); setTransformProgress({ active: true, estimated: true, percent, title: "Transforming your resume", detail: elapsed < 45_000 ? "Preparing your draft from your resume and latest edits. Your current content stays safe." : "This is taking longer than usual. We’ll show the result or a retry message shortly; your edits remain unchanged.", steps: [], currentStep: 0 }); }, 700);
    const editedDraft = editedProfile();
    let response: Response; let body: TransformApiResponse;
    try { response = await fetch("/api/resumes/transform", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(115_000), body: JSON.stringify({ draft: editedDraft, reviewAnswers, jobDescription, refinementNotes, mode: hasTransformed ? "refine" : "initial" }) }); body = await response.json().catch(() => ({})); }
    catch { window.clearInterval(timer); setTransformProgress({ active: false, percent: 0, title: "", detail: "", steps: [], currentStep: 0 }); setStatus("The transformation was interrupted. Your existing draft is unchanged; please try again."); setSaving(false); return; }
    window.clearInterval(timer);
    if (!response.ok) { setTransformProgress({ active: false, percent: 0, title: "", detail: "", steps: [], currentStep: 0 }); setStatus(body.error ?? "Unable to transform the resume details right now. Your existing draft is unchanged."); setSaving(false); return; }
    const checkedDraft = canonicalProfileSchema.safeParse({ ...profile, ...body.profileDraft });
    if (!body.profileDraft || body.assistant?.validation !== "passed" || !checkedDraft.success) { setTransformProgress({ active: false, percent: 0, title: "", detail: "", steps: [], currentStep: 0 }); setStatus("The transformation completed without a usable draft. Your existing content is unchanged; please try again."); setSaving(false); return; }
    const draft = checkedDraft.data;
    const next = { ...profile, ...draft, openToWork: profile.openToWork, publicProfileEnabled: profile.publicProfileEnabled, publicProfileVisibility: profile.publicProfileVisibility, searchEngineIndexable: profile.searchEngineIndexable };
    setProfile(next); setSkills((draft.skills ?? profile.skills).join(", ")); setTargets((draft.targetRoles ?? profile.targetRoles).join(", ")); setLanguages((draft.languages ?? profile.languages).join(", ")); setTransformNotes(Array.isArray(body.improvements) ? body.improvements : []); setReviewQuestions(Array.isArray(body.warnings) ? body.warnings.filter((item: unknown): item is string => typeof item === "string") : []); setReviewAnswers([]); setHasTransformed(true); setRefinementNotes("");
    setTransformProgress({ active: false, percent: 100, title: "Your transformed draft is ready", detail: "Review the highlighted changes and edit any field before saving.", steps, currentStep: 3 });
    setStatus("Your revised transformed draft is ready below. Your selected document style has not changed."); setSaving(false);
    window.setTimeout(() => document.getElementById("profile-details")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  function addExperience() {
    field("experience", [...profile.experience, { id: crypto.randomUUID(), title: "", employer: "", startDate: "", endDate: "", achievements: [] }]);
  }

  function updateExperience(index: number, patch: Partial<CanonicalProfile["experience"][number]>) {
    field("experience", profile.experience.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addEducation() {
    field("education", [...profile.education, { id: crypto.randomUUID(), qualification: "", institution: "", startDate: "", endDate: "" }]);
  }

  function updateEducation(index: number, patch: Partial<CanonicalProfile["education"][number]>) {
    field("education", profile.education.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addProject() {
    field("projects", [...profile.projects, { id: crypto.randomUUID(), name: "", description: "", link: "" }]);
  }

  function updateProject(index: number, patch: Partial<CanonicalProfile["projects"][number]>) {
    field("projects", profile.projects.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addCertification() {
    field("certifications", [...profile.certifications, { id: crypto.randomUUID(), name: "", issuer: "", date: "", credentialUrl: "" }]);
  }

  function updateCertification(index: number, patch: Partial<CanonicalProfile["certifications"][number]>) {
    field("certifications", profile.certifications.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addAward() {
    field("awards", [...profile.awards, { id: crypto.randomUUID(), kind: "award", title: "", issuer: "", date: "", description: "" }]);
  }

  function updateAward(index: number, patch: Partial<CanonicalProfile["awards"][number]>) {
    field("awards", profile.awards.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addPublication() {
    field("publications", [...profile.publications, { id: crypto.randomUUID(), title: "", publisher: "", date: "", link: "" }]);
  }

  function updatePublication(index: number, patch: Partial<CanonicalProfile["publications"][number]>) {
    field("publications", profile.publications.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addVolunteerExperience() {
    field("volunteerExperience", [...profile.volunteerExperience, { id: crypto.randomUUID(), role: "", organization: "", startDate: "", endDate: "", description: "" }]);
  }

  function updateVolunteerExperience(index: number, patch: Partial<CanonicalProfile["volunteerExperience"][number]>) {
    field("volunteerExperience", profile.volunteerExperience.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addLink() {
    field("links", [...profile.links, { id: crypto.randomUUID(), label: "", url: "" }]);
  }

  function updateLink(index: number, patch: Partial<CanonicalProfile["links"][number]>) {
    field("links", profile.links.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function improveSection(sectionName: string, originalText: string, apply: (value: string) => void) {
    if (!originalText.trim()) { setStatus(`Add your ${sectionName.toLowerCase()} before improving the wording.`); return; }
    setSaving(true); setStatus(`Preparing clearer ${sectionName.toLowerCase()} wording…`);
    const verifiedFacts = [...profile.experience.flatMap((item) => item.achievements), ...profile.skills, profile.currentRole, profile.industry].filter(Boolean);
    const response = await fetch("/api/ai/rewriteResumeSection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sectionName, originalText, targetRole: profile.targetRoles[0] ?? "", verifiedFacts }) });
    const body = await response.json();
    if (response.ok) { apply(body.output.rewrite); setStatus(body.meta.validation === "fallback" ? "Your wording was preserved because tailored rewriting is temporarily unavailable." : "Suggested wording added. Confirm every fact before saving."); }
    else setStatus(body.error ?? "Unable to improve this section.");
    setSaving(false);
  }

  async function persistProfile(destination?: string) {
    if (!requireReview()) return;
    if (profile.awards.some((item) => !item.kind)) {
      setStatus("Choose whether each saved highlight is an award or an achievement before confirming your profile.");
      return;
    }
    setSaving(true);
    setStatus("Saving your profile…");
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editedProfile(), reviewAnswers }),
    });
    const body = await response.json();
    if (!response.ok) {
      setStatus(body.error ?? "Unable to save your profile.");
      setSaving(false);
      return;
    }
    setShareId(body.publicProfileId ?? null);
    setReviewQuestions([]);
    setStatus("Your profile has been saved.");
    setSaving(false);
    if (destination) { router.push(destination); router.refresh(); }
  }

  async function save(event: React.FormEvent) { event.preventDefault(); await persistProfile(nextPath); }
  async function saveAndBuild() { await persistProfile("/documents"); }

  async function rotatePublicLink() {
    if (!window.confirm("Create a new public link? Your current link will stop working immediately.")) return;
    setSaving(true);
    setStatus("Creating a new public link…");
    const response = await fetch("/api/profile/public-link", { method: "POST" });
    const body = await response.json();
    if (!response.ok) setStatus(body.error ?? "Unable to create a new public link.");
    else {
      setShareId(body.publicProfileId);
      setStatus("Your new public link is ready. The previous link no longer works.");
    }
    setSaving(false);
  }

  return <form className="profile-form" onSubmit={(event) => void save(event)}>
    <p className="save-status" role="status" aria-live="polite">{status}</p>
    {resumeDraft && <section className="work-card import-draft"><div><span className="status-pill">{hasTransformed ? "EDITABLE TRANSFORMED DRAFT" : draftApplied ? "RESUME DETAILS ADDED" : "DETAILS FOUND"}</span><h3>{hasTransformed ? "Edit, save, or transform the content again" : draftApplied ? "Check the details we found" : "Add details from your latest resume?"}</h3><p>{hasTransformed ? "Every field below remains editable. Save your corrections as they are, or transform again so the expert writer uses your latest edits as authoritative information." : draftApplied ? `We filled this draft from ${resumeDraftName ?? "your latest resume"}. Correct anything that is missing or inaccurate, then save.` : `We found information in ${resumeDraftName ?? "your latest resume"}. You can review and change everything before saving.`}</p><small>Transform improves content without inventing facts. Transforming again preserves the current structure where practical. Save and continue to choose the final resume style, page size, contact details, and optional photograph.</small><label className="form-field">Job description to tailor this resume <span className="field-help">Optional. Paste the role requirements; we’ll emphasize only experience you actually have. Leave blank for a general-purpose resume.</span><textarea rows={5} maxLength={100000} value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the job description for the role you want…" /></label>{hasTransformed && <label className="form-field">What should the next version improve? <span className="field-help">Optional. Add emphasis or writing preferences; factual edits should be made in the fields below.</span><textarea rows={3} maxLength={2000} value={refinementNotes} onChange={(event) => setRefinementNotes(event.target.value)} placeholder="For example: make the leadership impact clearer and reduce repetition." /></label>}<OperationProgress state={transformProgress} variant="scan" /></div><div className="button-row">{!draftApplied && !hasTransformed && <button className="button button-secondary" type="button" onClick={applyResumeDraft}>Add extracted details</button>}<button className="button button-secondary" type="button" disabled={saving} onClick={() => void persistProfile()}>{saving ? "Saving…" : "Save my changes"}</button><button className="button button-dark" type="button" disabled={saving} onClick={() => void transformResumeDraft()}>{saving ? "Transformation in progress…" : hasTransformed ? "Transform again using my edits" : "Transform with expert assistance"}</button><button className="button button-primary" type="button" disabled={saving} onClick={() => void saveAndBuild()}>{saving ? "Saving…" : "Save and open resume builder"}</button></div></section>}
    {resumeDraft && profileReviewQuestions(editedProfile(), reviewQuestions).length > 0 && <section className={`profile-review-layout ${reviewPanelLeft ? "profile-review-layout-reversed" : ""}`} id="resume-review-questions" aria-labelledby="resume-review-questions-title"><section className="work-card profile-review-panel"><div className="card-heading"><div><span className="section-kicker">REVIEW QUEUE</span><h3 id="resume-review-questions-title">Details to confirm</h3></div><button className="text-button" type="button" onClick={() => setReviewPanelLeft((current) => !current)}>{reviewPanelLeft ? "Move panel right" : "Move panel left"}</button></div><p>Confirm each point here while you correct the related detail in the editor. You can move this panel to the side that feels more natural.</p><ol className="review-queue">{profileReviewQuestions(editedProfile(), reviewQuestions).map((question, index) => <li key={question.id}><span>{String(index + 1).padStart(2, "0")}</span><div><p>{question.prompt}</p>{question.requiresEdit ? <p className="field-help">{question.answerLabel}</p> : <label><input type="checkbox" checked={reviewAnswers.includes(question.id)} onChange={(event) => setReviewAnswers((current) => event.target.checked ? [...current, question.id] : current.filter((id) => id !== question.id))} /> {question.answerLabel}</label>}</div></li>)}</ol></section><aside className="work-card profile-review-guide"><span className="section-kicker">HOW TO REVIEW</span><h3>One clear pass</h3><p>Use the editor alongside this list. Update a fact, then confirm it. If the detail is unavailable, confirm that explicitly so we do not invent it.</p><strong>{unansweredProfileQuestions(editedProfile(), reviewQuestions, reviewAnswers).length} details remaining</strong></aside></section>}
    {transformNotes.length > 0 && <section className="work-card"><h3>Changes prepared for your review</h3><div className="review-priorities">{transformNotes.map((note, index) => <article key={`${note.field}-${index}`}><div><strong>{note.field}</strong></div><p><b>Source evidence:</b> {note.observed}</p>{note.inference && <p><b>Professional assessment:</b> {note.inference}</p>}<p><b>Suggested change:</b> {note.suggestion}</p></article>)}</div></section>}
    <section className="work-card profile-intro" id="profile-details"><div><span className="status-pill">YOUR CAREER PROFILE</span><h2>Tell your professional story</h2><p>These details help personalize your dashboard, Resume Checker, and job matches. Nothing is made public unless you choose to share it.</p></div><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></section>
    <section className="profile-grid">
      <div className="work-card form-grid">
        <h3>Identity and positioning</h3>
        <div className="profile-photo-control"><div className="profile-photo-frame">{photoVersion ? <img src={`/api/profile/photo?v=${encodeURIComponent(photoVersion)}`} alt="Your private profile photograph" /> : <span>{profile.fullName.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("") || "ME"}</span>}</div><div><strong>Profile photograph</strong><p>Optional and private by default. It improves your own dashboard and is never added to a public profile automatically.</p><div className="button-row"><label className="button button-secondary">{photoVersion ? "Change photograph" : "Add photograph"}<input className="sr-only" type="file" accept="image/jpeg,image/png" onChange={(event) => void updatePhoto(event.target.files?.[0])} /></label>{photoVersion && <button className="text-button" type="button" onClick={() => void removePhoto()} disabled={saving}>Remove</button>}</div></div></div>
        <label className="form-field">Full name<input value={profile.fullName} onChange={(event) => field("fullName", event.target.value)} required /></label>
        <label className="form-field">Professional headline<input value={profile.headline} onChange={(event) => field("headline", event.target.value)} placeholder="Senior Product Analyst · Growth and Experimentation" required /></label>
        <div className="form-columns"><label className="form-field">Current role<input value={profile.currentRole} onChange={(event) => field("currentRole", event.target.value)} /></label><label className="form-field">Industry<input value={profile.industry} onChange={(event) => field("industry", event.target.value)} /></label></div>
        <label className="form-field">Location<input value={profile.location} onChange={(event) => field("location", event.target.value)} /></label>
        <label className="form-field">Professional summary<textarea rows={6} value={profile.summary} onChange={(event) => field("summary", event.target.value)} /></label><button className="text-button inline-assist" type="button" disabled={saving || !profile.summary.trim()} onClick={() => void improveSection("Professional summary", profile.summary, (value) => field("summary", value))}>Improve summary wording</button>
      </div>
      <div className="work-card form-grid">
        <h3>Skills and direction</h3>
        <label className="form-field">Skills <span className="field-help">Comma-separated</span><textarea rows={5} value={skills} onChange={(event) => setSkills(event.target.value)} /></label>
        <label className="form-field">Target roles <span className="field-help">Comma-separated</span><textarea rows={4} value={targets} onChange={(event) => setTargets(event.target.value)} /></label>
        <label className="toggle-row"><span><strong>Open to work</strong><small>Shown only when you turn on your public profile.</small></span><input type="checkbox" checked={profile.openToWork} onChange={(event) => field("openToWork", event.target.checked)} /></label>
        <label className="toggle-row"><span><strong>Public profile</strong><small>Off by default. Your email and phone number stay private.</small></span><input type="checkbox" checked={profile.publicProfileEnabled} onChange={(event) => field("publicProfileEnabled", event.target.checked)} /></label>
        {profile.publicProfileEnabled && <fieldset className="record-editor"><legend>Choose what visitors can see</legend>{([['summary', 'Professional summary'], ['location', 'Location'], ['currentRole', 'Current role'], ['industry', 'Industry'], ['skills', 'Skills'], ['experience', 'Experience'], ['education', 'Education']] as const).map(([key, label]) => <label className="toggle-row" key={key}><span><strong>{label}</strong></span><input type="checkbox" checked={profile.publicProfileVisibility[key]} onChange={(event) => field("publicProfileVisibility", { ...profile.publicProfileVisibility, [key]: event.target.checked })} /></label>)}{photoVersion && <label className="toggle-row"><span><strong>Profile photograph</strong><small>Show this photograph on your public Career Overview. Anyone with your sharing link can view it.</small></span><input type="checkbox" checked={profile.publicProfileVisibility.photo} onChange={(event) => field("publicProfileVisibility", { ...profile.publicProfileVisibility, photo: event.target.checked })} /></label>}<label className="toggle-row"><span><strong>Allow search engines to list this profile</strong><small>Off by default. Your sharing link still works when this is off.</small></span><input type="checkbox" checked={profile.searchEngineIndexable} onChange={(event) => field("searchEngineIndexable", event.target.checked)} /></label></fieldset>}
        {shareId && <div className="public-link-card"><strong>Your public profile</strong><span>Anyone with this link can view the details you chose to publish.</span><a href={`/p/${shareId}`} target="_blank" rel="noreferrer">Open public profile</a><a href={`/api/public-profiles/${shareId}/image`} target="_blank" rel="noreferrer">Download landscape image</a><a href={`/api/public-profiles/${shareId}/image?format=portrait`} target="_blank" rel="noreferrer">Download portrait image</a><button className="text-button" type="button" onClick={() => void rotatePublicLink()} disabled={saving}>Create a new link</button><small>The previous link will stop working immediately.</small></div>}
        <p className="save-status" role="status">{status}</p>
      </div>
    </section>
    <section className="profile-grid">
      <div className="work-card form-grid"><div className="card-heading"><h3>Experience</h3><button className="text-button" type="button" onClick={addExperience}>Add role</button></div>{profile.experience.length === 0 && <p className="save-status">No confirmed roles yet.</p>}{profile.experience.map((item, index) => <fieldset className="record-editor" key={item.id}><legend>Role {index + 1}</legend><div className="form-columns"><label className="form-field">Title<input required value={item.title} onChange={(event) => updateExperience(index, { title: event.target.value })} /></label><label className="form-field">Employer<input required value={item.employer} onChange={(event) => updateExperience(index, { employer: event.target.value })} /></label></div><div className="form-columns"><label className="form-field">Start date<input value={item.startDate} onChange={(event) => updateExperience(index, { startDate: event.target.value })} /></label><label className="form-field">End date<input value={item.endDate} onChange={(event) => updateExperience(index, { endDate: event.target.value })} /></label></div><label className="form-field">Achievements <span className="field-help">One per line</span><textarea rows={4} value={item.achievements.join("\n")} onChange={(event) => updateExperience(index, { achievements: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) })} /></label><button className="text-button inline-assist" type="button" disabled={saving || !item.achievements.length} onClick={() => void improveSection(`${item.title || "Role"} achievements`, item.achievements.join("\n"), (value) => updateExperience(index, { achievements: value.split("\n").map((line) => line.replace(/^[•-]\s*/, "").trim()).filter(Boolean) }))}>Improve achievement wording</button><button className="text-button danger-text" type="button" onClick={() => field("experience", profile.experience.filter((_, itemIndex) => itemIndex !== index))}>Remove role</button></fieldset>)}</div>
      <div className="work-card form-grid"><div className="card-heading"><h3>Education</h3><button className="text-button" type="button" onClick={addEducation}>Add education</button></div>{profile.education.length === 0 && <p className="save-status">No confirmed education records yet.</p>}{profile.education.map((item, index) => <fieldset className="record-editor" key={item.id}><legend>Education {index + 1}</legend><label className="form-field">Qualification<input required value={item.qualification} onChange={(event) => updateEducation(index, { qualification: event.target.value })} /></label><label className="form-field">Institution<input required value={item.institution} onChange={(event) => updateEducation(index, { institution: event.target.value })} /></label><div className="form-columns"><label className="form-field">Start date<input value={item.startDate} onChange={(event) => updateEducation(index, { startDate: event.target.value })} /></label><label className="form-field">End date<input value={item.endDate} onChange={(event) => updateEducation(index, { endDate: event.target.value })} /></label></div><button className="text-button danger-text" type="button" onClick={() => field("education", profile.education.filter((_, itemIndex) => itemIndex !== index))}>Remove education</button></fieldset>)}</div>
    </section>
    <section className="profile-grid">
      <div className="work-card form-grid">
        <div className="card-heading"><h3>Projects</h3><button className="text-button" type="button" onClick={addProject}>Add project</button></div>
        {!profile.projects.length && <p className="save-status">Add work, personal, academic, or community projects that show what you can do.</p>}
        {profile.projects.map((item, index) => <fieldset className="record-editor" key={item.id}><legend>Project {index + 1}</legend><label className="form-field">Project name<input required value={item.name} onChange={(event) => updateProject(index, { name: event.target.value })} /></label><label className="form-field">What you contributed<textarea rows={3} value={item.description} onChange={(event) => updateProject(index, { description: event.target.value })} /></label><label className="form-field">Project link <span className="field-help">Optional</span><input type="url" value={item.link} onChange={(event) => updateProject(index, { link: event.target.value })} placeholder="https://" /></label><button className="text-button danger-text" type="button" onClick={() => field("projects", profile.projects.filter((_, itemIndex) => itemIndex !== index))}>Remove project</button></fieldset>)}
      </div>
      <div className="work-card form-grid">
        <div className="card-heading"><h3>Certifications</h3><button className="text-button" type="button" onClick={addCertification}>Add certification</button></div>
        {!profile.certifications.length && <p className="save-status">Add verified learning and professional credentials.</p>}
        {profile.certifications.map((item, index) => <fieldset className="record-editor" key={item.id}><legend>Certification {index + 1}</legend><label className="form-field">Certification name<input required value={item.name} onChange={(event) => updateCertification(index, { name: event.target.value })} /></label><div className="form-columns"><label className="form-field">Issuer<input value={item.issuer} onChange={(event) => updateCertification(index, { issuer: event.target.value })} /></label><label className="form-field">Date<input value={item.date} onChange={(event) => updateCertification(index, { date: event.target.value })} /></label></div><label className="form-field">Credential link <span className="field-help">Optional</span><input type="url" value={item.credentialUrl} onChange={(event) => updateCertification(index, { credentialUrl: event.target.value })} placeholder="https://" /></label><button className="text-button danger-text" type="button" onClick={() => field("certifications", profile.certifications.filter((_, itemIndex) => itemIndex !== index))}>Remove certification</button></fieldset>)}
      </div>
    </section>
    <section className="profile-grid">
      <div className="work-card form-grid">
        <div className="card-heading"><h3>Awards and personal achievements</h3><button className="text-button" type="button" onClick={addAward}>Add achievement</button></div>
        {!profile.awards.length && <p className="save-status">Add recognition that supports your professional story.</p>}
        {profile.awards.map((item, index) => <fieldset className="record-editor" key={item.id}><legend>Achievement {index + 1}</legend><label className="form-field">Type<select value={item.kind ?? ""} onChange={(event) => updateAward(index, { kind: event.target.value as "award" | "achievement" })} required><option value="">Choose type</option><option value="award">Award or recognition</option><option value="achievement">Achievement without a prize</option></select></label><label className="form-field">Title<input required value={item.title} onChange={(event) => updateAward(index, { title: event.target.value })} /></label><div className="form-columns"><label className="form-field">Issuer or organizer<input value={item.issuer} onChange={(event) => updateAward(index, { issuer: event.target.value })} /></label><label className="form-field">Date<input value={item.date} onChange={(event) => updateAward(index, { date: event.target.value })} /></label></div><label className="form-field">What happened<textarea rows={3} value={item.description} onChange={(event) => updateAward(index, { description: event.target.value })} /></label><button className="text-button danger-text" type="button" onClick={() => field("awards", profile.awards.filter((_, itemIndex) => itemIndex !== index))}>Remove achievement</button></fieldset>)}
      </div>
      <div className="work-card form-grid">
        <div className="card-heading"><h3>Publications</h3><button className="text-button" type="button" onClick={addPublication}>Add publication</button></div>
        {!profile.publications.length && <p className="save-status">Add articles, papers, books, or other published work.</p>}
        {profile.publications.map((item, index) => <fieldset className="record-editor" key={item.id}><legend>Publication {index + 1}</legend><label className="form-field">Title<input required value={item.title} onChange={(event) => updatePublication(index, { title: event.target.value })} /></label><div className="form-columns"><label className="form-field">Publisher<input value={item.publisher} onChange={(event) => updatePublication(index, { publisher: event.target.value })} /></label><label className="form-field">Date<input value={item.date} onChange={(event) => updatePublication(index, { date: event.target.value })} /></label></div><label className="form-field">Publication link <span className="field-help">Optional</span><input type="url" value={item.link} onChange={(event) => updatePublication(index, { link: event.target.value })} placeholder="https://" /></label><button className="text-button danger-text" type="button" onClick={() => field("publications", profile.publications.filter((_, itemIndex) => itemIndex !== index))}>Remove publication</button></fieldset>)}
      </div>
    </section>
    <section className="profile-grid">
      <div className="work-card form-grid">
        <div className="card-heading"><h3>Volunteer experience</h3><button className="text-button" type="button" onClick={addVolunteerExperience}>Add experience</button></div>
        {!profile.volunteerExperience.length && <p className="save-status">Add relevant community or nonprofit experience.</p>}
        {profile.volunteerExperience.map((item, index) => <fieldset className="record-editor" key={item.id}><legend>Volunteer role {index + 1}</legend><div className="form-columns"><label className="form-field">Role<input required value={item.role} onChange={(event) => updateVolunteerExperience(index, { role: event.target.value })} /></label><label className="form-field">Organization<input required value={item.organization} onChange={(event) => updateVolunteerExperience(index, { organization: event.target.value })} /></label></div><div className="form-columns"><label className="form-field">Start date<input value={item.startDate} onChange={(event) => updateVolunteerExperience(index, { startDate: event.target.value })} /></label><label className="form-field">End date<input value={item.endDate} onChange={(event) => updateVolunteerExperience(index, { endDate: event.target.value })} /></label></div><label className="form-field">Contribution<textarea rows={3} value={item.description} onChange={(event) => updateVolunteerExperience(index, { description: event.target.value })} /></label><button className="text-button danger-text" type="button" onClick={() => field("volunteerExperience", profile.volunteerExperience.filter((_, itemIndex) => itemIndex !== index))}>Remove volunteer role</button></fieldset>)}
      </div>
      <div className="work-card form-grid">
        <h3>Languages and professional links</h3>
        <label className="form-field">Languages you use <span className="field-help">Comma-separated; add any language relevant to your work.</span><textarea rows={3} value={languages} onChange={(event) => setLanguages(event.target.value)} placeholder="English, हिन्दी, Español, العربية, Français" /></label>
        <label className="form-field">Preferred guidance language<select value={profile.preferredLanguage} onChange={(event) => field("preferredLanguage", event.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="pt">Português</option><option value="ar">العربية</option><option value="zh">中文</option><option value="ja">日本語</option><option value="ko">한국어</option><option value="bn">বাংলা</option><option value="ta">தமிழ்</option><option value="te">తెలుగు</option><option value="mr">मराठी</option><option value="gu">ગુજરાતી</option><option value="pa">ਪੰਜਾਬੀ</option><option value="ur">اردو</option><option value="id">Bahasa Indonesia</option><option value="vi">Tiếng Việt</option><option value="th">ไทย</option><option value="tr">Türkçe</option><option value="ru">Русский</option></select><small className="field-help">Original names, employers, and resume content are preserved. Guidance uses this language when the approved provider supports it.</small></label>
        <div className="card-heading"><h3>Links</h3><button className="text-button" type="button" onClick={addLink}>Add link</button></div>
        {!profile.links.length && <p className="save-status">Add a portfolio, personal site, GitHub, or other professional page.</p>}
        {profile.links.map((item, index) => <fieldset className="record-editor" key={item.id}><legend>Link {index + 1}</legend><label className="form-field">Label<input required value={item.label} onChange={(event) => updateLink(index, { label: event.target.value })} placeholder="Portfolio" /></label><label className="form-field">Web address<input required type="url" value={item.url} onChange={(event) => updateLink(index, { url: event.target.value })} placeholder="https://" /></label><button className="text-button danger-text" type="button" onClick={() => field("links", profile.links.filter((_, itemIndex) => itemIndex !== index))}>Remove link</button></fieldset>)}
      </div>
    </section>
  </form>;
}
