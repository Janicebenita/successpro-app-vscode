"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, signOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";

async function recentToken(password: string) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Sign in again before changing these settings.");
  const providers = new Set(user.providerData.map((provider) => provider.providerId));
  if (providers.has("password")) {
    if (!user.email || !password) throw new Error("Enter your current password.");
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else if (providers.has("google.com")) {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
  } else throw new Error("Sign in again using your account provider.");
  return user.getIdToken(true);
}

export function AccountPrivacyControls({ withdrawn }: { withdrawn: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [working, setWorking] = useState<"" | "withdraw" | "delete">("");
  const [message, setMessage] = useState("");

  async function perform(kind: "withdraw" | "delete") {
    if (kind === "withdraw" && confirmation !== "WITHDRAW") return setMessage("Type WITHDRAW exactly to confirm.");
    if (kind === "delete" && confirmation !== "DELETE") return setMessage("Type DELETE exactly to confirm permanent account deletion.");
    setWorking(kind); setMessage("");
    try {
      const token = await recentToken(password);
      const endpoint = kind === "withdraw" ? "/api/account/consent" : "/api/account";
      const response = await fetch(endpoint, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "The request could not be completed.");
      await signOut(firebaseAuth);
      router.push(`/login?account=${kind === "delete" ? "deleted" : "consent-withdrawn"}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The request could not be completed.");
      setWorking("");
    }
  }

  return <section className="work-card account-danger-zone">
    <h3>Stop processing or delete the account</h3>
    <p>These actions require you to confirm your identity again. Download your data first if you want to keep a copy.</p>
    <label className="form-field">Current password <span className="field-help">Google accounts will show a Google confirmation window instead.</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <label className="form-field">Confirmation <span className="field-help">Type WITHDRAW to stop automated career processing, or DELETE to permanently delete the account.</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} /></label>
    {message && <p className="form-error" role="alert">{message}</p>}
    <div className="button-row">
      {!withdrawn && <button className="button button-secondary" type="button" disabled={Boolean(working)} onClick={() => void perform("withdraw")}>{working === "withdraw" ? "Stopping processing…" : "Withdraw processing consent"}</button>}
      <button className="button button-dark" type="button" disabled={Boolean(working)} onClick={() => void perform("delete")}>{working === "delete" ? "Deleting account…" : "Delete my account"}</button>
    </div>
    <small>Deletion removes private career data and uploaded files. Payment, consent, and safety records that must remain are disconnected from your account and retained only in anonymized operational form.</small>
  </section>;
}
