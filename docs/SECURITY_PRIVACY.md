# Security and privacy baseline

## Data classification

| Class | Examples | Handling |
| --- | --- | --- |
| Restricted | resumes, messages, contact details, career history | private storage, least privilege, encryption, audited access |
| Confidential | billing metadata, risk signals, admin events | role-scoped access, retention controls |
| Internal | operational metrics, feature flags | authenticated staff only |
| Public | opted-in profile fields, marketing pages | explicit publication state and revocation |

## Required controls

- HTTPS, secure/HttpOnly/SameSite cookies, CSRF protection where cookie-authenticated mutations occur, strict CORS, CSP, and output encoding.
- Server-side authorization on every object access; UI visibility is never authorization.
- Re-authentication and MFA for admin and sensitive user actions.
- Private buckets, random object keys, signed URLs, MIME/signature/size/page validation, malware scanning, and no macro execution.
- SSRF-safe remote fetching: allow `https`, resolve and reject private/link-local/loopback ranges on every redirect, restrict ports/content types/size/time, and never forward credentials.
- Rate limits by account and privacy-preserving abuse signals; CAPTCHA/App Check for high-risk flows.
- Secret Manager, scoped service accounts, dependency/secret/SAST scans, and audited production access.
- Resume and job-description text is untrusted data, never prompt instructions.

## Privacy controls

- Purpose-specific notice and consent version log
- Export and deletion workflows, with clearly documented financial/legal retention exceptions
- Public profile, open-to-work, sharing, and discoverability default off
- Email/phone private by default; revocable share links and optional `noindex`
- Configurable retention and region/market flags
- Vendor/subprocessor inventory and incident response runbook before production

## Retention policy

| Data | Default | Notes |
| --- | --- | --- |
| Temporary uploads | 24 hours after successful processing | delete earlier on failure/cancel where practical |
| Original resumes | Until user deletes or account policy applies | private and versioned |
| Parsed profile/analysis | Until deletion or superseded-policy expiry | user-corrected values protected from overwrite |
| Application logs | 30 days in staging; 90 days proposed in production | no resume text, messages, or secrets |
| Financial records | jurisdiction/accountant-approved period | segregated from deleted profile data |
| Security/audit events | risk-based, proposed 1 year | minimize direct identifiers |

The enforceable per-collection schedule, daily cleanup job, member-controlled lifecycle, and categories awaiting legal/accounting approval are maintained in `docs/RETENTION_SCHEDULE.md`. The approval-controlled periods remain a production launch gate and must not be described as automatic global compliance.

## Threat priorities

1. Broken object-level authorization exposing resumes or profiles
2. Malicious uploads and parser exploitation
3. SSRF through job-description ingestion
4. Admin-account compromise or excessive support access
5. Prompt injection/data exfiltration through untrusted documents
6. Payment webhook spoofing/replay
7. Abuse, impersonation, spam, and account duplication
