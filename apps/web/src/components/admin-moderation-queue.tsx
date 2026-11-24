"use client";

import { useState } from "react";

type Report = { id: string; category: string; details: string; status: string; conversationId: string; createdAt: string | null };

export function AdminModerationQueue({ initialReports }: { initialReports: Report[] }) {
  const [reports, setReports] = useState(initialReports);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState("");

  async function decide(id: string, next: "reviewing" | "resolved" | "dismissed") {
    setWorking(id); setStatus("");
    const response = await fetch(`/api/admin/moderation/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next, reason: reasons[id] ?? "" }) });
    const body = await response.json();
    if (!response.ok) setStatus(body.error ?? "Unable to update this report.");
    else { setReports((current) => current.map((report) => report.id === id ? { ...report, status: next } : report)); setStatus("The report was updated and the decision was added to the audit log."); }
    setWorking("");
  }

  return <section className="work-card" id="reports"><div className="card-heading"><div><span className="section-kicker">TRUST & SAFETY</span><h3>Member reports</h3></div><span className="quota-badge">{reports.filter((report) => report.status === "new" || report.status === "reviewing").length} open</span></div>{reports.length === 0 ? <p>No member reports are awaiting review.</p> : reports.map((report) => <article className="record-editor" key={report.id}><div className="card-heading"><div><strong>{report.category.replaceAll("-", " ")}</strong><small>{report.createdAt ? new Date(report.createdAt).toLocaleString() : "Time pending"} · {report.status}</small></div><span className="status-pill">{report.status.toUpperCase()}</span></div><p>{report.details || "No additional details were supplied."}</p><small>Conversation reference: {report.conversationId}</small>{!['resolved', 'dismissed'].includes(report.status) && <><label className="form-field">Decision reason<textarea rows={2} maxLength={1000} value={reasons[report.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [report.id]: event.target.value }))} placeholder="Record the evidence reviewed and reason for this action." /></label><div className="report-actions"><button className="button button-secondary" disabled={working === report.id} onClick={() => void decide(report.id, "reviewing")}>Mark reviewing</button><button className="button button-dark" disabled={working === report.id} onClick={() => void decide(report.id, "dismissed")}>Dismiss</button><button className="button button-primary" disabled={working === report.id} onClick={() => void decide(report.id, "resolved")}>Resolve</button></div></>}</article>)}{status && <p className="save-status" role="status">{status}</p>}</section>;
}
