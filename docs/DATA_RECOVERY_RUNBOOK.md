# Data recovery runbook

This runbook governs SuccessPro's Firestore and private-object recovery. It is deliberately separate from a Cloud Run rollback: rolling application traffic back does not restore data.

## Guardrails

- Do not import an export into the active production database.
- Use a separate recovery project or an empty, explicitly approved recovery database.
- Record the incident ID, export prefix, operator, start/end time, document counts, sample-record checks, and approver.
- Do not expose private resume objects through public URLs during recovery.
- Treat any import, object replacement, or access-control change as a production change requiring an approved backup point.

## Staging evidence

On 2026-09-27, staging completed a Firestore export at:

`gs://successpro-staging-1706786b-private/backups/firestore-backup-2026-09-27T05-45-35-932Z`

The overall manifest and all namespace/kind shard metadata were verified. The private bucket has uniform bucket-level access, public access prevention, versioning, a seven-day soft-delete window, a 30-day noncurrent-version lifecycle, and 90-day backup retention. A dedicated non-customer sentinel object was overwritten and recovered from its earlier generation successfully.

This proves export availability and object-version retrieval. It does **not** prove Firestore import recovery; complete the next procedure before production approval.

## Firestore recovery drill

1. Create or select a separate recovery project with Firestore Native in the appropriate region. Do not use the live project.
2. Grant the operator only the permissions required to read the export and import into the recovery database.
3. Copy the chosen immutable export prefix into a bucket readable by the recovery project if cross-project access is not already controlled.
4. Import only to the recovery target:

```bash
gcloud firestore import \
  gs://RECOVERY_BUCKET/backups/EXPORT_PREFIX/EXPORT_PREFIX.overall_export_metadata \
  --project=RECOVERY_PROJECT \
  --database='(default)'
```

5. Wait for the operation to complete. Save the operation ID and terminal status.
6. Verify expected collection names, document counts, server timestamps, ownership fields, and a small approved sample of profile/resume/document-draft records without printing their contents into logs.
7. Verify bucket access is still private and that no recovered object can be fetched anonymously.
8. Record recovery-time objective/actual duration, recovery-point timestamp, defects, and the evidence location in the incident record.
9. Delete the recovery database/project only after the retention decision and incident review are complete.

## Private-object recovery

For an accidental overwrite, first identify the prior object generation and retrieve it to a controlled private path. Verify its digest before replacing any live object.

```bash
gcloud storage cp \
  'gs://PRIVATE_BUCKET/path/to/object#PRIOR_GENERATION' \
  /controlled/private/recovery-copy
```

For accidental deletion within the soft-delete window, use Cloud Storage's restore flow with the object's generation. Never restore a resume object to a different member path without an approved incident and ownership check.

## Production readiness requirement

Before production launch, run and pass this complete import drill against a separate recovery target at least once, and repeat after any material Firestore schema, storage-policy, or regional architecture change.
