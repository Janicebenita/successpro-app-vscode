# Deployment runbook

## Environment policy

Use separate Google Cloud projects for staging and production. Phase 0 creates staging only. Enable billing alerts before deploying; alerts do not cap spending, so Cloud Run instance limits, quotas, rate limits, and application allowances remain mandatory.

## First staging bootstrap

1. Create a Google Cloud project dedicated to SuccessPro staging and link billing.
2. In a terminal authenticated with an owner-approved Google account, set `GOOGLE_CLOUD_PROJECT` to that exact project ID.
3. Run `infra/scripts/bootstrap-staging.sh`.
4. In Google Cloud Console → Billing → Budgets & alerts, create a small monthly budget with email thresholds at 50%, 80%, and 100%.
5. Grant the Cloud Build identity only Artifact Registry Writer on the `successpro` repository, Logs Writer on the staging project, and Service Account User on the staging runtime identity. Do not grant project Editor or Cloud Run Admin.
6. Build and push with `gcloud builds submit --config infra/cloudbuild/staging.yaml --substitutions _IMAGE_TAG=<immutable-release-tag> .`.
7. Resolve and record the pushed image digest. Deploy that immutable digest—not only its mutable tag—with an explicit revision suffix and the documented runtime identity/resource limits. Cloud Build does not deploy.
8. This service uses revision-pinned traffic for safe rollback, so a successful `gcloud run deploy` does not imply that the new revision is receiving requests. Explicitly run `gcloud run services update-traffic ... --to-revisions NEW_REVISION=100` after the revision is ready.
9. Verify that `latestReadyRevisionName`, the sole traffic target, and the intended revision all match at 100%; then smoke test `/`, `/login`, `/signup`, `/dashboard`, `/admin`, and `/api/health` and inspect error-level logs.
10. Record the exact image tag, digest, revision, and checks in `STATUS.md`. Treat an unchanged serving revision as an incomplete release, not as success.

## Release verification

- CI green: lint, type check, unit tests, build, high-severity dependency audit
- E2E desktop/mobile smoke tests green
- No real PII or secrets in build/logs
- Health check returns `status: ok`
- Security headers verified
- Cloud Run min 0, max 3, 1 CPU, 512 MiB, concurrency 40, timeout 30s
- Logs inspected for boot/runtime errors

## Monitoring alerts

Create an owner-controlled email, paging, or incident-management notification channel, then configure the versioned policies:

```bash
GOOGLE_CLOUD_PROJECT=successpro-staging-1706786b \
NOTIFICATION_CHANNEL='projects/PROJECT/notificationChannels/CHANNEL_ID' \
infra/scripts/configure-monitoring-alerts.sh
```

The policies alert for sustained Cloud Run 5xx responses and p95 latency. Test notification delivery through the channel's approved test mechanism; do not generate customer-facing failures to test it. Add quota, budget, provider-health, and production-specific alert policies before production launch.

## Scheduled automation

Use the dedicated `successpro-automation` service account and a Cloud Run audience equal to the service origin. Staging runs FX reference refresh at 01:30 UTC, job-source ingestion/feed generation at 02:00 UTC, and retention cleanup at 02:30 UTC. Each endpoint must return `401` without its OIDC identity. After creating or changing a job, invoke it manually once and verify an HTTP 200 request in Cloud Run logs before relying on its schedule.

The FX endpoint is `/api/internal/fx-refresh`. It reads the fixed official ECB daily XML reference file, normalizes EUR-base rates to INR, retains the source date, and writes dated `fx_rates` plus monthly per-currency `price_book` records. Failure leaves the last valid records untouched; customer signup refuses unavailable or stale non-INR locks rather than guessing a price.

## Rollback

Use `infra/scripts/rollback-cloud-run.sh`. It refuses split traffic, validates the exact target revision and Ready state, performs a dry run unless the target name is repeated through `--confirm`, moves 100% traffic without rebuilding, verifies the observed revision, probes `/` and `/api/health`, and writes timestamped evidence under `output/rollback-evidence/`.

```bash
infra/scripts/rollback-cloud-run.sh \
  --project successpro-staging-1706786b \
  --service successpro-web-staging \
  --region asia-south1 \
  --target PREVIOUS_HEALTHY_REVISION

# After reviewing the dry-run output:
infra/scripts/rollback-cloud-run.sh \
  --project successpro-staging-1706786b \
  --service successpro-web-staging \
  --region asia-south1 \
  --target PREVIOUS_HEALTHY_REVISION \
  --confirm PREVIOUS_HEALTHY_REVISION
```

Record the failed release and evidence path in the incident record. Freeze the failed revision; do not overwrite or delete evidence. To restore a corrected/newer healthy revision, run the same command with that exact revision as both `--target` and `--confirm`.

## Production additions

Production requires tested data export/restore, storage lifecycle/versioning decisions, monitoring/uptime alerts, email DNS/deliverability, approved policies, live payment approval, custom-domain DNS, and an explicit rollback owner.

For database and private-file recovery, follow [the data recovery runbook](DATA_RECOVERY_RUNBOOK.md). An application rollback does not restore data.
