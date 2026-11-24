# Data model

## Conventions

Every entity includes `id`, `createdAt`, `updatedAt`, ownership/tenant scope where applicable, schema version, and audit provenance. Sensitive data is separated from public read models. Money uses integer minor units plus ISO currency. Dates are UTC timestamps with source timezone retained when relevant. Ledgers and audit events are append-only.

## Identity and profile

| Entity | Purpose / key relationships |
| --- | --- |
| `users` | lifecycle/status root; references private identity and policy versions |
| `auth_links` | provider subject ↔ user, unique by provider/subject and verified-email policy |
| `user_settings` | locale, notification, privacy, accessibility preferences |
| `profiles` | latest confirmed canonical professional identity |
| `profile_versions` | immutable profile snapshots and correction provenance |
| `public_profiles` | opt-in, minimal publishable projection with revocation/noindex state |
| `resumes`, `resume_versions` | private upload metadata, object reference, hash, parse state |
| `parsed_profiles` | versioned extraction, per-field confidence, user-confirmation state |
| `resume_transform_versions` | immutable initial/refinement inputs, grounded output, improvement notes, and provider-validation metadata for each expert-writing pass |

## Analysis and AI

| Entity | Purpose / key relationships |
| --- | --- |
| `analyses` | resume/JD inputs by version, rubric version, evidence, factor scores |
| `score_rubric_versions` | immutable 12-factor rules/weights |
| `job_descriptions` | text or SSRF-safe fetched source metadata |
| `ai_runs` | task, prompt/policy version, provider, validation, cost/latency; no secret telemetry |

## Billing and entitlement

| Entity | Purpose / key relationships |
| --- | --- |
| `usage_ledger` | append-only allowance debits/credits; idempotency key and period |
| `entitlements` | versioned plan-derived capabilities and overrides |
| `subscriptions` | provider subscription lifecycle and paid-through date |
| `payments`, `invoices`, `refunds` | authoritative financial state and reconciliation references |
| `fx_rates`, `price_book`, `tax_rules` | source/date/versioned pricing and market enablement |
| `webhook_events` | provider ID uniqueness, signature result, attempts, normalized state |

## Career intelligence

`career_goals`, `goal_tasks`, `courses`, `course_recommendations`, `job_preferences`, `job_sources`, `jobs`, `job_matches`, and `saved_jobs` are owner-scoped and paginated. Jobs use canonical source IDs plus normalized deduplication fingerprints and freshness timestamps.

## Community and marketplace

`mentors`, `mentor_applications`, `mentor_availability`, `mentor_bookings`, `mentor_payments`, `mentor_payout_ledger`, `connections`, `connection_requests`, `conversations`, `messages`, `feed_events`, `reactions`, `moderation_reports`, `advertisers`, and `ad_campaigns` separate public projections from private/financial data. Messages are queryable only by participants and authorized audited moderation flows.

## Operations

`support_tickets`, `notifications`, `email_events`, `feature_flags`, `admin_users`, `admin_audit_events`, and `system_health_events` contain minimal diagnostic data and never duplicate resume content.

## Critical constraints

- One successful free ATS completion creates one idempotent usage debit; system/parse failures create none.
- Public-profile reads never join private contact collections.
- Provider webhook event ID is unique per provider.
- Conversation membership is checked server-side for every message read/write.
- A user-corrected field is never overwritten by lower-confidence parsing without explicit confirmation.
- Deletion tombstones and legally retained financial records must not recreate deleted profile data.
