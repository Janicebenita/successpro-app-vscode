"use client";

import { useState } from "react";

export function PublicContact({ publicProfileId }: { publicProfileId: string }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setStatus("Sending privately…");
    const response = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicProfileId, message }) });
    const body = await response.json();
    setStatus(response.ok ? `Your message was sent. You can start ${body.remaining} more new conversations this month.` : body.error ?? "Unable to send this message.");
    if (response.ok) setMessage("");
    setSending(false);
  }

  return <form className="public-contact" onSubmit={(event) => void send(event)}><h2>Send a message</h2><p>Your email and the member’s contact details stay private.</p><label className="form-field">Your message<textarea required minLength={20} maxLength={1000} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Introduce yourself and explain why you would like to connect…" /></label><button className="button button-primary" disabled={sending}>{sending ? "Sending…" : "Send message"}</button>{status && <p className="save-status" role="status">{status}</p>}</form>;
}
