"use client";

import { useMemo, useState } from "react";

export type AdminMember = { id: string; email: string; createdAt: string | null; plan: string; disabled: boolean; roles: string[] };
export type AdminSettings = {
  tracking: { googleAnalyticsId: string; googleTagManagerId: string; googleAdsId: string; metaPixelId: string; linkedInInsightTagId: string };
  delivery: { emailProvider: string; senderAddress: string; replyToAddress: string; monthlyOperatingCostInr: number; monthlyAiBudgetInr: number };
  payment: { mode: string; keyIdConfigured: boolean; keySecretConfigured: boolean; webhookSecretConfigured: boolean; enabled: boolean };
};

const roles = ["ops_admin", "support_admin", "finance_admin", "mentor_admin", "content_admin", "advertiser_admin", "auditor"];

export function AdminCommandCenter({ members, settings, summary }: { members: AdminMember[]; settings: AdminSettings; summary: { paidOrders: number; paidRevenueInr: number; pendingOrders: number; aiRuns: number; aiFallbacks: number; aiTokens: number; notifications: number; users: number; activeProfiles: number } }) {
  const [configuration, setConfiguration] = useState(settings);
  const [memberRows, setMemberRows] = useState(members);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [reminder, setReminder] = useState({ memberId: members[0]?.id ?? "", title: "", message: "" });
  const netRevenue = summary.paidRevenueInr - configuration.delivery.monthlyOperatingCostInr;
  const settingsChanged = useMemo(() => JSON.stringify(configuration) !== JSON.stringify(settings), [configuration, settings]);

  async function request(action: string, body: Record<string, unknown>) {
    const response = await fetch("/api/admin/control-plane", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "The administrative change could not be saved.");
    return payload;
  }

  async function saveSettings() {
    setBusy("settings"); setMessage("");
    try { await request("save-settings", { settings: configuration }); setMessage("Operational settings were saved. Tracking IDs are held server-side and load only after visitor consent."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Settings could not be saved."); }
    setBusy("");
  }

  async function updateMember(member: AdminMember, change: { disabled?: boolean; roles?: string[] }) {
    setBusy(member.id); setMessage("");
    try {
      await request("update-member", { memberId: member.id, ...change, reason: "Administrative access review from the SuccessPro control center." });
      setMemberRows((current) => current.map((item) => item.id === member.id ? { ...item, ...change } : item));
      setMessage(`${member.email} was updated. Their active sessions have been revoked.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Member access could not be updated."); }
    setBusy("");
  }

  async function sendReminder() {
    if (!reminder.memberId || reminder.title.trim().length < 3 || reminder.message.trim().length < 8) { setMessage("Choose a member and add a clear reminder title and message."); return; }
    setBusy("reminder"); setMessage("");
    try { await request("send-reminder", reminder); setReminder({ memberId: reminder.memberId, title: "", message: "" }); setMessage("The in-app reminder was delivered and recorded in the audit trail. Email delivery remains off until an email provider is configured."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The reminder could not be sent."); }
    setBusy("");
  }

  return <section className="admin-command-center">
    <section className="admin-section-header" id="overview"><div><span className="section-kicker">CONTROL CENTER</span><h2>Run SuccessPro with confidence</h2><p>Commercial, operational, trust, and growth controls in one audited workspace. Card data, API secrets, and private career content are never shown here.</p></div><span className="status-pill">LIVE OPERATIONS</span></section>

    <section className="admin-kpi-grid" aria-label="Business health">
      <article><span>Registered members</span><strong>{summary.users}</strong><small>{summary.activeProfiles} active career profiles</small></article>
      <article><span>Writing orders</span><strong>{summary.paidOrders}</strong><small>{summary.pendingOrders} awaiting payment confirmation</small></article>
      <article><span>Recorded revenue</span><strong>₹{summary.paidRevenueInr.toLocaleString("en-IN")}</strong><small>Signed paid orders only</small></article>
      <article><span>Monthly operating view</span><strong className={netRevenue >= 0 ? "positive" : "negative"}>₹{netRevenue.toLocaleString("en-IN")}</strong><small>Revenue less manual operating-cost entry</small></article>
      <article><span>AI activity</span><strong>{summary.aiRuns}</strong><small>{summary.aiTokens.toLocaleString("en-IN")} metered tokens · {summary.aiFallbacks} fallbacks</small></article>
      <article><span>Member reminders</span><strong>{summary.notifications}</strong><small>In-app notifications tracked</small></article>
    </section>

    <section className="admin-command-grid">
      <article className="work-card admin-config-card" id="payments"><div className="card-heading"><div><span className="section-kicker">PAYMENTS & REVENUE</span><h3>Razorpay readiness</h3></div><span className={`status-pill ${configuration.payment.enabled ? "status-live" : "status-pending"}`}>{configuration.payment.enabled ? "CHECKOUT ENABLED" : "CHECKOUT HELD"}</span></div><p>Checkout stays held until all credentials, test transactions, webhook verification, tax policy, and merchant approval are complete.</p><div className="admin-readiness-list"><div><span>Mode</span><strong>{configuration.payment.mode || "Not configured"}</strong></div><div><span>Key ID</span><strong>{configuration.payment.keyIdConfigured ? "Stored securely" : "Required"}</strong></div><div><span>Key secret</span><strong>{configuration.payment.keySecretConfigured ? "Stored securely" : "Required"}</strong></div><div><span>Webhook secret</span><strong>{configuration.payment.webhookSecretConfigured ? "Stored securely" : "Required"}</strong></div></div><small>Credentials belong in Cloud Run secret references, never in this browser or Firestore. Use the deployment configuration runbook to add or rotate them; this console confirms readiness without exposing their values.</small></article>

      <article className="work-card admin-config-card" id="ai"><div className="card-heading"><div><span className="section-kicker">AI OPERATIONS</span><h3>Quality, usage and budget</h3></div><span className="quota-badge">{summary.aiFallbacks}/{summary.aiRuns} FALLBACKS</span></div><p>Provider health, model fallback, latency, task outcomes, and provider-reported token counts are recorded without storing raw resume text in operational telemetry.</p><div className="admin-readiness-list"><div><span>Metered tokens</span><strong>{summary.aiTokens.toLocaleString("en-IN")}</strong></div><div><span>Budget entry</span><strong>₹{configuration.delivery.monthlyAiBudgetInr.toLocaleString("en-IN")}</strong></div></div><label className="form-field">Monthly AI budget (INR)<input type="number" min="0" step="100" value={configuration.delivery.monthlyAiBudgetInr} onChange={(event) => setConfiguration((value) => ({ ...value, delivery: { ...value.delivery, monthlyAiBudgetInr: Number(event.target.value) || 0 } }))} /></label><small>Spend is an operational ceiling for review. It does not throttle a customer mid-task.</small></article>

      <article className="work-card admin-config-card" id="growth"><div className="card-heading"><div><span className="section-kicker">ANALYTICS & ACQUISITION</span><h3>Consent-aware tracking</h3></div><span className="status-pill">CONFIGURABLE</span></div><p>Enter platform identifiers only. Optional tags load only after visitor consent and only on the custom domain, never a test revision.</p><div className="form-columns"><label className="form-field">Google Analytics measurement ID<input value={configuration.tracking.googleAnalyticsId} placeholder="G-XXXXXXXXXX" onChange={(event) => setConfiguration((value) => ({ ...value, tracking: { ...value.tracking, googleAnalyticsId: event.target.value } }))} /></label><label className="form-field">Google Tag Manager container<input value={configuration.tracking.googleTagManagerId} placeholder="GTM-XXXXXXX" onChange={(event) => setConfiguration((value) => ({ ...value, tracking: { ...value.tracking, googleTagManagerId: event.target.value } }))} /></label><label className="form-field">Google Ads conversion ID<input value={configuration.tracking.googleAdsId} placeholder="AW-XXXXXXXXX" onChange={(event) => setConfiguration((value) => ({ ...value, tracking: { ...value.tracking, googleAdsId: event.target.value } }))} /></label><label className="form-field">Meta Pixel ID<input value={configuration.tracking.metaPixelId} placeholder="Numeric pixel ID" onChange={(event) => setConfiguration((value) => ({ ...value, tracking: { ...value.tracking, metaPixelId: event.target.value } }))} /></label><label className="form-field">LinkedIn Insight Tag ID<input value={configuration.tracking.linkedInInsightTagId} placeholder="Numeric partner ID" onChange={(event) => setConfiguration((value) => ({ ...value, tracking: { ...value.tracking, linkedInInsightTagId: event.target.value } }))} /></label></div><p className="document-note">When a Tag Manager container is set, configure GA4 inside that container using the <code>successpro_page_view</code> event and disable automatic page views to prevent duplicates. Google Ads requires an actual conversion action and label; its ID alone does not activate conversions. Do not publish tags that capture resume text, names, emails, URL parameters, or messages.</p></article>

      <article className="work-card admin-config-card" id="email"><div className="card-heading"><div><span className="section-kicker">MEMBER COMMUNICATIONS</span><h3>Email and reminders</h3></div><span className="status-pill">IN-APP READY</span></div><p>In-app delivery is available now. Add a verified delivery provider and sender identity before switching on outbound email.</p><div className="form-columns"><label className="form-field">Email provider<input value={configuration.delivery.emailProvider} placeholder="For example, Resend or Postmark" onChange={(event) => setConfiguration((value) => ({ ...value, delivery: { ...value.delivery, emailProvider: event.target.value } }))} /></label><label className="form-field">Verified sender address<input type="email" value={configuration.delivery.senderAddress} placeholder="hello@yourdomain.com" onChange={(event) => setConfiguration((value) => ({ ...value, delivery: { ...value.delivery, senderAddress: event.target.value } }))} /></label><label className="form-field">Reply-to address<input type="email" value={configuration.delivery.replyToAddress} placeholder="support@yourdomain.com" onChange={(event) => setConfiguration((value) => ({ ...value, delivery: { ...value.delivery, replyToAddress: event.target.value } }))} /></label><label className="form-field">Monthly operating cost (INR)<input type="number" min="0" step="100" value={configuration.delivery.monthlyOperatingCostInr} onChange={(event) => setConfiguration((value) => ({ ...value, delivery: { ...value.delivery, monthlyOperatingCostInr: Number(event.target.value) || 0 } }))} /></label></div></article>
    </section>

    <section className="work-card admin-settings-save"><div><h3>Save operational settings</h3><p>Settings are restricted to super administrators, versioned in the audit trail, and never enable paid checkout by themselves.</p></div><button className="button button-primary" disabled={!settingsChanged || busy === "settings"} onClick={() => void saveSettings()}>{busy === "settings" ? "Saving…" : "Save settings"}</button></section>

    <section className="admin-command-grid">
      <article className="work-card admin-members" id="users"><div className="card-heading"><div><span className="section-kicker">MEMBER ACCESS</span><h3>Users and administrators</h3></div><span className="quota-badge">{memberRows.length} RECENT MEMBERS</span></div><p>Suspension disables sign-in and revokes sessions. Role changes are limited to super administrators and are fully audited.</p><div className="admin-member-list">{memberRows.map((member) => <div className="admin-member" key={member.id}><div><strong>{member.email}</strong><small>{member.plan.replaceAll("-", " ")} · joined {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : "date unavailable"}</small></div><label className="form-field admin-role-select"><span>Role</span><select value={member.roles[0] ?? "member"} onChange={(event) => void updateMember(member, { roles: event.target.value === "member" ? [] : [event.target.value] })} disabled={busy === member.id}><option value="member">Member</option>{roles.map((role) => <option value={role} key={role}>{role.replaceAll("_", " ")}</option>)}</select></label><button className="button button-secondary" disabled={busy === member.id} onClick={() => void updateMember(member, { disabled: !member.disabled })}>{busy === member.id ? "Updating…" : member.disabled ? "Restore access" : "Suspend access"}</button></div>)}</div></article>

      <article className="work-card" id="reminders"><div className="card-heading"><div><span className="section-kicker">MEMBER CARE</span><h3>Send a targeted reminder</h3></div></div><p>Use for service, payment, profile, or support follow-up. This sends an in-app notification; it does not expose the customer’s private profile data.</p><label className="form-field">Recipient<select value={reminder.memberId} onChange={(event) => setReminder((value) => ({ ...value, memberId: event.target.value }))}>{memberRows.map((member) => <option value={member.id} key={member.id}>{member.email}</option>)}</select></label><label className="form-field">Reminder title<input maxLength={120} value={reminder.title} onChange={(event) => setReminder((value) => ({ ...value, title: event.target.value }))} placeholder="For example, your writer project is ready" /></label><label className="form-field">Message<textarea rows={4} maxLength={600} value={reminder.message} onChange={(event) => setReminder((value) => ({ ...value, message: event.target.value }))} placeholder="Write a clear, respectful next step." /></label><button className="button button-dark" disabled={busy === "reminder"} onClick={() => void sendReminder()}>{busy === "reminder" ? "Sending…" : "Send in-app reminder"}</button></article>
    </section>
    {message && <p className="save-status admin-command-message" role="status">{message}</p>}
  </section>;
}
