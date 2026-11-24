# Product specification

User-facing language follows [UX_WRITING.md](UX_WRITING.md): plain career-focused wording, direct actions, and no implementation terminology in member experiences.

The requirement-by-requirement implementation and evidence ledger is maintained in [MASTER_DELIVERY_PLAN.md](MASTER_DELIVERY_PLAN.md).

Resume and matching cover-letter typography, template families, pagination, photograph handling, and PDF acceptance criteria are governed by [RESUME_COVER_LETTER_DESIGN_STANDARD.md](RESUME_COVER_LETTER_DESIGN_STANDARD.md).

## North star

SuccessPro is a trusted career operating system: it converts a person’s career history into a confirmed professional identity, then helps them improve, target opportunities, grow skills, connect, and make informed decisions.

## Primary users

- Job seekers who need clear resume feedback and role-specific direction
- Employed professionals planning growth, role changes, or salary moves
- Approved mentors and operations staff in later phases

The initial service is 18+ only.

## Core user promise

1. Understand: a strict and explainable resume review based on visible evidence.
2. Improve: guided corrections and stronger positioning without invented claims.
3. Advance: connected goals, job fit, learning, networking, and mentorship.

## Phase sequence

| Phase | Outcome |
| --- | --- |
| 0 | Branded, testable, deployable product shell and system baseline |
| 1 | Auth, canonical profile, resume ingestion, and 3 free ATS reviews/month |
| 2 | Career dashboard, privacy-controlled public profile, and sharing |
| 3 | Premium entitlement, builders, test-mode billing, and invoices foundation |
| 4 | Jobs, goals, courses, salary intelligence |
| 5 | Professional network, messaging, feed, mentorship |
| 6 | Production hardening, legal approval, live payments, custom domain |
| 7 | Advertisers, additional languages, native apps, advanced search |

## Phase 0 acceptance criteria

- Landing, login, signup, dashboard, and admin shells are responsive and accessible at a smoke-test level.
- Design tokens reflect the supplied brand references.
- Staging is reproducibly deployable with explicit cost limits.
- CI runs lint, type checking, unit tests, build, and a high-severity dependency audit.
- No secrets or real personal data are present.
- Architecture, security, data, AI, payment, testing, admin, and deployment decisions are durable in the repository.

## Product integrity rules

- Scores are deterministic, versioned, consistent for free and paid users, and never manipulated to drive conversion.
- AI advice is clearly advisory and does not promise employment, interviews, salary, or ATS outcomes.
- Public profiles and open-to-work status are opt-in; email and phone are hidden by default.
- External job sources must be authorized, public, licensed, or provided through official feeds/APIs.
- Pricing, renewal, cancellation, refunds, promotions, and advertisements are transparent.
