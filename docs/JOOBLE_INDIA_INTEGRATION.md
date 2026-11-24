# Jooble India activation

Local connector added; not activated or deployed yet. India key supplied in a
local RTF has been stored as Secret Manager `jooble-india-api-key` version 1;
only the staging runtime identity received secret accessor permission. The RTF
is excluded from Git, Cloud Build uploads and Docker build context.
The supplied key authenticates at the common `https://jooble.org/api/{key}`
endpoint, not the regional India endpoint. Keep it in the server-only
`JOOBLE_INDIA_API_KEY` variable (name denotes our initial India rollout). Set
`JOOBLE_INDIA_APPROVED=true` only after confirming this account's API display and
24-hour cache terms. Never put the key in browser code, source control or logs.

Search derives the first role and first recognised Indian location from the
profile-based suggestions (saved preferences refine those). Other job sources
continue through independent settled requests. Jooble failure or exhaustion
does not fail the whole feed. Only role/location are sent, not the resume or PII.

Firestore transactions reserve each dispatch against a hard 500 lifetime-call
ledger per key fingerprint, including failed requests. A shared query cache
avoids repeated calls for 24 hours; a one-minute lease suppresses concurrent
duplicates. No automatic HTTP retries. Provider caches/usage must remain
server-only. Quota increases require a reviewed code/configuration change.

Response uses title, employer, location, optional salary text, snippet and the
returned listing link. `updated` is not original publication: source attribution
explicitly says the date is last updated. The 30-day filter therefore measures
updates for this source, not proven original posting age. Strict original-posting
eligibility is not established by Jooble's documented response alone.

Pending acceptance: secure key installation, account terms confirmation,
authenticated smoke test, quota/concurrency integration tests, live India
coverage/relevance checks and deployment. Four operator attempts are recorded
conservatively in the per-key Firestore quota ledger (4/500). The regional
endpoint returned 403. Following the owner's correction, the common endpoint
returned 200: software engineer/Bengaluru returned zero results; sales/India
returned 10 listings out of 17 total matches with documented response fields.
Connector now uses the common endpoint. This confirms authentication and a
nonempty India-query response, not yet geographic/relevance acceptance of each
listing. The key itself and raw provider response were not logged. Account API
terms/cache approval and deployment remain pending.

Local verification: typecheck and 12 focused job tests passed, including lifetime
exhaustion, cache use after exhaustion, final-call reservation, no retry after
403, India-only routing and unapproved-configuration rejection. Real Firestore
concurrent transactions still require integration acceptance.

Primary references, checked 2026-09-26:
- https://in.jooble.org/api/about
- https://help.jooble.org/en/support/solutions/articles/60001448238-rest-api-documentation
- https://help.jooble.org/en/support/solutions/articles/60000922689-how-to-connect-to-the-jooble-rest-api
