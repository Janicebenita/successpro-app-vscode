#!/usr/bin/env bash
set -euo pipefail

: "${GOOGLE_CLOUD_PROJECT:?Set GOOGLE_CLOUD_PROJECT to the staging project ID}"
REGION="${GOOGLE_CLOUD_REGION:-asia-south1}"

gcloud config set project "${GOOGLE_CLOUD_PROJECT}"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com monitoring.googleapis.com
gcloud artifacts repositories describe successpro --location "${REGION}" >/dev/null 2>&1 || gcloud artifacts repositories create successpro --repository-format docker --location "${REGION}"
gcloud iam service-accounts describe "successpro-web-staging@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com" >/dev/null 2>&1 || gcloud iam service-accounts create successpro-web-staging --display-name "SuccessPro web staging"

echo "Baseline resources are ready. Create a small billing budget and notification channel in the console before the first deployment, then run infra/scripts/configure-monitoring-alerts.sh with NOTIFICATION_CHANNEL set."
