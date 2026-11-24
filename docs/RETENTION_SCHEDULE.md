# Data retention schedule

Last reviewed: 2026-09-25

This schedule distinguishes product data kept at the member's direction, short-lived operational data removed automatically, and records whose final period requires legal/accounting approval before production. It is a technical policy, not a claim of universal legal compliance.

## Automatically enforced

| Data class | Collection or storage prefix | Retention | Enforcement |
| --- | --- | ---: | --- |
| Temporary uploaded objects | `temporary/` | 1 day | Cloud Storage lifecycle rule |
| AI response cache | `ai_cache` | Until `expiresAt` | Daily retention job |
| Abuse-control windows | `rate_limits` | Until `expiresAt` | Daily retention job |
| Consented contact-match hashes | `contact_match_consents` | 30 days maximum | Daily retention job; submitted plaintext is never stored |
| Manual job-refresh throttles | `job_refresh_requests` | 7 days | Daily retention job |
| Personalized daily job-feed snapshots | `daily_job_feeds` | 30 days | Daily retention job |
| AI run metadata | `ai_runs` | 90 days | Daily retention job |
| Employer-source job records | `jobs` | 90 days after last observation | Daily retention job |
| Resume/cover-letter draft versions | `document_draft_versions` | 180 days | Daily retention job; current draft remains |
| Resume transformation versions | `resume_transform_versions` | 180 days | Daily retention job; current resume/profile draft remains |
| De-identified deletion audit events | `account_deletion_events` | 365 days | Daily retention job |
| Product allowance periods | `usage_allowances` | 730 days | Daily retention job |
| Product usage ledger | `usage_ledger` | 730 days | Daily retention job |
| Privacy-minimized product telemetry | `product_events` | 730 days | Daily retention job; removed earlier on account deletion |

Each run is capped at 2,000 deletions so it cannot create an unbounded database operation. A later run continues any backlog. The endpoint accepts a verified Google OIDC identity (or the separately configured legacy automation secret) and is not authorized by a browser session.

## Member-controlled lifecycle

Confirmed profiles, original resumes, parsed resume versions, completed Resume Checker analyses, goals, job preferences, salary research, the current document draft, and conversations remain available until the member deletes the account or an approved future inactive-account policy applies. Rotating or disabling a public profile link revokes its public projection immediately. Account deletion follows `XPR-004` and removes or anonymizes associated records and uploaded resume objects.

## Approval-controlled records

Payment orders/events, consent events, unresolved moderation evidence, security/audit evidence, tax records, invoices, refunds, disputes, and future mentor/marketplace ledgers require jurisdiction-specific legal and accounting approval. They are segregated and minimized, but no automatic deletion period is enabled for these categories until the founder's advisers approve the applicable market policy. Production launch remains gated on that approval.

## Operational verification

- The retention endpoint is `/api/internal/retention` and must return `401` without valid automation identity.
- Cloud Scheduler invokes it daily with a dedicated service-account OIDC token.
- The same identity invokes the daily lawful job-source/feed refresh endpoint.
- Release checks validate cutoff calculations for Firestore timestamps, ISO instants, and ISO dates.
- Operations should review scheduler execution history and deletion counts; `limitReached: true` means the next daily run will continue the backlog.
