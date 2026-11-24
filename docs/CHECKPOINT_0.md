# Checkpoint 0

Date: 2026-09-23

## What now works

- Branded, responsive public landing page with an immediate resume-review journey
- Login and signup screen shells with Google/email paths and the 18+ notice
- Authenticated career workspace shell with resume, profile, quota, timeline, and action states
- Admin operations shell with privacy-scoped risk signals and least-privilege messaging
- Health endpoint, baseline browser security headers, environment validation, and custom favicon
- Reproducible Google Cloud Run/Cloud Build staging configuration with min instances 0, max instances 3, 1 CPU, 512 MiB, concurrency 40, and 30-second request timeout
- Architecture, security/privacy, AI, payments/tax, data, testing, admin, deployment, status, decision, blocker, and change documentation

Authentication, resume processing, storage, ATS scoring, payments, email, and AI are intentionally not active before Phase 1.

## Visual review

### Desktop

- [Landing page](screenshots/desktop-landing.png)
- [Login](screenshots/desktop-login.png)
- [Career workspace](screenshots/desktop-dashboard.png)
- [Admin console](screenshots/desktop-admin.png)

### Mobile

- [Landing page](screenshots/mobile-landing.png)
- [Signup](screenshots/mobile-signup.png)
- [Career workspace](screenshots/mobile-dashboard.png)
- [Admin console](screenshots/mobile-admin.png)

The approved visual system is also applied to the Phase 1 [desktop review](screenshots/desktop-review.png) and [mobile review](screenshots/mobile-review.png) working slice.

## Verification evidence

- ESLint: passed with zero warnings
- TypeScript strict check: passed
- Unit tests: 2 passed
- Production Next.js build: passed for all five UI routes plus health API
- Browser suite: 14 passed across desktop and mobile
- Automated WCAG A/AA scan: no detected violations on landing, login, signup, dashboard, or admin routes
- Dependency audit: no known vulnerabilities
- Secret-pattern scan: clean
- Visual review: desktop and mobile screenshots inspected after responsive fixes

## Repository tree

```text
apps/web/                  Next.js 16 web/API product shell
  e2e/                     Desktop/mobile browser and accessibility tests
  scripts/                 Screenshot and focused accessibility utilities
  src/app/                 Public, auth, dashboard, admin, and health routes
  src/components/          Brand, navigation, auth, and app-shell components
docs/                      Product/technical/operating documents and screenshots
infra/cloudbuild/          Staging image build and deployment pipeline
infra/cloudrun/            Cost-capped staging service specification
infra/scripts/             Auditable staging bootstrap
successpro_codex_bundle/   Original brief and brand references, unchanged
```

## Staging URL

Not yet available. No Google Cloud credentials or staging project were present, and the project correctly avoids deploying into an unknown or personal cloud account.

## Cost impact

- Cost incurred by this checkpoint: no cloud resources were created by the repository work.
- Local build and tests do not create Google Cloud charges.
- First staging deployment can create Artifact Registry storage, Cloud Build usage, Cloud Run requests/compute, and logging usage. Cloud Run is configured to scale to zero and cap at three instances, but budget alerts are notifications—not a hard spending cap.
- Firebase/Firestore, Cloud Storage, malware scanning, email, AI, backups, and payment services are not enabled yet, so they cannot incur product usage costs from this shell.

## Founder action required

Only one action is needed to publish staging:

1. Open Google Cloud Console → create a project named “SuccessPro Staging” → link the intended billing account.
2. Send the exact project ID or authenticate `gcloud` locally to that project.

After access exists, follow `docs/DEPLOYMENT_RUNBOOK.md` to create a small budget alert, deploy, smoke-test, and record the URL.

## Decisions for founder awareness

- The visual direction is premium deep navy/ink with restrained gold and light reading surfaces. This reconciles the supplied logo with the supplied dark-card reference without making every screen black and yellow.
- The bootstrap architecture is a serverless modular monolith on Cloud Run, with Firestore behind repository interfaces and a separate parser worker added in Phase 1.
- Staging defaults to Google Cloud `asia-south1`; production region/data residency will be revisited before launch.

## Next phase after approval

Phase 1: Firebase authentication/account linking, canonical profile, safe resume upload/parsing, the versioned deterministic 12-factor ATS engine, JD matching, and the three-completed-reviews-per-month allowance.
