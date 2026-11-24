"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DocumentSignals, FactorResult, JobMatchResult, ResumeAnalysisResult } from "@successpro/contracts";
import type { AiTaskOutput, AiRunMeta } from "@successpro/contracts/ai";
import { validateResumeUpload, extractCanonicalProfile } from "@successpro/domain";
import { WorkbookReview } from "./workbook-review";
import { ExternalAiConsent } from "./external-ai-consent";
import { OperationProgress, type OperationProgressState } from "./operation-progress";

const idleProgress: OperationProgressState = { active: false, percent: 0, title: "", detail: "", steps: [], currentStep: 0 };

type ReviewApiResponse = {
  error?: string;
  consentRequired?: boolean;
  result?: ResumeAnalysisResult;
  assistant?: { output: AiTaskOutput<"analyzeResume">; meta: AiRunMeta } | null;
  remaining?: number | null;
  testingExempt?: boolean;
  reviewStatus?: "completed" | "partial";
  allowanceUsed?: number;
  analysisId?: string;
  isReused?: boolean;
  input?: { text?: string; jobDescription?: string; processingJobId?: string; documentSignals?: DocumentSignals };
};

const nativePipeline = process.env.NEXT_PUBLIC_RESUME_NATIVE_PIPELINE_ENABLED === "true";

export function cleanSkillName(skill: string): string {
  return skill
    .replace(/^[•●▪◦*\-–—\d.)\s]+/, "")
    .replace(/[-–—\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isValidSkill(skill: string): boolean {
  if (!skill) return false;
  const s = cleanSkillName(skill);
  if (s.length < 2 || s.length > 70) return false;
  if (!/[\p{L}]/u.test(s)) return false;
  if (/^[-–—\s]*(?:page\s*)?\d+\s*(?:of|\/)\s*\d+[-–—\s]*$/i.test(s)) return false;
  if (/^[-–—\s]*(?:page\s*\d+|\d+)[-–—\s]*$/i.test(s)) return false;
  if (/@|https?:\/\/|www\./i.test(s) || /^\+?\d[\d\s\-()]{7,}$/.test(s)) return false;
  if (/^(?:curriculum vitae|resume|profile|summary|contact|experience|education|skills|page|references)$/i.test(s)) return false;
  return true;
}

function autoExtractSkills(sourceText: string): string[] {
  if (!sourceText || sourceText.trim().length < 80) return [];
  try {
    const profile = extractCanonicalProfile(sourceText);
    const rawSkills = profile.draft.skills ?? [];
    const cleaned = rawSkills.map(cleanSkillName).filter(isValidSkill);
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const skill of cleaned) {
      const lower = skill.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(skill);
      }
    }
    return unique;
  } catch {
    return [];
  }
}

