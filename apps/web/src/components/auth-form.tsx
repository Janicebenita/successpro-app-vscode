"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword, deleteUser, getAdditionalUserInfo, GoogleAuthProvider, sendEmailVerification, signInWithEmailAndPassword, signInWithPopup, updateProfile, type User } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { AuthSwitchLink } from "./auth-switch-link";

async function establishSession() {
  const token = await firebaseAuth.currentUser?.getIdToken(true);
  if (!token) throw new Error("Unable to confirm your identity.");
  const response = await fetch("/api/session", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json();
  if (response.status === 409 && body.code === "registration_consent_required") return { consentRequired: true };
  if (!response.ok) throw new Error(body.error ?? "Unable to sign in.");
  return body as { restricted?: boolean; consentRequired?: boolean };
}

async function recordRegistrationConsent(user: User, selectedPlan: string) {
  const token = await user.getIdToken(true);
  const response = await fetch("/api/registration-consent", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ adultAndTermsAccepted: true, automatedCareerProcessingAccepted: true, externalAiDataUseAccepted: true, selectedPlan, requestedCurrency: "INR" }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Unable to record your registration choices.");
}

function friendlyAuthError(cause: unknown) {
  const code = typeof cause === "object" && cause && "code" in cause ? String(cause.code) : "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "The email address or password is incorrect.";
  if (code.includes("email-already-in-use")) return "An account already exists for this email address. Try signing in instead.";
  if (code.includes("account-exists-with-different-credential")) return "This email already has a SuccessPro account. Sign in with your password, then connect Google in Privacy & account settings.";
  if (code.includes("credential-already-in-use")) return "This Google account is already connected to another SuccessPro account.";
  if (code.includes("weak-password")) return "Choose a stronger password with at least 10 characters.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("too-many-requests")) return "Too many attempts were made. Please wait a few minutes and try again.";
  if (code.includes("popup-closed")) return "The Google sign-in window was closed before sign-in finished.";
  if (code.includes("network-request-failed")) return "We could not connect. Check your internet connection and try again.";
  return "We could not complete that request. Please try again.";
}

export function AuthForm({ mode, defaultDestination = "/dashboard" }: { mode: "login" | "signup"; defaultDestination?: string }) {
  const signup = mode === "signup";
  const router = useRouter();
  const search = useSearchParams();
  const [status, setStatus] = useState<"idle" | "working" | "verify" | "consent">("idle");
  const [error, setError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [processingAccepted, setProcessingAccepted] = useState(false);
  const [externalAiAccepted, setExternalAiAccepted] = useState(false);
  const requestedDestination = search.get("returnTo");
  const destination = requestedDestination?.startsWith("/") && !requestedDestination.startsWith("//") && !requestedDestination.includes("\\") ? requestedDestination : defaultDestination;
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  const selectedPlan = ["free", "premium-monthly", "premium-quarterly", "premium-annual"].includes(search.get("plan") ?? "") ? search.get("plan")! : "free";

  async function finish() {
    const session = await establishSession();
    if (session.consentRequired) {
      setStatus("consent");
      return;
    }
    router.push(session.restricted ? "/settings" : destination);
    router.refresh();
  }

  async function acceptMissingConsent() {
    if (!termsAccepted || !processingAccepted || !externalAiAccepted) return;
    const user = firebaseAuth.currentUser;
    if (!user) {
      setError("Your sign-in expired. Please sign in again.");
      setStatus("idle");
      return;
    }
    setStatus("working");
    setError("");
    try {
      await recordRegistrationConsent(user, selectedPlan);
      await finish();
    } catch {
      setError("We could not save your registration choices. Please try again.");
      setStatus("consent");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("working");
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (signup) {
        if (!termsAccepted || !processingAccepted || !externalAiAccepted) throw new Error("Complete all required registration confirmations.");
        const credential = await createUserWithEmailAndPassword(firebaseAuth, String(data.get("email")), String(data.get("password")));
        await updateProfile(credential.user, { displayName: String(data.get("name")) });
        await recordRegistrationConsent(credential.user, selectedPlan);
        await sendEmailVerification(credential.user, { url: `${window.location.origin}/login?returnTo=${encodeURIComponent(destination)}` });
        setStatus("verify");
      } else {
        const credential = await signInWithEmailAndPassword(firebaseAuth, String(data.get("email")), String(data.get("password")));
        await credential.user.reload();
        if (!credential.user.emailVerified) {
          await sendEmailVerification(credential.user, { url: `${window.location.origin}/login?returnTo=${encodeURIComponent(destination)}` });
          setStatus("verify");
          return;
        }
        await finish();
      }
    } catch (cause) {
      setError(friendlyAuthError(cause));
      setStatus("idle");
    }
  }

  async function google() {
    setStatus("working");
    setError("");
    try {
      if (signup && (!termsAccepted || !processingAccepted || !externalAiAccepted)) throw new Error("Complete all required registration confirmations.");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(firebaseAuth, provider);
      if (!signup && getAdditionalUserInfo(credential)?.isNewUser) {
        await deleteUser(credential.user);
        throw new Error("This Google account is new to SuccessPro. Create an account first so you can review and accept the required data-use terms.");
      }
      if (signup) await recordRegistrationConsent(credential.user, selectedPlan);
      await finish();
    } catch (cause) {
      setError(cause instanceof Error && (cause.message.startsWith("Complete all") || cause.message.startsWith("This Google account is new")) ? cause.message : friendlyAuthError(cause));
      setStatus("idle");
    }
  }

  if (status === "verify") return <><div className="auth-message" role="status"><strong>Check your inbox</strong><p>We sent a verification link. Open it, then return here and sign in. The link can take a minute to arrive.</p></div><AuthSwitchLink signup destination={destination} /></>;

  const consentFields = <div className="registration-consents" aria-label="Required registration confirmations">
    <label className="consent-check"><input name="termsConsent" type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required /><span>I confirm I am 18 or older and accept the <Link href="/data-policy" target="_blank">Data Policy</Link> and <Link href="/terms" target="_blank">Terms and Conditions</Link>.</span></label>
    <label className="consent-check"><input name="processingConsent" type="checkbox" checked={processingAccepted} onChange={(event) => setProcessingAccepted(event.target.checked)} required /><span>I agree that SuccessPro may process my resume, profile, career goals, and job information to provide its automated career tools. Approved service providers may be used, with built-in processing used when an external provider is unavailable or not approved.</span></label>
    <label className="consent-check"><input name="externalAiConsent" type="checkbox" checked={externalAiAccepted} onChange={(event) => setExternalAiAccepted(event.target.checked)} required /><span>I accept the <Link href="/data-policy#external-ai-processing" target="_blank">external AI data-use terms</Link>: my career information may be sent to service providers for analysis and generation, and a free service tier may retain or use submitted content to operate, evaluate, or improve its services.</span></label>
    <small>All three confirmations are required to continue. If an external service is unavailable, SuccessPro uses its built-in processing so the journey can continue.</small>
  </div>;

  if (status === "consent") return <>
    <div className="auth-message" role="status"><strong>One more step</strong><p>Review the current registration choices before continuing to your account.</p></div>
    {consentFields}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-primary full" type="button" disabled={!termsAccepted || !processingAccepted || !externalAiAccepted} onClick={() => void acceptMissingConsent()}>Accept and continue</button>
  </>;

  return <>
    <div style={{ marginBottom: 20, padding: 14, background: "#ecfdf5", border: "1px solid #10b981", borderRadius: 10, textAlign: "center" }}>
      <p style={{ margin: 0, fontWeight: 700, color: "#065f46", fontSize: 15 }}>⚡ Testing Mode Active</p>
      <p style={{ margin: "4px 0 12px", fontSize: 13, color: "#047857" }}>Skip authentication and test all app features immediately.</p>
      <Link href={destination} className="button button-primary full" style={{ display: "block", textDecoration: "none", background: "#059669", color: "#fff", fontWeight: 600, padding: "10px 16px", borderRadius: 8 }}>
        Enter Workspace Directly →
      </Link>
    </div>
    {signup && consentFields}
    <button className="button button-dark full" type="button" onClick={() => void google()} disabled={status === "working" || !googleEnabled || (signup && (!termsAccepted || !processingAccepted || !externalAiAccepted))}>{googleEnabled ? "Continue with Google" : "Google sign-in coming soon"}</button>
    <div className="divider">or use email</div>
    <form className="form-grid" onSubmit={(event) => void submit(event)}>
      {signup && <label className="form-field">Full name<input autoComplete="name" name="name" placeholder="Your full name" required /></label>}
      <label className="form-field">Email address<input autoComplete="email" name="email" type="email" placeholder="you@example.com" required /></label>
      <label className="form-field">Password<input autoComplete={signup ? "new-password" : "current-password"} name="password" type="password" minLength={10} placeholder="At least 10 characters" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary full" type="submit" disabled={status === "working" || (signup && (!termsAccepted || !processingAccepted || !externalAiAccepted))}>{status === "working" ? "Please wait…" : signup ? "Create free account" : "Sign in"}</button>
    </form>
    <AuthSwitchLink signup={signup} destination={destination} />
  </>;
}
