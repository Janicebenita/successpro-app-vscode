# Test strategy

## Test pyramid

- Unit: deterministic scoring, schema validation, normalization, quota periods, entitlement, pricing, webhook transitions.
- Integration: repositories/emulators, object authorization, signed upload flow, parser jobs, AI schema/fallback, notifications.
- E2E: acquisition path, auth linking, upload/review, public-profile privacy, billing test mode, admin RBAC, deletion/export.
- Non-functional: accessibility, responsive layouts, upload/parser security, SSRF, load/cost limits, backup/restore, rollback.

## Phase 0 suite

- ESLint with zero warnings
- strict TypeScript type check
- Vitest environment-schema tests
- Next.js production build
- Playwright smoke and automated WCAG A/AA checks for landing, auth, career workspace, and admin on desktop and mobile
- package audit at high severity in CI

## Resume golden dataset (Phase 1)

Use synthetic documents only: junior, mid-career, executive, career gap, career switch, technical, nontechnical, academic, multilingual, scanned, two-column, table-heavy, poor formatting, excellent formatting, missing dates, and inconsistent chronology. Store expected parse confidence and score bands, never a single brittle prose output.

The engine tests assert 12 factors, a 100-point maximum, repeatability, explicit layout-risk penalties, upload signature agreement, and completed-only monthly usage. The versioned synthetic corpus in `apps/web/src/test-fixtures/resume-golden-dataset.ts` covers all 16 required resume classes with expected score bands; scanned, two-column, table-heavy, missing-date, and inconsistent-chronology fixtures also assert factor ceilings. Binary PDF/DOCX/OCR fixtures remain part of parser-worker integration testing.

## Security cases

- cross-user object access denied
- public snapshot excludes contact data and revokes immediately
- MIME/signature mismatch, oversized, corrupt, password-protected, macro, archive/zip-bomb, and malware cases
- SSRF against loopback, private/link-local, DNS rebinding, redirects, dangerous ports/schemes, oversized response
- prompt injection in resume/JD remains data and cannot alter policy/schema
- webhook invalid signature, duplicate, out-of-order, replay, and entitlement-update failure
- admin role escalation and unaudited content access denied

## Performance targets to validate before production

- Public page p75 LCP ≤ 2.5s on representative mobile connection
- Normal API p95 ≤ 500ms excluding queued analysis
- Upload acknowledgment p95 ≤ 2s before async processing
- Zero unbounded collection reads/listeners
- Load tests explicitly measure Cloud Run scale and projected cost

Targets are hypotheses until measured in staging; results and exceptions belong in `STATUS.md`.

## Resume and cover-letter rendering

`docs/RESUME_COVER_LETTER_DESIGN_STANDARD.md` defines the release matrix and visual acceptance thresholds. The typed template registry currently enforces four distinct styles, matching cover-letter themes, optional-photo policy, and the 8-9 pt body / 9-10 pt section / 12-14 pt name scale. The PDF preflight rule tests block blank pages, poor page use, unexplained whitespace, clipping, overlaps, unsafe bounds, isolated headings, missing glyphs, and incorrect extraction order.

The current A4 medium-content baseline contains eight generated PDFs: four resumes and four matching cover letters. `apps/web/scripts/audit-document-pdfs.py` proves exact page boxes, embedded fonts, selectable required text, requested font sizes, missing-glyph absence, safe bounds, photo policy, nonblank output, and cover-letter page count. Every baseline page is also rendered with Poppler and visually reviewed. The release matrix is not complete until Letter size, every optional photo state, short/long content, long names, optional-section combinations, multilingual content, link checks, and a second renderer comparison are covered.
