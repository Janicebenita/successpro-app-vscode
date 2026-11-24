# Local resume processing

Everything here is local-only. The existing resume flow is unchanged while both feature flags are `false`.

## VS Code terminal setup

Install Python 3.11+, Docker Desktop, and LibreOffice, then restart VS Code. From the repository root:

```powershell
python -m venv processing/.venv
processing/.venv/Scripts/Activate.ps1
python -m pip install -r processing/requirements.txt
docker compose -f processing/docker-compose.yml up -d
Copy-Item processing/.env.example apps/web/.env.local
```

Set both feature flags to `true` in `apps/web/.env.local`, but keep `RESUME_AI_PROVIDER=mock`. Then use two terminals:

```powershell
pnpm processing:worker
pnpm dev
```

MySQL stores extraction, AI output, and user-confirmed output separately. Redis provides leases, locks, retries, checkpoints, acknowledgement, and dead-letter handling. PyMuPDF/python-docx extract text; LibreOffice supplies DOCX page layout; OpenCV only calculates one-page-at-a-time visual metrics. All page images and converted PDFs are temporary and cleaned up.
