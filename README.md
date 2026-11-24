# SuccessPro

SuccessPro is a privacy-first career operating system for professionals and job seekers. The repository contains the deployed Phase 1 acquisition journey: verified authentication, versioned career profiles, private resume ingestion, deterministic ATS review, job-description matching, goals, preferences, and the base dashboard.

## Quick start

Requirements: Node.js 22+ and pnpm 10+.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`. Copy the Firebase web configuration and server environment values described in `.env.example` before testing authenticated features.

## Verification

```bash
pnpm check
pnpm test:e2e
```

## Documentation

Start with [STATUS.md](STATUS.md), [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md), and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). External and production launch gates are tracked in [BLOCKERS.md](BLOCKERS.md); the governing source brief remains under `successpro_codex_bundle/`.
