#!/usr/bin/env bash
set -euo pipefail

: "${GOOGLE_CLOUD_PROJECT:?Set GOOGLE_CLOUD_PROJECT}"
: "${NOTIFICATION_CHANNEL:?Set NOTIFICATION_CHANNEL to an existing Cloud Monitoring notification-channel resource name}"

root="$(cd "$(dirname "$0")/../.." && pwd)"
python_bin="${PYTHON_BIN:-python3}"
command -v "$python_bin" >/dev/null 2>&1 || {
  echo "Python 3 is required to prepare the versioned alert policies." >&2
  exit 1
}

for policy in "$root"/infra/monitoring/cloud-run-5xx-alert.json "$root"/infra/monitoring/cloud-run-latency-alert.json; do
  prepared="$(mktemp)"
  trap 'rm -f "$prepared"' EXIT
  "$python_bin" - "$policy" "$prepared" "$NOTIFICATION_CHANNEL" <<'PYTHON'
import json
import sys

source_path, output_path, channel = sys.argv[1:]
with open(source_path, encoding="utf-8") as source_file:
    policy = json.load(source_file)
policy["notificationChannels"] = [channel]
with open(output_path, "w", encoding="utf-8") as output_file:
    json.dump(policy, output_file, indent=2)
    output_file.write("\n")
PYTHON
  gcloud monitoring policies create --project "$GOOGLE_CLOUD_PROJECT" --policy-from-file "$prepared"
  rm -f "$prepared"
  trap - EXIT
done

echo "Created Cloud Run alert policies. Verify delivery by testing the notification channel; do not create artificial customer-facing errors."
