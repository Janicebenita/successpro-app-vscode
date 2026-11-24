"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { CanonicalProfile } from "@successpro/contracts";
import { documentTemplates, type DocumentTemplateId, type PageSize } from "@successpro/domain";
import { resumeSectionIds, type ResumeSectionId } from "@/lib/document-request";

type DownloadKind = "resume" | "cover-letter" | "draft";
export type SavedDocumentDraft = { templateId: DocumentTemplateId; pageSize: PageSize; contact: { email: string; phone: string; location: string; linkedIn: string; website: string }; role: string; company: string; focus: string; jobDescription: string; tone: "warm" | "direct" | "executive"; recipientName: string; recipientTitle: string; companyAddress: string; letterText: string; sectionOrder?: ResumeSectionId[] };

const sectionLabels: Record<ResumeSectionId, string> = { summary: "Summary", skills: "Skills", experience: "Experience", projects: "Projects", education: "Education", certifications: "Credentials", awards: "Recognition", languages: "Languages", links: "Professional links", publications: "Publications", volunteer: "Volunteer work" };

function firstEvidence(profile: CanonicalProfile) {
  return profile.experience.flatMap((role) => role.achievements.map((achievement) => ({ role, achievement }))).slice(0, 3);
}

function makeDraft(profile: CanonicalProfile, role: string, company: string, focus: string) {
  const evidence = firstEvidence(profile);
  const skillList = profile.skills.slice(0, 5).join(", ");
  const current = profile.experience[0];
  return [
    `I am writing to apply for the ${role || "advertised role"} position at ${company || "your organisation"}. ${profile.summary || `I bring experience as ${profile.currentRole || profile.headline}.`} The opportunity appeals to me because ${focus || "it combines meaningful customer outcomes with the chance to contribute to a strong, collaborative team"}.`,
    `In my ${current ? `current role as ${current.title} at ${current.employer}` : "recent work"}, I have focused on turning complex priorities into practical results. ${evidence[0]?.achievement || "I have led important work across customer experience, delivery, and business improvement."} ${evidence[1]?.achievement || "I work closely with colleagues across functions to make sound decisions and deliver measurable progress."} These experiences have strengthened my ability to take ownership while keeping customers and colleagues at the centre of the work.`,
    `I would bring ${company || "the team"} a thoughtful, fact-based approach and proven strengths in ${skillList || "leadership, problem solving, communication, and delivery"}. ${evidence[2]?.achievement || "I am comfortable moving from strategy to execution, explaining choices clearly, and helping people work toward a shared outcome."} I value clear expectations, open communication, and steady follow-through, and I would use those principles to contribute quickly in the role.`,
    `What attracts me most is the chance to help ${company || "your organisation"} ${focus || "serve customers well and build lasting value"}. I would welcome the opportunity to discuss how my experience, judgement, and commitment to high-quality work could support your priorities. Thank you for considering my application; I look forward to the possibility of speaking with you.`,
  ];
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function filenameFromDisposition(value: string | null, fallback: string) {
  return value?.match(/filename="([^"]+)"/)?.[1] ?? fallback;
}

