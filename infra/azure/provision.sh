#!/usr/bin/env bash
# Provisions the Code.ae Azure foundation.
# Idempotent: re-running is safe.

set -euo pipefail

RG="${AZURE_RESOURCE_GROUP:-code-ae-dev}"
LOC="${AZURE_LOCATION:-uaenorth}"
PROJECT="${AZURE_PROJECT_TAG:-code-ae}"

ACR_NAME="${ACR_NAME:-codeaeacr$RANDOM}"
KV_NAME="${KV_NAME:-codeae-kv-dev}"
ST_NAME="${ST_NAME:-codeaestdev$RANDOM}"
ACA_ENV="${ACA_ENV:-code-ae-env}"
LOG_WS="${LOG_WS:-code-ae-logs}"
PG_NAME="${PG_NAME:-code-ae-pg-dev}"
PG_ADMIN="${PG_ADMIN:-codeaeadmin}"
PG_PASSWORD="${PG_PASSWORD:?set PG_PASSWORD env var before running}"

echo "==> resource group"
az group create --name "$RG" --location "$LOC" --tags project="$PROJECT" --output none

echo "==> log analytics workspace"
az monitor log-analytics workspace create \
  --resource-group "$RG" --workspace-name "$LOG_WS" --location "$LOC" --output none

LOG_WS_ID=$(az monitor log-analytics workspace show --resource-group "$RG" --workspace-name "$LOG_WS" --query customerId -o tsv)
LOG_WS_KEY=$(az monitor log-analytics workspace get-shared-keys --resource-group "$RG" --workspace-name "$LOG_WS" --query primarySharedKey -o tsv)

echo "==> container registry"
az acr create --resource-group "$RG" --name "$ACR_NAME" --sku Basic --admin-enabled true --location "$LOC" --output none

echo "==> container apps environment"
az containerapp env create \
  --resource-group "$RG" --name "$ACA_ENV" --location "$LOC" \
  --logs-workspace-id "$LOG_WS_ID" --logs-workspace-key "$LOG_WS_KEY" --output none

echo "==> key vault"
az keyvault create --resource-group "$RG" --name "$KV_NAME" --location "$LOC" --enable-rbac-authorization true --output none

echo "==> storage account (project snapshots)"
az storage account create --resource-group "$RG" --name "$ST_NAME" --location "$LOC" --sku Standard_LRS --kind StorageV2 --output none

echo "==> postgres flexible server (platform db)"
az postgres flexible-server create \
  --resource-group "$RG" --name "$PG_NAME" --location "$LOC" \
  --admin-user "$PG_ADMIN" --admin-password "$PG_PASSWORD" \
  --sku-name Standard_B1ms --tier Burstable --version 16 \
  --storage-size 32 --public-access 0.0.0.0 --yes --output none || echo "(postgres may already exist)"

az postgres flexible-server db create --resource-group "$RG" --server-name "$PG_NAME" --database-name codeae --output none || true

cat <<EOF

=== code.ae Azure provisioning complete ===
  Resource group : $RG
  Location       : $LOC
  ACR            : $ACR_NAME.azurecr.io
  ACA env        : $ACA_ENV
  Key Vault      : $KV_NAME
  Storage        : $ST_NAME
  Postgres       : $PG_NAME.postgres.database.azure.com (db: codeae)

Next:
  - Build + push images to \$ACR.azurecr.io
  - az containerapp create for web, api, orchestrator
EOF
