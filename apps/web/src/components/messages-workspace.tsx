"use client";

import { useState } from "react";
import type { ConversationSummary } from "@/lib/conversations";

type Message = { id: string; text: string; mine: boolean; createdAt: string | null };
type ConversationDetail = { id: string; peerName: string; blocked: boolean; blockedByMe: boolean };

function timeLabel(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function MessagesWorkspace({ initialItems }: { initialItems: ConversationSummary[] }) {
  const [items, setItems] = useState<ConversationSummary[]>(initialItems);
  const [active, setActive] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState(initialItems.length ? "" : "You do not have any messages yet.");
  const [working, setWorking] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");

  async function loadList() {
    const response = await fetch("/api/conversations");
    const body = await response.json();
    if (!response.ok) return setStatus(body.error ?? "Unable to load your conversations.");
    setItems(body.conversations);
    setStatus(body.conversations.length ? "" : "You do not have any messages yet.");
  }

  async function loadConversation(id: string) {
    setWorking(true);
    const response = await fetch(`/api/conversations/${id}`);
    const body = await response.json();
    if (!response.ok) setStatus(body.error ?? "Unable to open this conversation.");
    else {
      setActive(body.conversation);
      setMessages(body.messages);
      setNextCursor(body.nextCursor ?? null);
      setItems((current) => current.map((item) => item.id === id ? { ...item, unread: false } : item));
      setStatus("");
      setReportOpen(false);
    }
    setWorking(false);
  }

  async function loadOlder() {
    if (!active || !nextCursor) return;
    setWorking(true);
    const response = await fetch(`/api/conversations/${active.id}?cursor=${encodeURIComponent(nextCursor)}`);
    const body = await response.json();
    if (!response.ok) setStatus(body.error ?? "Unable to load older messages.");
    else {
      setMessages((current) => [...body.messages, ...current]);
      setNextCursor(body.nextCursor ?? null);
      setStatus("");
    }
    setWorking(false);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!active || !draft.trim()) return;
    setWorking(true);
    const response = await fetch(`/api/conversations/${active.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: draft }) });
    const body = await response.json();
    if (!response.ok) setStatus(body.error ?? "Unable to send your message.");
    else {
      setDraft("");
      await Promise.all([loadConversation(active.id), loadList()]);
    }
    setWorking(false);
  }

  async function setBlocked(blocked: boolean) {
    if (!active) return;
    setWorking(true);
    const response = await fetch(`/api/conversations/${active.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocked }) });
    const body = await response.json();
    if (!response.ok) setStatus(body.error ?? "Unable to update this conversation.");
    else {
      setStatus(blocked ? "This member can no longer message you here." : "Messages have been turned back on.");
      await Promise.all([loadConversation(active.id), loadList()]);
    }
    setWorking(false);
  }

  async function report(event: React.FormEvent) {
    event.preventDefault();
    if (!active) return;
    setWorking(true);
    const response = await fetch(`/api/conversations/${active.id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: reportCategory, details: reportDetails }) });
    const body = await response.json();
    setStatus(response.ok ? "Thank you. Your report has been sent for review." : body.error ?? "Unable to send your report.");
    if (response.ok) { setReportOpen(false); setReportDetails(""); }
    setWorking(false);
  }

  return <div className="messages-page">
    <section className="work-card profile-intro"><div><span className="status-pill">PRIVATE MESSAGES</span><h2>Your conversations</h2><p>Talk with other SuccessPro members without sharing your email address or phone number.</p></div></section>
    <section className="messages-layout">
      <aside className="work-card conversation-list" aria-label="Conversations">
        <h3>Messages</h3>
        {items.map((item) => <button type="button" className={`conversation-item${active?.id === item.id ? " active" : ""}${item.unread ? " unread" : ""}`} onClick={() => void loadConversation(item.id)} key={item.id}><span className="conversation-person"><strong>{item.peerName}</strong>{item.unread && <span className="unread-badge">New</span>}</span><span>{item.lastMessage}</span><small>{item.blocked ? "Messages paused" : timeLabel(item.updatedAt)}</small></button>)}
        {!items.length && <p className="save-status">{status}</p>}
      </aside>
      <article className="work-card conversation-panel">
        {!active ? <div className="conversation-empty"><span aria-hidden="true">✉</span><h3>Your messages will appear here</h3><p>When you contact an open-to-work member - or someone contacts you - you can continue the conversation here.</p></div> : <>
          <header className="conversation-header"><div><h3>{active.peerName}</h3><span>{active.blocked ? "Messages are paused" : "Contact details remain private"}</span></div><div className="conversation-actions"><button type="button" className="text-button" onClick={() => void setBlocked(!active.blockedByMe)} disabled={working}>{active.blockedByMe ? "Unblock" : "Block"}</button><button type="button" className="text-button danger-text" onClick={() => setReportOpen((value) => !value)}>Report</button></div></header>
          <div className="message-thread" aria-live="polite">{nextCursor && <button className="text-button" type="button" disabled={working} onClick={() => void loadOlder()}>{working ? "Loading…" : "Load older messages"}</button>}{messages.map((message) => <div className={`message-bubble${message.mine ? " mine" : ""}`} key={message.id}><p>{message.text}</p><small>{timeLabel(message.createdAt)}</small></div>)}</div>
          {reportOpen && <form className="report-form" onSubmit={(event) => void report(event)}><h4>Report this conversation</h4><label className="form-field">Reason<select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}><option value="spam">Spam or unwanted messages</option><option value="harassment">Harassment or abuse</option><option value="misleading">False or misleading information</option><option value="other">Something else</option></select></label><label className="form-field">Additional details <span className="field-help">Optional</span><textarea rows={3} maxLength={1000} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} /></label><div className="report-actions"><button type="button" className="button button-dark" onClick={() => setReportOpen(false)}>Cancel</button><button className="button button-primary" disabled={working}>Send report</button></div></form>}
          {!active.blocked && <form className="message-compose" onSubmit={(event) => void send(event)}><label className="sr-only" htmlFor="message-reply">Reply</label><textarea id="message-reply" rows={3} maxLength={1000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a reply…" /><button className="button button-primary" disabled={working || !draft.trim()}>{working ? "Sending…" : "Send"}</button></form>}
          {active.blocked && <div className="messages-paused">Messages are paused in this conversation.{active.blockedByMe && <button type="button" className="text-button" onClick={() => void setBlocked(false)}>Unblock this member</button>}</div>}
          {status && <p className="save-status" role="status">{status}</p>}
        </>}
      </article>
    </section>
  </div>;
}
