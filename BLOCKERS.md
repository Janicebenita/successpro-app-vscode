# Blockers

## Active external gates

- **Google sign-in acceptance:** The provider is enabled, the live login and consent-gated signup buttons open Google's account chooser, and existing members have an account-linking action. A completed real-account signup, return-to-session, and same-UID password-to-Google linking test remain unverified.
- **Production upload security:** Signature/MIME/size/page/macro checks and scanned-PDF OCR are active, but production launch still requires a malware-scanning service and isolated parsing worker.
- **Payments and transactional email:** Razorpay merchant/test configuration and transactional email delivery still require current end-to-end verification. The support-receipt provider exists but is not bound to a Hostinger Mail API credential; the hPanel DNS token is not a mail token. Do not treat the visible billing UI as working checkout or approved live payments.
- **External job and salary coverage:** Public-source connectors exist, but authenticated regional coverage and credential-dependent USAJOBS/Adzuna results remain unverified. Missing results must not be fabricated.
- **AI quality and reliability:** Vertex authentication and real generation work. Revision 83 nevertheless failed expert-review quotation checks and produced a duplicate cover-letter paragraph and identity placeholder. API-key Gemini fallback attempts returned HTTP 402. Local corrections have passed focused tests and all three letter tones, but require deployed verification. Do not describe the provider chain as zero-cost or fully reliable on this evidence.
- **Production legal and infrastructure work:** `successpro.xfactor.ltd` now resolves to the staging Cloud Run app through a Google-managed HTTPS load balancer, with valid TLS and HTTP-to-HTTPS redirect. Hostinger MX/SPF/DKIM/DMARC and Search Console verification remain in DNS. This is not a separate production project or final launch sign-off; legal, tax, privacy, retention, operational monitoring, and end-to-end mail delivery still require approval or evidence.

## Resolved

- Earlier blanket claims that daily scheduling and FX references were absent were stale: the delivery ledger records verified OIDC scheduled job/retention/FX runs. This removes those items from the missing-configuration list, not from final production revalidation.

- Dedicated staging project, billing, budget alerts, least-privilege identities, Artifact Registry, Firestore, private bucket, Firebase web app, and Cloud Run service are provisioned.
- Email/password authentication, persistent profiles/reviews/goals/preferences, and private resume storage are connected.
- The Cloud Run PDF parser startup fault caused by missing DOM canvas globals was fixed with server-side canvas primitives and deferred parser loading.
- Browser compatibility was restored by pinning Playwright 1.56.1; the desktop/mobile suite passes.