export function DocumentStudio({ profile, email, initialDraft }: { profile: CanonicalProfile; email: string; initialDraft?: SavedDocumentDraft | null }) {
  const linkedIn = profile.links.find((link) => /linkedin/i.test(link.label) || /linkedin\.com/i.test(link.url))?.url ?? "";
  const website = profile.links.find((link) => link.url !== linkedIn)?.url ?? "";
  const [templateId, setTemplateId] = useState<DocumentTemplateId>(initialDraft?.templateId ?? "clarity");
  const [pageSize, setPageSize] = useState<PageSize>(initialDraft?.pageSize ?? "a4");
  // An omitted order deliberately keeps the template's balanced default layout.
  // We only send an explicit order after the customer changes it.
  const [sectionOrder, setSectionOrder] = useState<ResumeSectionId[] | undefined>(initialDraft?.sectionOrder);
  const displayedSectionOrder = sectionOrder ?? [...resumeSectionIds];
  const [contact, setContact] = useState(initialDraft?.contact ?? { email, phone: "", location: profile.location, linkedIn, website });
  const [photoDataUri, setPhotoDataUri] = useState<string>();
  const [photoName, setPhotoName] = useState("");
  const [role, setRole] = useState(initialDraft?.role ?? profile.targetRoles[0] ?? "");
  const [company, setCompany] = useState(initialDraft?.company ?? "");
  const [focus, setFocus] = useState(initialDraft?.focus ?? "");
  const [jobDescription, setJobDescription] = useState(initialDraft?.jobDescription ?? "");
  const [tone, setTone] = useState<"warm" | "direct" | "executive">(initialDraft?.tone ?? "direct");
  const [recipientName, setRecipientName] = useState(initialDraft?.recipientName ?? "Hiring Manager");
  const [recipientTitle, setRecipientTitle] = useState(initialDraft?.recipientTitle ?? "");
  const [companyAddress, setCompanyAddress] = useState(initialDraft?.companyAddress ?? "");
  const [letterText, setLetterText] = useState(() => initialDraft?.letterText ?? makeDraft(profile, profile.targetRoles[0] ?? "", "", "").join("\n\n"));
  const [history, setHistory] = useState<string[]>([]); const [future, setFuture] = useState<string[]>([]); const initialRender = useRef(true);
  const [versions, setVersions] = useState<Array<{ id: string; savedAt: string; draft: SavedDocumentDraft }>>([]); const [showVersions, setShowVersions] = useState(false);
  const [busy, setBusy] = useState<DownloadKind>();
  const [message, setMessage] = useState("");
  const selected = documentTemplates.find((template) => template.id === templateId)!;
  const paragraphs = useMemo(() => letterText.split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean), [letterText]);
  const letterWords = wordCount(letterText);

  const draft = useMemo<SavedDocumentDraft>(() => ({ templateId, pageSize, contact, role, company, focus, jobDescription, tone, recipientName, recipientTitle, companyAddress, letterText, sectionOrder }), [templateId, pageSize, contact, role, company, focus, jobDescription, tone, recipientName, recipientTitle, companyAddress, letterText, sectionOrder]);
  useEffect(() => { if (initialRender.current) { initialRender.current = false; return; } const timer = window.setTimeout(async () => { const response = await fetch("/api/document-drafts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) }); if (response.ok) setMessage("Draft saved automatically."); }, 1_500); return () => window.clearTimeout(timer); }, [draft]);

  function changeLetter(value: string) { setHistory((items) => [...items.slice(-49), letterText]); setFuture([]); setLetterText(value); }
  function undoLetter() { const previous = history.at(-1); if (previous === undefined) return; setFuture((items) => [letterText, ...items].slice(0, 50)); setHistory((items) => items.slice(0, -1)); setLetterText(previous); }
  function redoLetter() { const next = future[0]; if (next === undefined) return; setHistory((items) => [...items, letterText].slice(-50)); setFuture((items) => items.slice(1)); setLetterText(next); }
  async function loadVersions() { const response = await fetch("/api/document-drafts/versions", { cache: "no-store" }); const body = await response.json(); if (response.ok) { setVersions(body.versions); setShowVersions(true); } else setMessage(body.error ?? "Unable to load draft history."); }
  function restoreVersion(value: SavedDocumentDraft) { setTemplateId(value.templateId); setPageSize(value.pageSize); setSectionOrder(value.sectionOrder); setContact(value.contact); setRole(value.role); setCompany(value.company); setFocus(value.focus); setJobDescription(value.jobDescription); setTone(value.tone); setRecipientName(value.recipientName); setRecipientTitle(value.recipientTitle); setCompanyAddress(value.companyAddress); changeLetter(value.letterText); setShowVersions(false); setMessage("Earlier draft restored. It will be saved as a new version."); }

  function updateContact(field: keyof typeof contact, value: string) {
    setContact((current) => ({ ...current, [field]: value }));
  }
  function moveSection(index: number, direction: -1 | 1) { const next = index + direction; if (next < 0 || next >= displayedSectionOrder.length) return; const updated = [...displayedSectionOrder]; [updated[index], updated[next]] = [updated[next], updated[index]]; setSectionOrder(updated); }

  function refreshDraft() {
    changeLetter(makeDraft(profile, role, company, focus).join("\n\n"));
    setMessage("A fresh draft is ready. Review every detail before downloading.");
  }

  async function createTailoredDraft() {
    if (!role || !company) { setMessage("Add the role and company before creating a tailored draft."); return; }
    setBusy("draft"); setMessage("Creating a draft from your confirmed career details…");
    try {
      const response = await fetch("/api/ai/generateCoverLetter", { method: "POST", signal: AbortSignal.timeout(90_000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, targetRole: role, company, jobDescription, tone }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The draft could not be created.");
      changeLetter(body.output.paragraphs.join("\n\n"));
      setMessage(body.meta.validation === "fallback" ? "A safe draft was created from your profile. Tailored writing suggestions are temporarily unavailable, so review and personalize it carefully." : "A tailored draft is ready. Confirm every name, number, and claim before using it.");
    } catch (error) { setMessage(error instanceof Error && error.name === "TimeoutError" ? "This draft took too long. Your current content is unchanged; please try again." : error instanceof Error ? error.message : "The draft could not be created."); }
    finally { setBusy(undefined); }
  }

  function choosePhoto(file?: File) {
    setMessage("");
    if (!file) return;
    if (!(["image/jpeg", "image/png"].includes(file.type)) || file.size > 2_000_000) {
      setPhotoDataUri(undefined);
      setPhotoName("");
      setMessage("Choose a JPG or PNG image smaller than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUri(String(reader.result));
      setPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function download(kind: DownloadKind, format: "pdf" | "docx" = "pdf") {
    setMessage("");
    if (kind === "cover-letter" && (letterWords < 250 || letterWords > 450 || paragraphs.length < 3)) {
      setMessage("Keep the letter between 250 and 450 words, with at least three short paragraphs.");
      return;
    }
    setBusy(kind);
    try {
      const shared = { templateId, pageSize, contact, sectionOrder, photoDataUri: selected.photo === "optional" ? photoDataUri : undefined };
      const body = kind === "resume" ? shared : {
        ...shared,
        letter: {
          date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date()),
          recipientName,
          recipientTitle,
          company,
          companyAddress,
          targetRole: role,
          greeting: `Dear ${recipientName || "Hiring Manager"},`,
          paragraphs,
          closing: "Yours sincerely,",
        },
      };
      const response = await fetch(`/api/documents/${kind}${format === "docx" ? "?format=docx" : ""}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "The document could not be created. Please try again.");
      }
      const href = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filenameFromDisposition(response.headers.get("Content-Disposition"), `${kind}.${format}`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setMessage(`${kind === "resume" ? "Resume" : "Cover letter"} downloaded as ${format.toUpperCase()} in the ${selected.name} style.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The document could not be created. Please try again.");
    } finally {
      setBusy(undefined);
    }
  }

  return <div className="document-studio">
    <section className="document-hero"><div><span className="section-kicker">RESUME & COVER LETTER</span><h2>Create a refined application set.</h2><p>Your career details remain editable. Choose a style, confirm contact details, and create a matching letter only when you need one.</p><div className="document-profile-facts"><span>{profile.experience.length} roles</span><span>{profile.skills.length} skills</span><span>{profile.education.length} education entries</span><span>{profile.certifications.length} credentials</span></div></div><div className="document-hero-actions"><Link className="button button-secondary" href="/profile?next=/documents">Refine career details</Link><Link className="text-button" href="/review?setup=profile&next=/documents">Use another resume</Link></div></section>
    <aside className="expert-writer-callout"><div><span className="section-kicker">ONE-TIME EXPERT SERVICE</span><h3>Want a professional writer to take it further?</h3><p>Choose a single resume-writing project or a coordinated resume, cover letter and LinkedIn package. It is a one-time purchase, never a subscription.</p></div><Link className="button button-dark" href="/billing#expert-writing">View expert writing options</Link></aside>
    <nav className="document-flow" aria-label="Document creation steps"><span className="active"><i>1</i> Resume style</span><span><i>2</i> Contact details</span><span><i>3</i> Cover letter</span></nav>

    <section className="work-card document-section" aria-labelledby="style-heading">
      <div className="document-section-heading"><div><span>STEP 1</span><h3 id="style-heading">Choose your style</h3></div><label>Page size<select value={pageSize} onChange={(event) => setPageSize(event.target.value as PageSize)}><option value="a4">A4</option><option value="letter">US Letter</option></select></label></div>
      <div className="template-grid">
        {documentTemplates.map((template) => <button type="button" className={`template-card template-${template.id}${template.id === templateId ? " selected" : ""}`} onClick={() => setTemplateId(template.id)} aria-pressed={template.id === templateId} key={template.id}>
          <span className="template-sheet" aria-hidden="true"><i /><b /><b /><em /><em /><em /></span>
          <strong>{template.name}</strong><small>{template.summary}</small><span>{template.atsConfidence === "highest" ? "Best for online applications" : "Strong for online applications"} · {template.photo === "optional" ? "Photo optional" : "No photo"}</span>
        </button>)}
      </div>
    </section>

    <section className="work-card document-section section-arranger" aria-labelledby="section-order-heading">
      <div className="document-section-heading"><div><span>OPTIONAL REFINEMENT</span><h3 id="section-order-heading">Set the reading order</h3></div><button type="button" className="text-button" onClick={() => setSectionOrder(undefined)}>Restore recommended order</button></div>
      <p className="document-note">The recommended sequence works for most applications. Move a section only when the target role makes another part of your experience more important. Your PDF and Word file will use the same sequence.</p>
      <ol className="section-order-list">{displayedSectionOrder.map((section, index) => <li key={section}><span>{String(index + 1).padStart(2, "0")}</span><strong>{sectionLabels[section]}</strong><div><button type="button" aria-label={`Move ${sectionLabels[section]} earlier`} disabled={index === 0} onClick={() => moveSection(index, -1)}>↑</button><button type="button" aria-label={`Move ${sectionLabels[section]} later`} disabled={index === displayedSectionOrder.length - 1} onClick={() => moveSection(index, 1)}>↓</button></div></li>)}</ol>
    </section>

    <div className="document-layout">
      <section className="work-card document-section">
        <div className="document-section-heading"><div><span>STEP 2</span><h3>Check your contact details</h3></div></div>
        <div className="form-columns document-fields">
          <label className="form-field">Email<input type="email" value={contact.email} onChange={(event) => updateContact("email", event.target.value)} required /></label>
          <label className="form-field">Phone<input value={contact.phone} onChange={(event) => updateContact("phone", event.target.value)} placeholder="Optional" /></label>
          <label className="form-field">Location<input value={contact.location} onChange={(event) => updateContact("location", event.target.value)} /></label>
          <label className="form-field">LinkedIn URL<input type="url" value={contact.linkedIn} onChange={(event) => updateContact("linkedIn", event.target.value)} placeholder="https://linkedin.com/in/..." /></label>
          <label className="form-field">Portfolio or website<input type="url" value={contact.website} onChange={(event) => updateContact("website", event.target.value)} placeholder="https://..." /></label>
        </div>
        {selected.photo === "optional" ? <div className="photo-control"><div><strong>Professional photograph</strong><span>Optional. Use a clear, recent head-and-shoulders JPG or PNG.</span></div><label className="button button-dark">{photoName ? "Change photo" : "Add photo"}<input className="sr-only" type="file" accept="image/jpeg,image/png" onChange={(event) => choosePhoto(event.target.files?.[0])} /></label>{photoName && <button className="text-button" type="button" onClick={() => { setPhotoDataUri(undefined); setPhotoName(""); }}>Remove</button>}</div> : <p className="document-note">Clarity keeps the resume image-free for the most reliable online application experience.</p>}
        <div className="document-draft-actions"><button className="button button-primary" type="button" disabled={!!busy || !contact.email} onClick={() => download("resume", "pdf")}>{busy === "resume" ? "Creating your resume…" : `Download ${selected.name} PDF`}</button><button className="button button-secondary" type="button" disabled={!!busy || !contact.email} onClick={() => download("resume", "docx")}>Download editable Word file</button></div>
      </section>

      <aside className={`document-preview preview-${templateId}`} aria-label={`${selected.name} style preview`}>
        <div className="preview-photo">{photoDataUri && selected.photo === "optional" ? <Image src={photoDataUri} alt="Your selected portrait" width={100} height={100} unoptimized /> : profile.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
        <h3>{profile.fullName}</h3><strong>{profile.headline}</strong><span>{contact.email}{contact.phone ? ` · ${contact.phone}` : ""}</span><hr /><p>{profile.summary}</p><h4>Professional experience</h4>{profile.experience.slice(0, 2).map((item) => <div className="preview-role" key={item.id}><b>{item.title}</b><span>{item.employer}</span><i /></div>)}
      </aside>
    </div>

    <section className="work-card document-section cover-letter-builder">
      <div className="document-section-heading"><div><span>STEP 3</span><h3>Create the matching cover letter</h3></div><span className={letterWords >= 250 && letterWords <= 450 ? "word-count valid" : "word-count"}>{letterWords} words</span></div>
      <p className="document-note">Tell us about the opportunity, create a starting draft from your profile, then edit it in your own voice. The downloaded letter always uses the selected {selected.name} style.</p>
      <div className="form-columns document-fields">
        <label className="form-field">Role<input value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Head of Product" /></label>
        <label className="form-field">Company<input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company name" /></label>
        <label className="form-field">Recipient<input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Hiring Manager" /></label>
        <label className="form-field">Recipient title<input value={recipientTitle} onChange={(event) => setRecipientTitle(event.target.value)} placeholder="Optional" /></label>
        <label className="form-field">Company address<input value={companyAddress} onChange={(event) => setCompanyAddress(event.target.value)} placeholder="Optional" /></label>
        <label className="form-field">Why this opportunity?<input value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="A short, specific reason" /></label>
        <label className="form-field">Writing style<select value={tone} onChange={(event) => setTone(event.target.value as typeof tone)}><option value="direct">Clear and direct</option><option value="warm">Warm and personal</option><option value="executive">Concise and senior</option></select></label>
      </div>
      <label className="form-field">Job description <span className="field-help">Optional, but helps tailor the letter accurately</span><textarea rows={8} value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the job description here…" /></label>
      <div className="document-draft-actions"><button className="button button-dark draft-button" type="button" disabled={!!busy} onClick={() => void createTailoredDraft()}>{busy === "draft" ? "Creating your draft…" : "Create a tailored draft"}</button><button className="text-button" type="button" disabled={!!busy} onClick={refreshDraft}>Create from profile only</button></div>
      <div className="document-draft-actions"><button className="text-button" type="button" onClick={undoLetter} disabled={!history.length}>Undo</button><button className="text-button" type="button" onClick={redoLetter} disabled={!future.length}>Redo</button><button className="text-button" type="button" onClick={() => void loadVersions()}>Version history</button><span className="document-note">Changes save automatically with version history.</span></div>
      {showVersions && <div className="draft-version-list"><div className="card-heading"><h4>Recent saved versions</h4><button className="text-button" type="button" onClick={() => setShowVersions(false)}>Close</button></div>{versions.length ? versions.map((version) => <button type="button" key={version.id} onClick={() => restoreVersion(version.draft)}><strong>{version.draft.company || "Untitled application"}</strong><span>{version.draft.role || "Role not added"}</span><small>{version.savedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.savedAt)) : "Saved version"}</small></button>) : <p>No earlier versions yet.</p>}</div>}
      <label className="form-field letter-editor">Cover letter<textarea rows={16} value={letterText} onChange={(event) => changeLetter(event.target.value)} aria-describedby="letter-guidance" /></label>
      <p className="document-note" id="letter-guidance">Use 250–450 words and separate each paragraph with a blank line. Check names, numbers, and claims before sending.</p>
      <div className="document-draft-actions"><button className="button button-primary" type="button" disabled={!!busy || !role || !company} onClick={() => download("cover-letter", "pdf")}>{busy === "cover-letter" ? "Creating your cover letter…" : `Download matching ${selected.name} PDF`}</button><button className="button button-secondary" type="button" disabled={!!busy || !role || !company} onClick={() => download("cover-letter", "docx")}>Download matching Word file</button></div>
    </section>
    {message && <p className="document-message" role="status">{message}</p>}
  </div>;
}
