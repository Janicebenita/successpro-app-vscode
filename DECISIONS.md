# Decisions

## D-001 — Serverless modular monolith first

Use a Next.js modular monolith for the web/API shell and add the Python parsing worker only when resume ingestion begins. This minimizes operational cost while keeping worker boundaries explicit.

## D-002 — Firestore behind repositories

Start with Firestore Standard for low idle cost, but prevent database calls from leaking into domain logic. Repository interfaces preserve a practical migration path to PostgreSQL.

## D-003 — Deterministic ATS scoring

The 12-factor numeric ATS score belongs to a versioned deterministic rules engine. AI may explain evidence and suggest edits but may not freely choose or lower the score.

## D-004 — Brand direction

Use deep ink/navy as the product shell, restrained gold for decisions and calls to action, and white reading surfaces for resumes and reports. Manrope/system sans is the type direction. Avoid an indiscriminate black-and-yellow treatment.

## D-005 — Staging region

Default staging to `asia-south1` for proximity to the initial India operation. Production region and data residency remain a launch-gate decision after user-market and legal review.

## D-006 — No live integrations in Phase 0

Auth, payments, AI, email, and cloud data are interfaces/configuration only until credentials, terms, privacy posture, and the checkpoint design are approved.

## D-007 — ATS rubric v1 contract

The first scoring implementation is `successpro-ats-v1`. It accepts explicit document-layout signals plus extracted text, returns exactly 12 factor results totaling 100 maximum points, and is deterministic for the same normalized input. Layout signals remain explicit because plain extracted text cannot truthfully reveal every PDF/DOCX formatting risk.

## D-008 — Preview processing boundary

Until Firebase/Cloud Storage and malware scanning are configured, the `/review` shell performs local metadata/signature checks and text-only analysis in the browser. It does not upload or persist files, avoiding a misleadingly insecure temporary server upload path.

This preview-only boundary was retired when the dedicated private bucket, scoped runtime identity, and authenticated ingestion endpoint became available. Production release remains gated on malware scanning and isolated parsing.

## D-009 — Extracted profiles require confirmation

Resume parsing may create a structured draft with confidence and warnings, but it cannot mutate a confirmed canonical profile. The user must explicitly apply, review, correct, and save the draft. Extraction also cannot enable public-profile or open-to-work settings.

## D-010 — Public profiles use a separate safe read model

Public pages never read the private canonical profile directly. Enabling sharing creates or updates a deliberately limited `public_profiles` record without email or phone; disabling sharing marks that record unpublished immediately. Public pages are `noindex` by default during staging.
