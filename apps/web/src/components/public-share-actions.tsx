"use client";

import { useState } from "react";

export function PublicShareActions({ name, profilePath }: { name: string; profilePath?: string }) {
  const [status, setStatus] = useState("");
  const [manualLink, setManualLink] = useState("");
  const profileUrl = () => profilePath ? new URL(profilePath, window.location.origin).href : window.location.origin + window.location.pathname;

  function shareWindow(service: "linkedin" | "facebook") {
    const url = encodeURIComponent(profileUrl());
    const destination = service === "linkedin" ? `https://www.linkedin.com/sharing/share-offsite/?url=${url}` : `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    window.open(destination, "_blank", "noopener,noreferrer,width=720,height=640");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(profileUrl());
      setManualLink("");
      setStatus("Profile link copied.");
    } catch {
      setManualLink(profileUrl());
      setStatus("Select and copy your public profile link below.");
    }
  }

  async function share() {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({ title: `${name} on SuccessPro`, text: `View ${name}'s professional profile.`, url: profileUrl() });
      setStatus("Profile shared.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setManualLink(profileUrl());
      setStatus("Unable to open sharing. You can copy the link instead.");
    }
  }

  return <section className="public-section public-share-actions" aria-labelledby="share-profile-title">
    <h2 id="share-profile-title">Share this profile</h2>
    <div className="share-button-grid">
      <button type="button" className="button button-primary" onClick={() => void share()}>Share</button>
      <button type="button" className="button button-secondary" onClick={() => shareWindow("linkedin")}>LinkedIn</button>
      <button type="button" className="button button-secondary" onClick={() => shareWindow("facebook")}>Facebook</button>
      <button type="button" className="button button-secondary" onClick={() => void copyLink()}>Copy link</button>
    </div>
    {status && <p className="save-status" role="status">{status}</p>}
    {manualLink && <label className="form-field">Your public profile link<input readOnly value={manualLink} onFocus={(event) => event.currentTarget.select()} /></label>}
  </section>;
}
