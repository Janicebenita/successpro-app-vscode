# Admin runbook

## Roles

`super_admin`, `ops_admin`, `support_admin`, `finance_admin`, `mentor_admin`, `content_admin`, `advertiser_admin`, and `auditor` use deny-by-default capabilities. Super-admin access is exceptional and MFA-protected.

## Privacy boundary

Support staff see status and diagnostics before content. Access to private resume/message content is read-only by default, requires an approved support purpose and typed reason, and writes an immutable audit event containing actor, subject, action, purpose, time, and outcome. “View as user” never grants mutation.

## Common operations

- Account access: verify identity using approved signals; never request a password or raw authentication token.
- Upload/analysis failure: inspect event metadata and parser status without opening content; replay only idempotent jobs.
- Payment mismatch: compare signed webhook events, subscription ledger, and entitlement ledger; never edit entitlement from UI state alone.
- Privacy request: route export/deletion to the dedicated workflow and record legal-retention exceptions.
- Impersonation/abuse: preserve evidence, restrict exposure, apply reversible controls, and escalate high-risk cases.
- Security incident: revoke affected sessions/credentials, preserve logs, notify the security owner, and follow the incident plan.

## Dangerous actions

Suspension, refund, permanent deletion, admin-role change, webhook replay, and production feature-flag changes require confirmation, reason, audit event, and rollback/recovery plan where applicable.