export function ResumeReview({ externalAiConsentAccepted = false }: { externalAiConsentAccepted?: boolean }) {
  const [text, setText] = useState("");
  const [keywords, setKeywords] = useState("");
  const [result, setResult] = useState<ResumeAnalysisResult | null>(null);
  const [guidance, setGuidance] = useState<{ output: AiTaskOutput<"analyzeResume">; meta: AiRunMeta } | null>(null);
  const [factorGuidance, setFactorGuidance] = useState<Record<string, { output: AiTaskOutput<"explainResumeIssue">; meta: AiRunMeta }>>({});
  const [explainingFactor, setExplainingFactor] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [jobSource, setJobSource] = useState("");
  const [jobMatch, setJobMatch] = useState<JobMatchResult | null>(null);
  const [jdMessage, setJdMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [message, setMessage] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [testingExempt, setTestingExempt] = useState(true);
  const [aiConsentAccepted, setAiConsentAccepted] = useState(externalAiConsentAccepted);
  const [working, setWorking] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [analysisId, setAnalysisId] = useState("");
  const [isReused, setIsReused] = useState(false);
  const [previewTier, setPreviewTier] = useState<"paid" | "free">("paid");
  const [uploadMessage, setUploadMessage] = useState(nativePipeline ? "Upload any PDF or DOCX up to 20 MB and 25 pages." : "Upload a PDF, Word (.doc or .docx), or TXT file up to 10 MB.");
  const [uploading, setUploading] = useState(false);
  const [documentSignals, setDocumentSignals] = useState<DocumentSignals>({});
  const [nativeJobId, setNativeJobId] = useState("");
  const [nativeProfile, setNativeProfile] = useState<Record<string, unknown>>({});
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState<OperationProgressState>(idleProgress);
  const [reviewProgress, setReviewProgress] = useState<OperationProgressState>(idleProgress);
  const [testingFallback, setTestingFallback] = useState(false);
  const [fallbackTestResult, setFallbackTestResult] = useState<{
    status?: string;
    isFallbackTriggered?: boolean;
    executedModel?: string;
    fallbackDepth?: number;
    latencyMs?: number;
    error?: string;
    explanation?: string;
    configuredPrimary?: string;
    configuredFallback?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prioritized = useMemo(() => result?.factors.slice().sort((a, b) => (a.earned / a.maximum) - (b.earned / b.maximum)).slice(0, 3) ?? [], [result]);
  useEffect(() => { const accepted = () => { setAiConsentAccepted(true); setMessage(""); }; window.addEventListener("successpro:ai-consent-accepted", accepted); return () => window.removeEventListener("successpro:ai-consent-accepted", accepted); }, []);

  // Automatically detect and populate target skills if keywords is empty or contains only invalid document artifacts
  useEffect(() => {
    if (!text || text.trim().length < 80) return;
    const validCurrent = keywords.split(",").map(cleanSkillName).filter(isValidSkill);
    if (validCurrent.length === 0) {
      const detected = autoExtractSkills(text);
      if (detected.length > 0) {
        setKeywords(detected.slice(0, 15).join(", "));
      }
    }
  }, [text, keywords]);
  useEffect(() => {
    let cancelled = false;
    async function restorePersistedReview() {
      const urlParams = new URL(window.location.href).searchParams;
      const requestedJobId = urlParams.get("processingJobId")?.trim();
      const savedAnalysisId = urlParams.get("analysisId")?.trim();
      if (savedAnalysisId) {
        const response = await fetch("/api/reviews?analysisId=" + encodeURIComponent(savedAnalysisId), { cache: "no-store" });
        const saved = await response.json().catch(() => ({})) as ReviewApiResponse;
        if (!cancelled && response.ok && saved.result) {
          setResult(saved.result);
          setGuidance(saved.assistant ?? null);
          if (saved.reviewStatus === "partial") {
            setConfirmationMessage("This is a saved partial report. Select Review my resume to retry the pending assessment, including visual inspection when needed.");
          }
          setAnalysisId(saved.analysisId ?? savedAnalysisId);
          setIsReused(Boolean(saved.isReused));
          setText(saved.input?.text ?? "");
          setJobDescription(saved.input?.jobDescription ?? "");
          setDocumentSignals(saved.input?.documentSignals ?? {});
          setNativeJobId(saved.input?.processingJobId ?? "");
          setDraftReady(Boolean(saved.input?.text));
          return;
        }
      }
      if (!requestedJobId) return;
      const response = await fetch("/api/resumes/native/" + encodeURIComponent(requestedJobId), { cache: "no-store" });
      const saved = await response.json().catch(() => ({})) as { status?: string; extraction?: { text?: string; signals?: DocumentSignals; profile?: Record<string, unknown> }; analysis?: { profile?: Record<string, unknown> } };
      if (cancelled || !response.ok || !["awaiting_review", "completed"].includes(saved.status ?? "")) return;
      const extraction = saved.extraction ?? {};
      setNativeJobId(requestedJobId);
      setNativeProfile(saved.analysis?.profile ?? extraction.profile ?? {});
      setText(extraction.text ?? "");
      if (extraction.text && extraction.text.trim().length >= 80) {
        const detected = autoExtractSkills(extraction.text);
        if (detected.length > 0) {
          setKeywords(detected.slice(0, 15).join(", "));
        }
      }
      setDocumentSignals(extraction.signals ?? {});
      setDraftReady(Boolean(extraction.text));
      setUploadMessage("Your requested resume and visual evidence were loaded.");
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("successpro:last-analysis");
        window.sessionStorage.setItem("successpro:last-native-job", requestedJobId);
      }
    }
    void restorePersistedReview();
    return () => { cancelled = true; };
  }, []);

  async function waitForNativeJob(jobId: string, updateProgress = true, timeoutMs = 15 * 60_000) {
    const startedAt = Date.now();
    const deadline = startedAt + timeoutMs;
    let queuedSince: number | null = null;
    while (Date.now() < deadline) {
      const response = await fetch(`/api/resumes/native/${encodeURIComponent(jobId)}`, { cache: "no-store" });
      const status = await response.json() as { status?: string; extraction?: { text?: string; signals?: DocumentSignals; profile?: Record<string, unknown> }; analysis?: { profile?: Record<string, unknown> }; error?: string };
      if (!response.ok) throw new Error(status.error ?? "Unable to read the local processing result.");
      if (["failed", "dead_letter", "cancelled"].includes(status.status ?? "")) throw new Error(status.error ?? "The local worker could not process this resume.");
      if (["awaiting_review", "completed"].includes(status.status ?? "")) return status;
      if (status.status === "queued") queuedSince ??= Date.now(); else queuedSince = null;
      if (updateProgress) {
        const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
        const workerIdle = queuedSince !== null && Date.now() - queuedSince > 30_000;
        // Progress follows elapsed time (approaching, never reaching, 98%) instead of freezing at 94%.
        const percent = Math.min(98, Math.round(64 + 34 * (1 - Math.exp(-elapsedSeconds / 60))));
        setUploadProgress((current) => status.status === "queued"
          ? { ...current, active: true, percent: 62, title: workerIdle ? "Document processor is not running" : "Waiting for local processing", detail: workerIdle ? "The upload is saved, but no worker has picked it up for 30+ seconds. Check that the “SuccessPro - Worker” window is open (start-successpro.bat)." : "Your upload is saved, but the document processor has not started this job yet.", currentStep: 1 }
          : {
              ...current,
              active: true,
              percent,
              title: "Analyzing document & visual layout",
              detail: (elapsedSeconds >= 20 ? "Running Gemini Vision and multi-page layout analysis…" : "Extracting native text and checking page structure…") + ` (${elapsedSeconds}s)`,
              currentStep: 2
            });
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1_500));
    }
    throw new Error("Local processing timed out. The worker may still finish; refresh before uploading again.");
  }

  async function confirmNativeProfile() {
    if (!nativeJobId) return;
    setConfirmationMessage("Saving your confirmed values…");
    const response = await fetch(`/api/resumes/native/${encodeURIComponent(nativeJobId)}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: nativeProfile, removedFields: [] }) });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setConfirmationMessage(response.ok ? "Your corrections are confirmed and stored separately from the AI extraction." : body.error ?? "Unable to save the confirmed profile.");
  }

  function clearResume() {
    setText("");
    setKeywords("");
    setResult(null);
    setGuidance(null);
    setFactorGuidance({});
    setJobMatch(null);
    setAnalysisId("");
    setNativeJobId("");
    setIsReused(false);
    setNativeProfile({});
    setDocumentSignals({});
    setMessage("");
    setConfirmationMessage("");
    setDraftReady(false);
    setUploadProgress(idleProgress);
    setReviewProgress(idleProgress);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("successpro:last-analysis");
      window.sessionStorage.removeItem("successpro:last-native-job");
      if (window.location.search) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
    setUploadMessage(nativePipeline ? "Upload any PDF or DOCX up to 20 MB and 25 pages." : "Upload a PDF, Word (.doc or .docx), or TXT file up to 10 MB.");
  }

  async function inspectFile(file: File | undefined) {
    if (!file) return;
    const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const validation = nativePipeline
      ? { valid: (file.name.toLowerCase().endsWith(".pdf") || file.name.toLowerCase().endsWith(".docx")) && file.size <= 20 * 1024 * 1024, message: "Please upload a PDF or DOCX up to 20 MB." }
      : validateResumeUpload({ name: file.name, mimeType: file.type, size: file.size, signature });
    setUploadMessage(validation.valid ? `Uploading ${file.name} securely…` : validation.message);
    if (!validation.valid) return;
    // A new file must never inherit the previous resume's text, signals, skills, or
    // score while the background worker is still rendering its pages.
    setResult(null);
    setGuidance(null);
    setFactorGuidance({});
    setJobMatch(null);
    setAnalysisId("");
    setNativeJobId("");
    setIsReused(false);
    setNativeProfile({});
    setDocumentSignals({});
    setText("");
    setKeywords("");
    setMessage("");
    setConfirmationMessage("");
    setReviewProgress(idleProgress);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("successpro:last-analysis");
      window.sessionStorage.removeItem("successpro:last-native-job");
      if (window.location.search) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
    setUploading(true);
    setDraftReady(false);
    const uploadSteps = ["Secure upload", "Read document", "Organize details", "Ready to review"];
    setUploadProgress({ active: true, percent: 3, title: "Uploading your resume", detail: "Starting a secure upload…", steps: uploadSteps, currentStep: 0 });
    try {
      const form = new FormData();
      form.set("resume", file);
      let { ok, status, body } = await new Promise<{ ok: boolean; status: number; body: Record<string, unknown> }>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", "/api/resumes");
        request.upload.onprogress = (event) => { if (event.lengthComputable) { const percent = Math.min(55, Math.max(5, Math.round((event.loaded / event.total) * 55))); setUploadProgress({ active: true, percent, title: "Uploading your resume", detail: `${Math.round(event.loaded / 1024).toLocaleString()} KB of ${Math.round(event.total / 1024).toLocaleString()} KB sent`, steps: uploadSteps, currentStep: 0 }); } };
        request.upload.onload = () => setUploadProgress({ active: true, percent: 62, title: "Reading your document", detail: "The upload is complete. We’re now reading its content and layout.", steps: uploadSteps, currentStep: 1 });
        request.onload = () => { let body: Record<string, unknown> = {}; try { body = JSON.parse(request.responseText) as Record<string, unknown>; } catch { /* handled by the caller */ } resolve({ ok: request.status >= 200 && request.status < 300, status: request.status, body }); };
        request.onerror = () => reject(new Error("UPLOAD_INTERRUPTED"));
        request.send(form);
      });
      if (ok && status === 202 && typeof body.processingJobId === "string") {
        const jobId = body.processingJobId;
        setNativeJobId(jobId);
        window.sessionStorage.setItem("successpro:last-native-job", jobId);
        if (typeof body.text === "string") setText(body.text);
        const previewText = typeof body.text === "string" ? body.text : "";
        try {
          // The text preview is already readable, so cap the wait; visual inspection is retried at review time.
          const completed = await waitForNativeJob(jobId, true, previewText.trim().length >= 80 ? 4 * 60_000 : 15 * 60_000);
          const extraction = completed.extraction ?? {};
          const profile = completed.analysis?.profile ?? extraction.profile ?? {};
          setNativeProfile(profile);
          body = { text: extraction.text ?? "", signals: extraction.signals ?? {}, message: "Native extraction is ready for your review." };
        } catch (waitError) {
          if (previewText.trim().length < 80) throw waitError;
          body = { text: previewText, signals: body.signals ?? {}, message: "Your resume text is ready. Page inspection is taking longer than usual, so the design score may stay pending until page inspection finishes." };
        }
        status = 200;
        ok = true;
      }
      if (typeof body.text === "string" && body.text.trim()) {
        setText(body.text);
        if (body.text.trim().length >= 80) {
          const detected = autoExtractSkills(body.text);
          if (detected.length > 0) {
            setKeywords(detected.slice(0, 15).join(", "));
          }
        }
      }
      if (!ok) {
        setUploadProgress({ active: false, percent: 0, title: "", detail: "", steps: [], currentStep: 0 });
        setUploadMessage(typeof body.error === "string" ? body.error : status === 413 ? "This file is too large to upload." : "Unable to process this document. Please try again.");
        return;
      }
      if (typeof body.text !== "string" || body.text.trim().length < 20) {
        setUploadMessage("We could not find enough readable text. Try a clearer PDF or Word file.");
        setUploadProgress({ active: false, percent: 0, title: "", detail: "", steps: [], currentStep: 0 });
        return;
      }
      setUploadProgress({ active: true, percent: 100, title: "Resume upload complete", detail: "Your content and layout are ready for the next step.", steps: uploadSteps, currentStep: 3 });
      setDraftReady(true);
      setDocumentSignals(body.signals ?? {});
      setUploadMessage(typeof body.message === "string" ? body.message : "Your resume was uploaded and read successfully.");
    } catch {
      setUploadProgress({ active: false, percent: 0, title: "", detail: "", steps: [], currentStep: 0 });
      setUploadMessage("The upload was interrupted. Check your connection and try again; your review allowance was not used.");
    } finally {
      setUploading(false);
    }
  }

  async function runReview(forceReReview = false, overrideJd?: string) {
    if (!aiConsentAccepted) { setMessage("Accept the data-use terms below before running your Resume Checker review."); return; }
    setWorking(true);
    setMessage("");
    setConfirmationMessage("");
    const steps = ["Read content", "Check structure", "Assess presentation", "Prepare guidance"];
    setReviewProgress({ active: true, percent: 7, title: "Your resume check is underway", detail: "Reading the complete resume…", steps, currentStep: 0 });
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const percent = Math.min(95, 12 + Math.floor(elapsed / 90));
      const currentStep = percent < 30 ? 0 : percent < 55 ? 1 : percent < 75 ? 2 : 3;
      const detail = [
        "Reading the complete resume…",
        "Checking sections, skills, evidence, and chronology…",
        "Reviewing readability, layout, and visual presentation…",
        "Preparing your prioritized expert guidance…",
      ][currentStep];
      setReviewProgress({ active: true, percent, title: "Your resume check is underway", detail, steps, currentStep });
    }, 180);
    const targetKeywords = keywords.split(",").map(cleanSkillName).filter(isValidSkill);
    let activeJd = (overrideJd ?? jobDescription).trim();
    if (!activeJd.trim() && jobUrl.trim().length >= 10) {
      try {
        const jdResp = await fetch("/api/job-description-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: jobUrl }) });
        const jdBody = await jdResp.json().catch(() => ({}));
        if (jdResp.ok && jdBody.text) {
          activeJd = jdBody.text;
          setJobDescription(activeJd);
          setJobSource(jdBody.sourceUrl);
        }
      } catch {
        // Continue with empty JD if fetch fails
      }
    }
    if (nativeJobId && result?.v2 && result.v2.pillars.visual.state !== "Assessed") {
      try {
        const retry = await fetch("/api/resumes/native/" + encodeURIComponent(nativeJobId), { method: "POST" });
        if (retry.status === 202) await waitForNativeJob(nativeJobId, false, 150_000);
      } catch {
        // The review can still show confirmed content while visual inspection is unavailable.
      }
    }
    let response: Response;
    let body: ReviewApiResponse;
    try {
      const activeJobId = nativeJobId || "";
      response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(180_000),
        body: JSON.stringify({ text, targetKeywords, jobDescription: activeJd, documentSignals, forceReReview, ...(activeJobId ? { processingJobId: activeJobId } : {}) })
      });
      body = await response.json().catch(() => ({ error: response.ok ? "Unexpected response format." : `Review service returned an error (${response.status}). Please try again.` }));
    } catch {
      window.clearInterval(timer);
      setReviewProgress(idleProgress);
      setMessage("We couldn’t confirm the review result. Check your saved reports before retrying; your connection may have ended after the report was saved.");
      setWorking(false);
      return;
    }
    window.clearInterval(timer);
    if (!response.ok) {
      if (response.status === 428 || body.consentRequired === true) setAiConsentAccepted(false);
      setMessage(body.error ?? "Unable to complete the review.");
      setWorking(false);
      setReviewProgress(idleProgress);
      return;
    }
    if (!body.result) {
      setMessage("We couldn’t display the review result. Check your saved reports before retrying.");
      setWorking(false);
      setReviewProgress(idleProgress);
      return;
    }
    if (overrideJd === undefined && activeJd.length >= 80) {
      await loadJobMatch(activeJd);
    }
    setResult(body.result);
    setGuidance(body.assistant ?? null);
    setRemaining(body.remaining ?? null);
    setTestingExempt(body.testingExempt === true);
    setAnalysisId(body.analysisId ?? "");
    setIsReused(Boolean(body.isReused));
    if (body.analysisId) window.sessionStorage.setItem("successpro:last-analysis", body.analysisId);
    const isCompleted = body.reviewStatus ? body.reviewStatus === "completed" : Boolean(body.assistant);
    const partial = !isCompleted;
    if (body.isReused && !forceReReview) {
      setMessage("");
    } else {
      if (forceReReview) {
        setConfirmationMessage("Resume re-evaluated by model. Content & visual scores preserved.");
      }
      if (partial) {
        setConfirmationMessage(body.allowanceUsed === 0 ? "Your partial report is saved. The expert assessment is pending. No review allowance was used. Select Review my resume to try again." : "Your basic findings are ready, but personalized guidance could not be completed. You can retry for the full review.");
      }
    }
    setReviewProgress({ active: false, percent: 100, title: partial ? "Basic findings are ready" : "Your resume check is complete", detail: partial ? "Personalized guidance still needs another attempt." : "Your score, evidence, and prioritized guidance are ready below.", steps, currentStep: 3 });
    setWorking(false);
  }

  async function loadJobMatch(jdToCompare: string) {
    try {
      const response = await fetch("/api/job-match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resumeText: text, jobDescription: jdToCompare }) });
      const body = await response.json();
      if (!response.ok) {
        setJdMessage({ text: body.error ?? "Unable to compare this job description.", isError: true });
        return false;
      }
      setJobMatch(body.result);
      setJdMessage({ text: `Job match: ${body.result.score}%. See matching and missing skills below.`, isError: false });
      return true;
    } catch {
      setJdMessage({ text: "Unable to compare this job description.", isError: true });
      return false;
    }
  }

  async function compareJob(overrideJd?: string) {
    const jdToCompare = (overrideJd ?? jobDescription).trim();
    if (text.trim().length < 80) {
      setJdMessage({ text: "Upload or paste your resume above first so we can check it against this job.", isError: true });
      return;
    }
    if (jdToCompare.length < 80) {
      setJdMessage({ text: "Please enter a complete job description or URL to check your match.", isError: true });
      return;
    }
    setWorking(true);
    setJdMessage({ text: "Comparing your resume against the job description…", isError: false });
    try {
      const matched = await loadJobMatch(jdToCompare);
      if (matched && aiConsentAccepted) await runReview(false, jdToCompare);
    } finally {
      setWorking(false);
    }
  }

  async function openJobUrl(autoCompare = true) {
    if (jobUrl.trim().length < 10) return;
    setWorking(true);
    setJdMessage({ text: "⏳ Reading and verifying job description from link…", isError: false });
    try {
      const response = await fetch("/api/job-description-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: jobUrl }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setJobSource("");
        if (jobDescription.trim().length >= 80 && autoCompare) {
          setJdMessage({
            text: `⚠️ Link connection timed out, but checking match using your pasted job description below!`,
            isError: false,
          });
          await compareJob(jobDescription.trim());
        } else {
          setJdMessage({ text: body.error ?? "Unable to read that job page safely. Paste the description below instead.", isError: true });
        }
      } else {
        setJobDescription(body.text);
        setJobSource(body.sourceUrl);
        const headerInfo = [body.title, body.company].filter(Boolean).join(" · ");
        const roleLabel = headerInfo ? `${headerInfo} (${body.text.length.toLocaleString()} chars)` : `${body.text.length.toLocaleString()} chars`;
        if (autoCompare && text.trim().length >= 80) {
          setJdMessage({ text: `✓ Verified: ${roleLabel}. Checking match with your resume…`, isError: false });
          await compareJob(body.text);
        } else if (text.trim().length < 80) {
          setJdMessage({ text: `✓ Verified: ${roleLabel}. Upload your resume above to check your match.`, isError: false });
        } else {
          setJdMessage({ text: `✓ Verified: ${roleLabel}.`, isError: false });
        }
      }
    } catch {
      if (jobDescription.trim().length >= 80 && autoCompare) {
        setJdMessage({
          text: `⚠️ Link fetch timed out, but checking match using your pasted job description below!`,
          isError: false,
        });
        await compareJob(jobDescription.trim());
      } else {
        setJdMessage({ text: "The job page could not be opened. Paste the description below instead.", isError: true });
      }
    } finally {
      setWorking(false);
    }
  }

  async function explainFactor(item: FactorResult) {
    setExplainingFactor(item.id);
    const issue = item.issues.map((entry) => `${entry.severity}: ${entry.message}`).join(" ") || item.action;
    const endpoint = analysisId ? `/api/reviews/${analysisId}/explain` : "/api/ai/explainResumeIssue";
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ factorId: item.id, factor: item.label, evidence: item.evidence, issue, targetRole: keywords.split(",")[0]?.trim() ?? "" }) });
    const body = await response.json();
    if (response.ok) setFactorGuidance((current) => ({ ...current, [item.id]: body }));
    else setMessage(body.error ?? "Unable to explain this result right now.");
    setExplainingFactor("");
  }

  return (
    <div className="review-workspace">
      {/* Global Developer Preview Toggle Bar (Always visible at top of page) */}
      <div style={{ gridColumn: "1 / -1", background: "linear-gradient(135deg, rgba(240, 249, 255, 0.95), rgba(224, 242, 254, 0.85))", border: "1.5px solid #0284c7", borderRadius: "14px", padding: "1rem 1.4rem", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem", boxShadow: "0 4px 16px rgba(2, 132, 199, 0.12)", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <span style={{ fontSize: "1.6rem" }}>🛠️</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <strong style={{ color: "#0369a1", fontSize: "1.05rem", fontWeight: 800 }}>DEVELOPER TESTING MODE</strong>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", padding: "2px 8px", borderRadius: "12px", background: previewTier === "paid" ? "#dcfce7" : "#fef3c7", color: previewTier === "paid" ? "#15803d" : "#b45309", border: `1px solid ${previewTier === "paid" ? "#86efac" : "#fde68a"}` }}>
                Active: {previewTier === "paid" ? "Paid (Premium)" : "Free Tier"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.76rem", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: "8px", fontWeight: 700 }}>
                🤖 Primary: gemini-3.5-flash-lite
              </span>
              <span style={{ fontSize: "0.76rem", background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: "8px", fontWeight: 700 }}>
                🛡️ Fallback: gemini-3.5-flash
              </span>
              {guidance?.meta && (
                <span style={{ fontSize: "0.76rem", background: guidance.meta.fallbackDepth > 0 ? "#fee2e2" : "#e0f2fe", color: guidance.meta.fallbackDepth > 0 ? "#b91c1c" : "#0369a1", border: `1px solid ${guidance.meta.fallbackDepth > 0 ? "#fca5a5" : "#bae6fd"}`, padding: "2px 8px", borderRadius: "8px", fontWeight: 700 }}>
                  {guidance.meta.fallbackDepth === 0
                    ? `✓ Last Run: ${guidance.meta.model} (Primary · ${guidance.meta.latencyMs}ms)`
                    : `⚠️ Last Run: ${guidance.meta.model} (Fallback Level ${guidance.meta.fallbackDepth} · ${guidance.meta.latencyMs}ms)`}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "0.4rem", background: "rgba(255, 255, 255, 0.8)", padding: "4px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
            <button
              type="button"
              disabled={testingFallback}
              onClick={async () => {
                setTestingFallback(true);
                try {
                  const resp = await fetch("/api/test-ai-fallback");
                  const data = await resp.json();
                  setFallbackTestResult(data);
                } catch {
                  setFallbackTestResult({ status: "error", error: "Failed to connect to test endpoint" });
                } finally {
                  setTestingFallback(false);
                }
              }}
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                padding: "3px 8px",
                background: "#f0fdf4",
                color: "#166534",
                border: "1px solid #86efac",
                borderRadius: "6px",
                cursor: "pointer",
              }}
              title="Verify primary model (gemini-3.5-flash-lite) responsiveness"
            >
              {testingFallback ? "Testing…" : "🧪 Test Primary"}
            </button>
            <button
              type="button"
              disabled={testingFallback}
              onClick={async () => {
                setTestingFallback(true);
                try {
                  const resp = await fetch("/api/test-ai-fallback?simulateFailure=true");
                  const data = await resp.json();
                  setFallbackTestResult(data);
                } catch {
                  setFallbackTestResult({ status: "error", error: "Failed to connect to test endpoint" });
                } finally {
                  setTestingFallback(false);
                }
              }}
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                padding: "3px 8px",
                background: "#fef3c7",
                color: "#b45309",
                border: "1px solid #fde68a",
                borderRadius: "6px",
                cursor: "pointer",
              }}
              title="Simulate primary outage to verify secondary fallback (gemini-3.5-flash)"
            >
              {testingFallback ? "Simulating…" : "⚡ Test Fallback"}
            </button>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", background: "rgba(255, 255, 255, 0.8)", padding: "5px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <button
            type="button"
            className="button"
            style={{
              padding: "0.45rem 1.1rem",
              fontSize: "0.88rem",
              fontWeight: 700,
              borderRadius: "7px",
              cursor: "pointer",
              background: previewTier === "free" ? "#0284c7" : "transparent",
              color: previewTier === "free" ? "#ffffff" : "#475569",
              border: previewTier === "free" ? "1px solid #0284c7" : "1px solid transparent",
              boxShadow: previewTier === "free" ? "0 2px 6px rgba(2, 132, 199, 0.25)" : "none",
            }}
            onClick={() => setPreviewTier("free")}
          >
            Switch to Free Version
          </button>
          <button
            type="button"
            className="button"
            style={{
              padding: "0.45rem 1.1rem",
              fontSize: "0.88rem",
              fontWeight: 700,
              borderRadius: "7px",
              cursor: "pointer",
              background: previewTier === "paid" ? "#0284c7" : "transparent",
              color: previewTier === "paid" ? "#ffffff" : "#475569",
              border: previewTier === "paid" ? "1px solid #0284c7" : "1px solid transparent",
              boxShadow: previewTier === "paid" ? "0 2px 6px rgba(2, 132, 199, 0.25)" : "none",
            }}
            onClick={() => setPreviewTier("paid")}
          >
            Switch to Paid Version
          </button>
        </div>
      </div>
        {fallbackTestResult && (
          <div
            style={{
              width: "100%",
              marginTop: "0.75rem",
              padding: "0.75rem 1rem",
              borderRadius: "10px",
              background: fallbackTestResult.status === "error" ? "#fee2e2" : fallbackTestResult.isFallbackTriggered ? "#fef3c7" : "#f0fdf4",
              border: `1px solid ${fallbackTestResult.status === "error" ? "#fca5a5" : fallbackTestResult.isFallbackTriggered ? "#fde68a" : "#bbf7d0"}`,
              color: fallbackTestResult.status === "error" ? "#b91c1c" : fallbackTestResult.isFallbackTriggered ? "#b45309" : "#166534",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.85rem",
            }}
          >
            <div>
              <strong>
                {fallbackTestResult.status === "error"
                  ? `❌ Diagnostic Error: ${fallbackTestResult.error}`
                  : fallbackTestResult.isFallbackTriggered
                  ? `⚡ Secondary Fallback Active: Executed via ${fallbackTestResult.executedModel} (Level ${fallbackTestResult.fallbackDepth} · ${fallbackTestResult.latencyMs}ms)`
                  : `✓ Primary Model Active: Executed via ${fallbackTestResult.executedModel} (${fallbackTestResult.latencyMs}ms)`}
              </strong>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem" }}>
                {fallbackTestResult.explanation || `Configured: Primary = ${fallbackTestResult.configuredPrimary} | Fallback = ${fallbackTestResult.configuredFallback}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFallbackTestResult(null)}
              style={{ background: "none", border: "none", fontSize: "1.1rem", cursor: "pointer", color: "inherit", padding: "0 0.5rem" }}
            >
              ×
            </button>
          </div>
        )}
      </div>

      <section className="review-input work-card">
        <div className="review-heading"><div><span className="status-pill">RESUME CHECKER</span><h2>Check your content and design</h2><p>We check wording, structure, length, readability, page layout, and visual presentation. If a file cannot be read, it will not count toward your monthly checks.</p></div><span className="quota-badge">{previewTier === "free" ? "3 free checks each month (Free Plan)" : testingExempt ? "Testing access · no monthly limit" : remaining === null ? "30 checks each month (Paid Plan)" : `${remaining} checks left this month (Paid: 30/mo)`}</span></div>
        <label className="upload-zone">
          <strong>Choose a resume file</strong>
          <span>{uploadMessage}</span>
          <input
            ref={fileInputRef}
            type="file"
            disabled={uploading}
            accept={nativePipeline ? ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" : ".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"}
            onChange={(event) => void inspectFile(event.target.files?.[0])}
          />
        </label>
        <OperationProgress state={uploadProgress} />
        {documentSignals.hasVisualEvidence && (
          <p className="field-help" role="status">
            Visual inspection ready for {documentSignals.pageCount ?? "the uploaded"} page{documentSignals.pageCount === 1 ? "" : "s"}. The next review will use PyMuPDF/OpenCV{typeof documentSignals.geminiVisualScore === "number" ? " and Gemini Vision" : ""}.
          </p>
        )}
        {nativeJobId && Object.keys(nativeProfile).length > 0 && <section className="extraction-ready" aria-label="Native extraction review"><div><strong>Review extracted profile fields</strong><span>Edit or clear any value before confirming it. Only confirmed values become trusted profile data.</span></div>{Object.entries(nativeProfile).map(([key, value]) => <label className="form-field" key={key}>{key}<input value={typeof value === "string" ? value : JSON.stringify(value)} onChange={(event) => setNativeProfile((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<button type="button" className="button button-dark" onClick={() => void confirmNativeProfile()}>Confirm corrected profile</button>{confirmationMessage && <p role="status">{confirmationMessage}</p>}</section>}
        <label className="form-field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.25rem" }}>
            <span>Resume text <span className="field-help">Filled automatically after upload; you can also paste your resume here.</span></span>
            {text && (
              <button
                type="button"
                onClick={clearResume}
                style={{ fontSize: "0.82rem", color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Clear text & start fresh
              </button>
            )}
          </div>
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={17} minLength={80} maxLength={200000} placeholder="Upload your resume above, or paste its text here." />
        </label>
        {/* Target Role & Key Skills Section */}
        <div className="form-field" style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.35rem" }}>
            <label htmlFor="target-skills-input" style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.92rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              🎯 Important skills for your target role
              <span className="field-help" style={{ fontWeight: 400, color: "#64748b", fontSize: "0.8rem" }}>
                (Optional; separate them with commas)
              </span>
            </label>
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
              {text.trim().length >= 80 && (
                <button
                  type="button"
                  onClick={() => {
                    const detected = autoExtractSkills(text);
                    if (detected.length > 0) {
                      setKeywords(detected.slice(0, 15).join(", "));
                    }
                  }}
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#0284c7",
                    background: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    borderRadius: "6px",
                    padding: "3px 9px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}
                  title="Extract top skills from your uploaded resume into this field"
                >
                  ✨ Auto-detect from resume
                </button>
              )}
              {keywords && (
                <button
                  type="button"
                  onClick={() => setKeywords("")}
                  style={{ fontSize: "0.8rem", color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  Clear skills
                </button>
              )}
            </div>
          </div>

          <input
            id="target-skills-input"
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
            placeholder="e.g. Semiconductor, SoC Architecture, Program Management, R&D Leadership, Team Scaling"
            style={{
              width: "100%",
              minHeight: "3rem",
              padding: "0.75rem 1rem",
              border: "1.5px solid #cbd5e1",
              borderRadius: "10px",
              background: "#ffffff",
              fontSize: "0.92rem",
              color: "#0f172a",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)",
            }}
          />

          {/* Interactive Skill Chips */}
          {keywords.trim() && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#64748b", marginRight: "0.2rem" }}>
                Active skills ({keywords.split(",").map(cleanSkillName).filter(isValidSkill).length}):
              </span>
              {keywords
                .split(",")
                .map(cleanSkillName)
                .filter(isValidSkill)
                .map((skill) => (
                  <span
                    key={skill}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "3px 9px",
                      borderRadius: "20px",
                      background: "#e0f2fe",
                      color: "#0369a1",
                      border: "1px solid #bae6fd",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = keywords
                          .split(",")
                          .map(cleanSkillName)
                          .filter((s) => isValidSkill(s) && s.toLowerCase() !== skill.toLowerCase())
                          .join(", ");
                        setKeywords(updated);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#0284c7",
                        cursor: "pointer",
                        padding: "0 2px",
                        fontWeight: 800,
                        fontSize: "0.85rem",
                        lineHeight: 1,
                      }}
                      title={`Remove ${skill}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          )}

          {/* Quick Add Suggestions from Resume */}
          {text.trim().length >= 80 && (
            <div style={{ marginTop: "0.55rem" }}>
              {(() => {
                const detected = autoExtractSkills(text);
                const activeLower = new Set(
                  keywords
                    .split(",")
                    .map(cleanSkillName)
                    .filter(isValidSkill)
                    .map((s) => s.toLowerCase())
                );
                const suggestions = detected.filter((s) => !activeLower.has(s.toLowerCase())).slice(0, 10);
                if (suggestions.length === 0) return null;
                return (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.76rem", color: "#64748b", fontWeight: 700 }}>
                      Suggested from resume:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const validExisting = keywords
                          .split(",")
                          .map(cleanSkillName)
                          .filter(isValidSkill);
                        const existingLower = new Set(validExisting.map((s) => s.toLowerCase()));
                        const toAdd = suggestions.filter((s) => !existingLower.has(s.toLowerCase()));
                        const combined = [...validExisting, ...toAdd].join(", ");
                        setKeywords(combined);
                      }}
                      style={{
                        background: "linear-gradient(135deg, #0284c7, #0369a1)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "14px",
                        padding: "3px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                      }}
                      title="Add all detected skills into your target skills"
                    >
                      ✨ Add all ({suggestions.length})
                    </button>
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          const validExisting = keywords
                            .split(",")
                            .map(cleanSkillName)
                            .filter(isValidSkill);
                          const combined = validExisting.length ? `${validExisting.join(", ")}, ${s}` : s;
                          setKeywords(combined);
                        }}
                        style={{
                          background: "#f1f5f9",
                          border: "1px dashed #cbd5e1",
                          borderRadius: "14px",
                          padding: "2px 8px",
                          fontSize: "0.76rem",
                          color: "#475569",
                          cursor: "pointer",
                        }}
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </section>

      <aside className="review-action-column">
        <section className="work-card review-action-card">
          <span className="section-kicker">CHOOSE YOUR NEXT STEP</span><h3>What would you like to do?</h3>
          <div className="review-action-choice primary"><span>01</span><div><strong>Review my resume</strong><p>Get your score, evidence, design checks, and prioritized guidance.</p></div><button className="button button-primary" type="button" onClick={() => void runReview()} disabled={working || uploading || text.trim().length < 80 || !aiConsentAccepted}>{uploading ? "Finishing page inspection…" : reviewProgress.active ? "Review in progress…" : "Review my resume"}</button></div>
          <div className="review-action-choice"><span>02</span><div><strong>Build my resume</strong><p>Check every extracted detail, improve the writing, then choose a professional resume style.</p></div>{draftReady ? <Link className="button button-dark" href="/profile?from=resume&next=/documents">Check details and build</Link> : <button className="button button-dark" disabled>Upload a resume first</button>}</div>
          {!aiConsentAccepted && <div className="extraction-ready consent-at-action" role="region" aria-label="Required data-use confirmation"><div><strong>Accept the data-use terms to continue</strong><span>This confirmation is required before the expert Resume Checker can process your resume.</span><ExternalAiConsent accepted={false} onAccepted={() => { setAiConsentAccepted(true); setMessage(""); }} /></div></div>}
          {confirmationMessage && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: "8px", padding: "0.5rem 0.75rem", fontSize: "0.85rem", margin: "0.5rem 0" }}>
              {confirmationMessage}
            </div>
          )}
          {message && <p className="form-error" role="alert">{message}</p>}
          <OperationProgress state={reviewProgress} variant="scan" />
          {result && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem 1.15rem",
                background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                border: "1.5px solid #0284c7",
                borderRadius: "12px",
                boxShadow: "0 4px 14px rgba(2, 132, 199, 0.15)",
                display: "grid",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#0369a1", fontWeight: 800 }}>
                    Overall Resume Score
                  </span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginTop: "0.2rem" }}>
                    <span style={{ fontSize: "2.2rem", fontWeight: 900, color: "#0284c7", lineHeight: 1 }}>
                      {result.v2?.cumulativeScore !== null && result.v2?.cumulativeScore !== undefined
                        ? result.v2.cumulativeScore.toFixed(1)
                        : (result.score ?? "Pending")}
                    </span>
                    {result.score !== null && <span style={{ fontSize: "1rem", color: "#64748b", fontWeight: 700 }}>/ 100</span>}
                    {result.v2?.descriptiveBand && (
                      <span
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          color: "#15803d",
                          background: "#dcfce7",
                          padding: "2px 8px",
                          borderRadius: "8px",
                          border: "1px solid #bbf7d0",
                          marginLeft: "0.35rem",
                        }}
                      >
                        {result.v2.descriptiveBand}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  const el = document.getElementById("resume-results");
                  if (el) {
                    const top = el.getBoundingClientRect().top + window.scrollY - 20;
                    window.scrollTo({ top, behavior: "smooth" });
                  }
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  fontSize: "0.95rem",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #0284c7, #0369a1)",
                  color: "#ffffff",
                  padding: "0.8rem 1rem",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                📊 View Full 20-Parameter Breakdown Below ↓
              </button>
            </div>
          )}
        </section>
        <section className="work-card jd-panel">
          <div><span className="status-pill">JOB MATCH</span><h3>Check your fit for a role</h3><p>Paste a job description or provide a job URL to see where your resume matches and what may be missing. Adding or changing a job description updates the assessment mode and Job Match score.</p></div>
          <label className="form-field">Public job-posting URL <span className="field-help">Enter any public job link (e.g., LinkedIn, Greenhouse, Lever, company careers). We verify the role requirements and check it directly against your resume.</span><input type="url" value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} placeholder="https://company.example/jobs/role" /></label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <button className="button button-primary" type="button" onClick={() => void openJobUrl(true)} disabled={working || jobUrl.trim().length < 10} style={{ flex: 1, minWidth: "200px" }}>
              {working ? "Verifying and matching…" : "🔍 Verify Link & Check Match"}
            </button>
            <button className="button button-secondary" type="button" onClick={() => void openJobUrl(false)} disabled={working || jobUrl.trim().length < 10}>
              Load Text Only
            </button>
          </div>
          {jdMessage && (
            <div
              style={{
                marginTop: "0.5rem",
                marginBottom: "0.75rem",
                padding: "0.6rem 0.85rem",
                borderRadius: "8px",
                fontSize: "0.85rem",
                lineHeight: 1.45,
                fontWeight: 600,
                background: jdMessage.isError ? "#fee2e2" : "#f0fdf4",
                color: jdMessage.isError ? "#b91c1c" : "#166534",
                border: `1px solid ${jdMessage.isError ? "#fca5a5" : "#bbf7d0"}`,
              }}
            >
              {jdMessage.text}
            </div>
          )}
          {jobSource && <small style={{ display: "block", marginBottom: "0.5rem", color: "#0369a1", fontWeight: 600 }}>✓ Verified from: <a href={jobSource} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{jobSource}</a></small>}
          <div className="form-field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.25rem" }}>
              <span style={{ fontWeight: 700, color: "#0f172a" }}>Job description</span>
              <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const clip = await navigator.clipboard.readText();
                      if (clip && clip.trim().length >= 20) {
                        setJobDescription(clip.trim());
                        setJdMessage({ text: `✓ Pasted ${clip.trim().length.toLocaleString()} characters from clipboard! Checking match…`, isError: false });
                        if (text.trim().length >= 80) {
                          void compareJob(clip.trim());
                        }
                      }
                    } catch {
                      const textarea = document.querySelector(".jd-panel textarea") as HTMLTextAreaElement;
                      if (textarea) textarea.focus();
                    }
                  }}
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: "#0284c7",
                    background: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    borderRadius: "6px",
                    padding: "2px 8px",
                    cursor: "pointer",
                  }}
                  title="Click to automatically paste job description from your clipboard"
                >
                  📋 Paste from clipboard
                </button>
                {jobDescription && (
                  <button
                    type="button"
                    onClick={() => { setJobDescription(""); setJobMatch(null); }}
                    style={{ fontSize: "0.82rem", color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={9} placeholder="Or paste the full job description text here…" />
          </div>
          <button className="button button-dark" type="button" onClick={() => void compareJob()} disabled={working || jobDescription.trim().length < 80}>Check My Match with This Job</button>
          {jobMatch && <div className="job-match-result"><div><strong>{jobMatch.score}%</strong><span>Match quality: {jobMatch.score >= 70 ? "High" : jobMatch.score >= 40 ? "Medium" : "Low"}</span></div><p>{jobMatch.disclaimer}</p><h4>What matches</h4><div className="skill-cloud">{jobMatch.matched.map((term) => <span key={term}>{term}</span>)}</div><h4>What may be missing</h4><div className="skill-cloud missing">{jobMatch.missing.map((term) => <span key={term}>{term}</span>)}</div>{jobMatch.actions.map((action) => <p key={action}>• {action}</p>)}</div>}
        </section>
      </aside>

      {result && <section className={result.v2 ? "review-results-board review-results-board-workbook" : "review-results-board"} id="resume-results" aria-live="polite">
        <article className="work-card review-summary-card">
          <div className="review-heading">
            <span className="status-pill">{result.v2 ? (previewTier === "paid" ? "SUCCESSPRO V2 · PREMIUM" : "SUCCESSPRO V2 · FREE") : "LEGACY RESUME ASSESSMENT"}</span>
            <h2>Comprehensive Resume Assessment</h2>
            <p>{result.disclaimer}</p>
          </div>
          {result.v2 ? <WorkbookReview result={result.v2} isPaid={previewTier === "paid"} analysisId={analysisId} gapRiskAnalysis={result.gapRiskAnalysis} isReused={isReused} /> : <>
          {/* Legacy saved review */}
          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "16px", padding: "1.5rem", margin: "1.5rem 0", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <div>
              <span style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", display: "block" }}>Overall Resume Score</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
                <span style={{ fontSize: "3.5rem", fontWeight: 900, color: "#38bdf8", lineHeight: 1 }}>{result.score}</span>
                <span style={{ fontSize: "1.5rem", color: "#64748b", fontWeight: 600 }}>/ 100</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.9rem", color: "#cbd5e1" }}>Evaluation Coverage:</span>
                <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "#f8fafc" }}>{result.evaluationCoverage ?? (result.jobMatchScore !== null ? 100 : 75)}%</span>
              </div>
              <span style={{ fontSize: "0.78rem", background: result.provisional !== false ? "rgba(245, 158, 11, 0.2)" : "rgba(34, 197, 94, 0.2)", color: result.provisional !== false ? "#f59e0b" : "#4ade80", border: `1px solid ${result.provisional !== false ? "rgba(245, 158, 11, 0.4)" : "rgba(34, 197, 94, 0.4)"}`, padding: "3px 10px", borderRadius: "12px", fontWeight: 600 }}>
                {result.provisional !== false ? "Provisional Evaluation" : "Complete 3-Component Score"}
              </span>
            </div>
          </div>

          {/* Missing Job Description Alert Banner */}
          {(result.jobMatchScore === null || result.jobMatchStatus === "not_evaluated" || result.jobMatchStatus === "job_description_required") && (
            <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "12px", padding: "1.25rem", margin: "1rem 0 1.5rem 0", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
              <div style={{ flex: "1 1 300px" }}>
                <strong style={{ color: "#fbbf24", display: "block", marginBottom: "0.35rem", fontSize: "1rem" }}>Complete Your Assessment</strong>
                <p style={{ margin: 0, fontSize: "0.92rem", color: "#e2e8f0", lineHeight: 1.5 }}>
                  Your resume content and visual quality have been evaluated. To complete your resume assessment and receive a personalized Job Match Score, upload or paste a job description. We will identify matching skills, missing requirements, and role-specific improvements.
                </p>
              </div>
              <button
                type="button"
                className="button button-primary"
                style={{ background: "#f59e0b", color: "#000", fontWeight: 700, border: "none" }}
                onClick={() => {
                  const jdPanel = document.querySelector(".jd-panel textarea");
                  if (jdPanel) {
                    jdPanel.scrollIntoView({ behavior: "smooth", block: "center" });
                    (jdPanel as HTMLTextAreaElement).focus();
                  }
                }}
              >
                Add Job Description
              </button>
            </div>
          )}

          {/* 3 Core Weighted Scoring Components (50% / 25% / 25%) */}
          <h3 style={{ fontSize: "1.1rem", color: "#f8fafc", margin: "1.5rem 0 0.75rem 0" }}>Core Weighted Components (100% Total)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", margin: "1.5rem 0" }}>
            {/* Content Quality - 50% */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(168, 85, 247, 0.3)", borderRadius: "12px", padding: "1.25rem", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#c084fc", textTransform: "uppercase" }}>50% Weight</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  {result.contentContribution !== undefined ? `+${result.contentContribution} pts` : `+${(result.contentQualityScore * 0.50).toFixed(1)} pts`}
                </span>
              </div>
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#a855f7" }}>{result.contentQualityScore}</div>
              <strong style={{ display: "block", marginTop: "0.25rem" }}>Content Quality</strong>
              <small style={{ color: "#94a3b8", display: "block", minHeight: "2.5rem", marginTop: "0.25rem" }}>
                Achievements, clarity, impact, progression and skills
              </small>
              {result.scoreSources?.contentQuality && (
                <span style={{ display: "inline-block", fontSize: "0.72rem", background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", padding: "2px 8px", borderRadius: "12px", marginTop: "0.5rem" }}>
                  {result.scoreSources.contentQuality}
                </span>
              )}
            </div>

            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: "12px", padding: "1.25rem", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#34d399", textTransform: "uppercase" }}>25% Weight</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  {result.visualDesignScore !== null ? (result.visualContribution !== undefined ? `+${result.visualContribution} pts` : `+${(result.visualDesignScore * 0.25).toFixed(1)} pts`) : "Not evaluated"}
                </span>
              </div>
              <div style={{ fontSize: result.visualDesignScore !== null ? "2.5rem" : "1.6rem", fontWeight: 800, color: result.visualDesignScore !== null ? "#34d399" : "#94a3b8", minHeight: "3rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {result.visualDesignScore !== null ? result.visualDesignScore : "Not evaluated"}
              </div>
              <strong style={{ display: "block", marginTop: "0.25rem" }}>Visual Quality</strong>
              <small style={{ color: "#94a3b8", display: "block", minHeight: "2.5rem", marginTop: "0.25rem" }}>
                {result.visualDesignScore !== null ? "Fonts, margins, spacing, hierarchy and balance" : "Requires PDF upload to evaluate"}
              </small>
              {result.scoreSources?.visualDesign && (
                <span style={{ display: "inline-block", fontSize: "0.72rem", background: result.visualDesignScore !== null ? "rgba(52, 211, 153, 0.15)" : "rgba(148, 163, 184, 0.15)", color: result.visualDesignScore !== null ? "#34d399" : "#94a3b8", padding: "2px 8px", borderRadius: "12px", marginTop: "0.5rem" }}>
                  {result.scoreSources.visualDesign}
                </span>
              )}
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "12px", padding: "1.25rem", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f59e0b", textTransform: "uppercase" }}>25% Weight</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  {result.jobMatchScore !== null ? (result.jobMatchContribution !== undefined && result.jobMatchContribution !== null ? `+${result.jobMatchContribution} pts` : `+${(result.jobMatchScore * 0.25).toFixed(1)} pts`) : "25% unallocated"}
                </span>
              </div>
              <div style={{ fontSize: result.jobMatchScore !== null ? "2.5rem" : "1.6rem", fontWeight: 800, color: result.jobMatchScore !== null ? "#f59e0b" : "#64748b", minHeight: "3rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {result.jobMatchScore !== null ? `${result.jobMatchScore}%` : "Not evaluated"}
              </div>
              <strong style={{ display: "block", marginTop: "0.25rem" }}>Job Description Match</strong>
              <small style={{ color: "#94a3b8", display: "block", minHeight: "2.5rem", marginTop: "0.25rem" }}>
                {result.jobMatchScore !== null ? "Contextual fit against job requirements" : "Requires job description"}
              </small>
              <span style={{ display: "inline-block", fontSize: "0.72rem", background: result.jobMatchScore !== null ? "rgba(245, 158, 11, 0.15)" : "rgba(100, 116, 139, 0.15)", color: result.jobMatchScore !== null ? "#f59e0b" : "#94a3b8", padding: "2px 8px", borderRadius: "12px", marginTop: "0.5rem" }}>
                {result.jobMatchScore !== null ? (result.scoreSources?.jobMatch ?? "Gemini + target match") : "Not evaluated"}
              </span>
            </div>
          </div>

          {/* Independent ATS Readiness Diagnostic Card */}
          <div style={{ background: "rgba(56, 189, 248, 0.05)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "12px", padding: "1.25rem", margin: "1rem 0", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "#38bdf8", minWidth: "4rem", textAlign: "center" }}>
                {result.atsReadinessScore}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <strong style={{ fontSize: "1.05rem", color: "#f0f9ff" }}>ATS Compatibility Diagnostic</strong>
                  <span style={{ fontSize: "0.72rem", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "2px 8px", borderRadius: "12px" }}>
                    Independent Diagnostic (0-100)
                  </span>
                </div>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
                  Evaluates document parseability, standard headings, contact info, dates, and document structure. Evaluated deterministically to ensure resume ingestion compliance across applicant tracking systems.
                </p>
              </div>
            </div>
            {result.scoreSources?.atsReadiness && (
              <span style={{ fontSize: "0.75rem", background: "rgba(56, 189, 248, 0.12)", color: "#7dd3fc", padding: "4px 10px", borderRadius: "8px" }}>
                {result.scoreSources.atsReadiness}
              </span>
            )}
          </div>
          </>}
          {!result.v2 && analysisId && (
            previewTier === "paid" ? (
              <a className="button button-dark" href={`/api/reviews/${analysisId}/report`}>Download polished review PDF</a>
            ) : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: "0.85rem", marginTop: "1rem" }}>
                <span>🔒 Download polished review PDF</span>
                <span style={{ fontSize: "0.75rem", background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>Available in Paid Plan</span>
              </div>
            )
          )}
        </article>
        {!result.v2 && <article className="work-card"><span className="section-kicker">PRIORITIES</span><h3>Start with these improvements</h3><div className="review-priorities review-priority-grid">{prioritized.map((item) => <article key={item.id}><div><strong>{item.label}</strong><span>{item.earned} / {item.maximum}</span></div><p>{item.action}</p></article>)}</div></article>}
        {guidance?.meta.validation === "passed" && (
          previewTier === "paid" ? (
            <section className="work-card tailored-guidance">
              <span className="section-kicker">EXPERT GUIDANCE</span>
              <h3>Guidance for your next edit</h3>
              <p className="guidance-summary">{guidance.output.summary}</p>
              <div className="guidance-card-grid">
                {guidance.output.topActions.map((item, index) => (
                  <article key={`${item.suggestion}-${index}`}>
                    <strong>{item.suggestion}</strong>
                    <p><b>What we found:</b> {item.observed}</p>
                    {item.inference && <p><b>What this may mean:</b> {item.inference}</p>}
                    {item.originalExcerpt && (
                      <div className="line-edit-comparison">
                        <span>From your resume</span>
                        <blockquote>{item.originalExcerpt}</blockquote>
                        {item.improvedExample && item.improvedExample.trim().toLowerCase() !== item.originalExcerpt.trim().toLowerCase() && (
                          <>
                            <span>Stronger approach using the same facts</span>
                            <p>{item.improvedExample}</p>
                          </>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
              {guidance.output.limitations.map((item) => (
                <small key={item}>{item}</small>
              ))}
            </section>
          ) : (
            <section className="work-card tailored-guidance" style={{ opacity: 0.85 }}>
              <span className="section-kicker">EXPERT GUIDANCE (PREMIUM)</span>
              <h3>Guidance for your next edit</h3>
              <div style={{ padding: "1.25rem", background: "rgba(255, 255, 255, 0.03)", border: "1px dashed rgba(255, 255, 255, 0.2)", borderRadius: "10px", textAlign: "center" }}>
                <p style={{ color: "#94a3b8", fontSize: "0.88rem", margin: 0 }}>
                  🔒 Line-by-line expert guidance and targeted rewrite recommendations are available to paid members.
                </p>
              </div>
            </section>
          )
        )}
        {!result.v2 && <details className="work-card factor-details"><summary>See the full score breakdown</summary><div className="factor-card-grid">{result.factors.map((item) => <article className="factor-explanation" key={item.id}><div className="factor-row"><span>{item.label}</span><strong>{item.earned}/{item.maximum}</strong></div><p><b>Recommended action:</b> {item.action}</p>{item.evidence.map((entry) => <small key={entry}>{entry.startsWith("Resume example:") ? entry : `What we checked: ${entry}`}</small>)}{item.issues.map((entry) => <small key={`${entry.severity}-${entry.message}`}>{entry.severity} priority: {entry.message}</small>)}<button className="text-button" type="button" onClick={() => void explainFactor(item)} disabled={explainingFactor === item.id}>{explainingFactor === item.id ? "Preparing guidance…" : "Show detailed advice"}</button>{factorGuidance[item.id] && <div className="factor-guidance"><p><b>Evidence from your resume:</b> {factorGuidance[item.id].output.observed}</p>{factorGuidance[item.id].output.inference && <p><b>Professional assessment:</b> {factorGuidance[item.id].output.inference}</p>}<p><b>Why it matters:</b> {factorGuidance[item.id].output.whyItMatters}</p><p><b>How to improve it:</b> {factorGuidance[item.id].output.suggestion}</p>{factorGuidance[item.id].output.example && <p><b>Suggested approach:</b> {factorGuidance[item.id].output.example}</p>}</div>}</article>)}</div></details>}
      </section>}
    </div>
  );
}
