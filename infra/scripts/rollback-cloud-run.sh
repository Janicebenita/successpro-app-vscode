#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 --project PROJECT --service SERVICE --region REGION --target REVISION [--confirm REVISION] [--evidence-dir DIR]" >&2
}

project=""
service=""
region=""
target=""
confirm=""
evidence_dir="output/rollback-evidence"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) project="${2:-}"; shift 2 ;;
    --service) service="${2:-}"; shift 2 ;;
    --region) region="${2:-}"; shift 2 ;;
    --target) target="${2:-}"; shift 2 ;;
    --confirm) confirm="${2:-}"; shift 2 ;;
    --evidence-dir) evidence_dir="${2:-}"; shift 2 ;;
    *) usage; exit 2 ;;
  esac
done

if [[ -z "$project" || -z "$service" || -z "$region" || -z "$target" ]]; then usage; exit 2; fi
if [[ ! "$project" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ || ! "$service" =~ ^[a-z][a-z0-9-]{1,62}$ || ! "$region" =~ ^[a-z0-9-]+$ || ! "$target" =~ ^[a-z][a-z0-9-]{2,62}$ ]]; then
  echo "Project, service, region, or revision format is invalid." >&2; exit 2
fi

gcloud_bin="${GCLOUD_BIN:-gcloud}"
traffic="$($gcloud_bin run services describe "$service" --project "$project" --region "$region" --format='csv[no-heading](status.traffic.revisionName,status.traffic.percent)')"
if [[ "$(printf '%s\n' "$traffic" | sed '/^$/d' | wc -l | tr -d ' ')" != "1" ]]; then echo "The service does not have exactly one traffic target; stop and inspect split traffic." >&2; exit 1; fi
current="$(printf '%s\n' "$traffic" | awk -F, '$2 == 100 { print $1 }')"
if [[ -z "$current" ]]; then echo "The service has no single 100% traffic revision; stop and inspect split traffic." >&2; exit 1; fi
if [[ "$current" == "$target" ]]; then echo "Target revision already serves 100% of traffic: $target"; exit 0; fi

target_ready="$($gcloud_bin run revisions describe "$target" --project "$project" --region "$region" --format='value(status.conditions[0].status)')"
target_image="$($gcloud_bin run revisions describe "$target" --project "$project" --region "$region" --format='value(spec.containers[0].image)')"
if [[ "$target_ready" != "True" || -z "$target_image" ]]; then echo "Target revision is not Ready: $target" >&2; exit 1; fi

service_url="$($gcloud_bin run services describe "$service" --project "$project" --region "$region" --format='value(status.url)')"
echo "Current revision: $current"
echo "Rollback target:  $target"
echo "Target image:     $target_image"
echo "Service URL:      $service_url"

if [[ "$confirm" != "$target" ]]; then
  echo "Dry run only. Re-run with --confirm $target to move 100% traffic."; exit 0
fi

mkdir -p "$evidence_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
evidence="$evidence_dir/${service}-${timestamp}-${target}.txt"
{
  echo "started_at=$timestamp"
  echo "project=$project"
  echo "region=$region"
  echo "service=$service"
  echo "from_revision=$current"
  echo "to_revision=$target"
  echo "target_image=$target_image"
  echo "service_url=$service_url"
} > "$evidence"

$gcloud_bin run services update-traffic "$service" --project "$project" --region "$region" --to-revisions "$target=100" --quiet
observed="$($gcloud_bin run services describe "$service" --project "$project" --region "$region" --format='csv[no-heading](status.traffic.revisionName,status.traffic.percent)' | awk -F, '$2 == 100 { print $1 }')"
if [[ "$observed" != "$target" ]]; then echo "Traffic verification failed: expected $target, observed $observed" >&2; exit 1; fi

health_code="$(curl -sS -o /dev/null -w '%{http_code}' "$service_url/api/health")"
root_code="$(curl -sS -o /dev/null -w '%{http_code}' "$service_url/")"
if [[ "$health_code" != "200" || "$root_code" != "200" ]]; then echo "Rollback smoke test failed: health=$health_code root=$root_code" >&2; exit 1; fi
{
  echo "completed_at=$(date -u +%Y%m%dT%H%M%SZ)"
  echo "observed_revision=$observed"
  echo "health_http=$health_code"
  echo "root_http=$root_code"
  echo "result=passed"
} >> "$evidence"
echo "Rollback passed. Evidence: $evidence"
