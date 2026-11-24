"use client";

import { useState } from "react";

type ReplayEvent = {
  id: string;
  type: string;
  processingResult: string;
  processingAttempts: number;
  receivedAt: string | null;
  providerCreatedAt: number | null;
  recordKind: "payment" | "subscription";
};

export function AdminWebhookReplayQueue({ initialEvents, canReplay }: { initialEvents: ReplayEvent[]; canReplay: boolean }) {
  const [events, setEvents] = useState(initialEvents);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function replay(id: string) {
    const reason = reasons[id]?.trim() ?? "";
    if (reason.length < 20) { setMessage("Add a specific replay reason of at least 20 characters."); return; }
    setBusy(id); setMessage("");
    const response = await fetch(`/api/admin/webhooks/${encodeURIComponent(id)}/replay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    const body = await response.json().catch(() => ({}));
    if (response.ok) { setEvents((current) => current.filter((event) => event.id !== id)); setMessage(`Webhook replay completed with state ${body.state ?? "processed"}.`); }
    else setMessage(body.error ?? "The webhook could not be replayed.");
    setBusy("");
  }

  return <article className="work-card"><div className="card-heading"><div><span className="section-kicker">PAYMENT OPERATIONS</span><h3>Failed webhook recovery</h3></div><span className="quota-badge">{events.length} NEED ATTENTION</span></div><p>Only failed or unmatched signed webhook records appear here. Replays are bounded, transactional, and fully audited; raw payment payloads and card data are never shown.</p>{events.length === 0 ? <p>No recoverable webhook failures are waiting.</p> : events.map((event) => <div className="record-editor" key={event.id}><div className="card-heading"><div><strong>{event.type}</strong><small>{event.recordKind} · received {event.receivedAt ? new Date(event.receivedAt).toLocaleString() : "time unavailable"}</small></div><span className="status-pill">{event.processingResult.toUpperCase()} · {event.processingAttempts}/5</span></div>{canReplay ? <><label className="form-field">Reason for replay<textarea rows={3} minLength={20} maxLength={1000} value={reasons[event.id] ?? ""} onChange={(change) => setReasons((current) => ({ ...current, [event.id]: change.target.value }))} placeholder="Explain what was corrected and why replay is safe." /></label><button className="button button-dark" disabled={busy === event.id} onClick={() => void replay(event.id)}>{busy === event.id ? "Replaying…" : "Replay safely"}</button></> : <small>Finance or operations-admin access is required to replay this event.</small>}</div>)}{message && <p className="save-status" role="status">{message}</p>}</article>;
}
