"use client";

import { useEffect, useState } from "react";
import { GoogleAuthProvider, linkWithPopup, onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";

export function GoogleAccountLink() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => onAuthStateChanged(firebaseAuth, (user) => {
    setConnected(user ? user.providerData.some((provider) => provider.providerId === "google.com") : null);
  }), []);

  async function connect() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setMessage("Sign in again to connect your Google account.");
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await linkWithPopup(user, provider);
      setConnected(result.user.providerData.some((item) => item.providerId === "google.com"));
      setMessage("Google is connected. You can now use it to sign in to this same SuccessPro account.");
    } catch (cause) {
      const code = typeof cause === "object" && cause && "code" in cause ? String(cause.code) : "";
      setMessage(code.includes("credential-already-in-use") || code.includes("email-already-in-use")
        ? "That Google account is already linked to another SuccessPro account. Your current account was not changed."
        : code.includes("popup-closed")
          ? "The Google window was closed before the accounts were connected."
          : "We could not connect Google right now. Your current sign-in still works.");
    } finally {
      setWorking(false);
    }
  }

  return <article className="work-card">
    <h3>Google sign-in</h3>
    <p>Connect Google to your existing account without losing your profile, reviews, or documents.</p>
    {connected === true ? <p role="status">Connected to Google</p> : <button type="button" className="button button-secondary" onClick={() => void connect()} disabled={working}>{working ? "Connecting…" : "Connect Google account"}</button>}
    {message && <p role="status">{message}</p>}
  </article>;
}
