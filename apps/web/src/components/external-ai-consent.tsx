"use client";
import Link from "next/link";
import { useState } from "react";

export function ExternalAiConsent({ accepted, onAccepted }: { accepted: boolean; onAccepted?: () => void }) {
  const [confirmed, setConfirmed] = useState(false); const [done, setDone] = useState(accepted); const [status, setStatus] = useState("");
  async function accept() {
    setStatus("Recording your choice…");
    try {
      const response = await fetch("/api/account/ai-consent", { method: "POST" });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (response.ok) {
        setDone(true);
        setStatus("Data-use terms accepted.");
        window.dispatchEvent(new Event("successpro:ai-consent-accepted"));
        onAccepted?.();
      } else {
        setStatus(body.error ?? "Consent could not be recorded.");
      }
    } catch {
      setStatus("Unable to record consent. Please check your connection and try again.");
    }
  }
  if (done) return <p className="save-status">External AI data-use terms accepted. You can review the <Link href="/data-policy">Data Policy</Link> at any time.</p>;
  return <div className="form-grid"><p>Your account does not yet include the current data-use confirmation. This confirmation is required before expert career tools can process your information.</p><label className="consent-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I accept the <Link href="/data-policy#external-ai-processing" target="_blank">external AI data-use terms</Link>, including the disclosed use of approved external service providers.</span></label><button className="button button-primary" type="button" disabled={!confirmed} onClick={() => void accept()}>Accept and continue</button>{status && <p role="status">{status}</p>}</div>;
}
