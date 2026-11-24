# Unified presentation and editorial release

## Scope

Public landing, login, signup and pricing share the workspace's light surfaces and blue controls. Premium profile presentation remains a deliberate membership variant. Shared typography and responsive controls remain in the app-wide stylesheet.

AI tasks now have a versioned editorial instruction. Resume transformation emphasizes source-backed context, contribution, scope and results, proportionate detail, and technical specificity without invented claims. Output punctuation is normalized after semantic validation; identifiers and addresses are preserved. Static UI prose and fallback wording no longer contain em dashes. Word exports and review PDFs normalize presentation punctuation; resume PDF text already normalizes dashes.

## Evidence

- TypeScript and focused lint passed.
- Automated suite: 78 files, 336 tests passed.
- Public desktop/phone checks: homepage, login, signup and pricing passed overflow checks on the deployed candidate. Screenshots: `output/ui/public-theme/`.
- Build `9c40bf4d-9cee-47ee-ab9e-bd2aeca789bb`: SUCCESS.
- Image: `sha256:d5a0fed5848560b5fa12f253016d6a95d16f55836e76335c284ee42458796aef`.
- Candidate: `successpro-web-staging-unified-editorial`, initially deployed with zero traffic.
- All ten supplied samples passed the revised transformation validation; generated profiles contained no em dashes. Repair validation caught missing awards, an underwritten role, a placeholder and an unsupported numeric claim before accepting final responses. Results remain private under `tmp/sample-resume-qa/*-gemini-3.6-flash-transform-retest.json`.
- Deployed homepage/login/signup/pricing copy passed the no-em-dash assertion at both widths.

## Acceptance limits

Authenticated candidate lifecycle passed, including upload, transformation, review, cover letter, LinkedIn, exports, saved edits and desktop/mobile routes. The candidate log query returned no HTTP 5xx entries. Structural validation does not establish editorial approval. Existing saved drafts are not silently rewritten; members must request a new transformation for the revised writing policy. Original uploaded files remain unchanged. Final production, domain, payment, legal, security and operational acceptance remain open in the master launch ledger.

## Promotion blocker

2026-09-28: approval access recovered. A read-only Cloud Run check confirmed `workspace-design` still serves 100% and `unified-editorial` has zero traffic. Rebuild `ec79a60d-2089-444f-8d9d-a69b1d2a666a` includes the link/paragraph hardening. The fresh full suite passes 78 files / 337 tests; secret-pattern and limited static-security scans pass. These scans do not close the full security gate.

Follow-up local hardening: punctuation normalization now preserves paragraph boundaries and `link` fields, in addition to other identifier/address fields. Three focused tests pass. This follow-up is not in the candidate image above; rebuild and verify before promoting the final source state. The earlier statement that no rebuild was needed applied to the previously verified source snapshot only.

The traffic-switch command was not executed because the automatic approval reviewer reported a usage limit. Do not report this candidate as serving the normal customer URL. The verified candidate remains available at https://editorial-qa---successpro-web-staging-tjx6xu7doq-el.a.run.app . Once approvals are available, promote `successpro-web-staging-unified-editorial` to 100% traffic, then verify the service traffic state, normal URL and logs. No rebuild is needed for the verified application image.
