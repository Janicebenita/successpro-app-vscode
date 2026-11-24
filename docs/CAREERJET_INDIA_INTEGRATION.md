# Careerjet India integration and activation gate

2026-09-26: supplied RTF key stored in Secret Manager
`careerjet-india-api-key`, version 1; secret accessor granted only to staging's
runtime service account. Local key file excluded from Git, Cloud Build and
Docker uploads. Key never printed. No Careerjet API request made yet.

Local transport `src/lib/jobs/careerjet.ts` uses v4 GET, `en_IN`, Basic
authentication (key as username, empty password), required visitor IP and user
agent, and same-origin `/opportunities` Referer without query parameters.
Normalizes provider links, dates, snippets and explicit salary period/currency;
rejects unsafe links and dates outside 30 days. LOCATIONS ambiguity stays a
distinct response, not an invented successful search. Provider failures are
sanitized; key and visitor details must not be logged.

**Not yet connected to customer routes or activated:** establish a trusted-edge
client IP extraction policy rather than trusting spoofable forwarded headers.
Never substitute the server's outbound IP for `user_ip`. Scheduled daily
requests need Careerjet's approval for noninteractive usage; don't fabricate a
visitor to enable them. Confirm publisher display/cache/AI-evaluation terms,
rate limits and cost rules before activation. Transport must then join the
multi-source settled-result path, including location clarification and provider
failure UX tests.

## Server allowlist

The Careerjet partner account requires actual outbound server IPs. Cloud Run's
public service hostname is not an outbound static IP. Proposed solution:
Direct VPC egress through a dedicated subnet, regional Cloud Router/NAT and
one manually reserved external address, routing all egress through NAT.
Test on an isolated revision, verify its outbound address, then register only
that address in Careerjet. Do not allowlist broad Google IP ranges. Do not
change customer traffic until app/API connectivity and rollback are verified.

Cost approval requested: approximately USD4–7/month base for one address and
small gateway instance count, plus traffic/taxes, subject to billed usage.
No billable networking resources have been provisioned for this change yet.

## Owner's free-only decision

Owner declined paid NAT in favour of a free alternative. Do not provision NAT.
Prepared an optional Node relay under `infra/careerjet-relay`, with a Render
free-plan blueprint. Render documents shared regional outbound CIDR ranges;
retrieve the actual service ranges from its dashboard and confirm Careerjet
accepts them before saving. No guessed or universal allowlist entries.
Render's free service sleeps after 15 idle minutes and can take roughly a
minute to wake. Main-app integration must bound the relay call to a short
timeout and continue other job sources; never await a cold start on the whole
dashboard. No keep-alive workaround or paid resources.

The relay accepts only signed, timestamped POST requests, rejects replay,
validates the originating page, bounds request size/rate/upstream duration and
does not log keys or visitor information. Render account access, publisher
terms approval, secrets installation, relay deployment and adversarial/in-app
acceptance remain pending. Source syntax check is not a deployment approval.
No Careerjet credentials or visitor data have been sent to Render.

Free-platform references:
- https://render.com/docs/outbound-ip-addresses
- https://render.com/docs/free

Browser automation failed to initialize; an app browser-open request for
https://www.careerjet.co.in/partners/ was queued. Login/allowlist save not proven.

References reviewed:
- https://www.careerjet.com/partners/api
- https://www.careerjet.com/partners/api/javascript
- https://docs.cloud.google.com/run/docs/configuring/static-outbound-ip
- https://cloud.google.com/nat/pricing
