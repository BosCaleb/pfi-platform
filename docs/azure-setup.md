# Azure Container Apps — One-Time Setup Guide

This guide walks through creating every Azure resource the PFI Platform needs.
Run these commands once. After that, every push to `main` is deployed automatically
by the GitHub Actions pipeline in `.github/workflows/main.yml`.

---

## Prerequisites

| Tool | Install |
|------|---------|
| Azure CLI 2.55+ | `winget install Microsoft.AzureCLI` |
| An Azure subscription | [portal.azure.com](https://portal.azure.com) |
| Docker Hub account | [hub.docker.com](https://hub.docker.com) |
| A GitHub repository | This repository |

Verify the CLI is ready:

```bash
az --version
az login
az account show      # confirm the right subscription is selected
```

---

## Step 1 — Set variables

Run this block once in your terminal. Every command below references these
variables so you only need to change them in one place.

```bash
SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
RESOURCE_GROUP="pfi-rg"
LOCATION="eastus"                        # change to the region nearest your users
ENVIRONMENT_NAME="pfi-env"
APP_NAME="pfi-platform"
STORAGE_ACCOUNT="pfistorage$RANDOM"     # must be globally unique, 3-24 lowercase chars
FILE_SHARE_NAME="pfi-data"
STORAGE_MOUNT_NAME="pfi-storage"
DOCKERHUB_IMAGE="<YOUR_DOCKERHUB_USERNAME>/pfi-platform:latest"
```

---

## Step 2 — Resource group

```bash
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION"
```

---

## Step 3 — Container Apps environment

The environment is the shared networking and logging layer. All container
apps in the same environment share a virtual network.

```bash
az containerapp env create \
  --name "$ENVIRONMENT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION"
```

> **Logging:** Azure Container Apps environments send logs to Azure Monitor
> automatically. No extra configuration is needed. View logs with:
> ```bash
> az containerapp logs show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --follow
> ```

---

## Step 4 — Azure Storage (DuckDB persistence)

DuckDB is a file-based database. The database file must persist across
container restarts, which means it needs to live on a network-attached volume.
Azure Files provides this.

### 4a — Create storage account

```bash
az storage account create \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2
```

### 4b — Create file share

```bash
az storage share create \
  --name "$FILE_SHARE_NAME" \
  --account-name "$STORAGE_ACCOUNT" \
  --quota 5   # GB — adjust as your data grows
```

### 4c — Get the storage key

```bash
STORAGE_KEY="$(az storage account keys list \
  --resource-group "$RESOURCE_GROUP" \
  --account-name "$STORAGE_ACCOUNT" \
  --query "[0].value" -o tsv)"
```

### 4d — Register the storage with the Container Apps environment

```bash
az containerapp env storage set \
  --name "$ENVIRONMENT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --storage-name "$STORAGE_MOUNT_NAME" \
  --azure-file-account-name "$STORAGE_ACCOUNT" \
  --azure-file-account-key "$STORAGE_KEY" \
  --azure-file-share-name "$FILE_SHARE_NAME" \
  --access-mode ReadWrite
```

---

## Step 5 — Generate a strong secret key

```bash
SECRET_KEY="$(python -c "import secrets; print(secrets.token_hex(32))")"
echo "SECRET_KEY: $SECRET_KEY"  # save this — you will need it again
```

---

## Step 6 — Create the Container App

This is the initial creation. Every subsequent deployment is handled
automatically by the CI/CD pipeline.

```bash
az containerapp create \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENVIRONMENT_NAME" \
  --image "$DOCKERHUB_IMAGE" \
  --target-port 8000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 1 \
  --cpu 0.5 \
  --memory 1Gi \
  --secrets \
      secret-key="$SECRET_KEY" \
      admin-email="admin@yourorg.com" \
      admin-password="ChangeMe123!" \
  --env-vars \
      DATABASE_URL="duckdb:////data/pfi.db" \
      SECRET_KEY=secretref:secret-key \
      ALLOW_ADMIN_SEED="true" \
      DEFAULT_ADMIN_EMAIL=secretref:admin-email \
      DEFAULT_ADMIN_PASSWORD=secretref:admin-password \
      LOG_LEVEL="info" \
      ENV="production" \
      PYTHONUNBUFFERED="1"
```

> ⚠️ **`--min-replicas 1` and `--max-replicas 1` are non-negotiable.**
> DuckDB is a single-writer database. Running two replicas simultaneously
> will corrupt the database file. Never increase max-replicas above 1.

---

## Step 7 — Attach the Azure Files volume

```bash
# This must be done after the app is created (az containerapp create
# does not support volume mounts inline on first creation).

az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --storage-name "$STORAGE_MOUNT_NAME" \
  --storage-type AzureFile \
  --mount-path /data
```

Verify the mount is attached:

```bash
az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.template.volumes"
```

---

## Step 8 — Configure health probes

```bash
# Liveness probe — restart the container if /health stops returning 200
az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --liveness-probe-path /health \
  --liveness-probe-period 30 \
  --liveness-probe-initial-delay 30 \
  --liveness-probe-failure-count-threshold 3

# Readiness probe — stop routing traffic if the app is not ready
az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --readiness-probe-path /health \
  --readiness-probe-period 15 \
  --readiness-probe-initial-delay 15
```

---

## Step 9 — Get the public URL and update CORS

```bash
APP_FQDN="$(az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)"

echo "App URL: https://$APP_FQDN"

# Update CORS to allow only your own domain (remove the wildcard)
az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars CORS_ORIGINS="https://$APP_FQDN"
```

Open `https://$APP_FQDN/ui` in your browser and log in with the admin
credentials you set in Step 6.

After a successful first login, **disable admin seeding**:

```bash
az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars ALLOW_ADMIN_SEED="false"
```

---

## Step 10 — Set GitHub Actions secrets and variables

Go to **GitHub → Settings → Secrets and variables → Actions**.

### Secrets (encrypted)

| Secret name | Value |
|-------------|-------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token (Settings → Security → Access Tokens) |
| `AZURE_CREDENTIALS` | Output of the command below |
| `SECRET_KEY` | The value from Step 5 |
| `DEFAULT_ADMIN_EMAIL` | Your admin email |
| `DEFAULT_ADMIN_PASSWORD` | Your admin password |

Generate `AZURE_CREDENTIALS`:

```bash
az ad sp create-for-rbac \
  --name "pfi-github-actions" \
  --role contributor \
  --scopes "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
  --sdk-auth
```

Copy the entire JSON output as the value of the `AZURE_CREDENTIALS` secret.

### Variables (not encrypted — visible in logs)

Go to **Settings → Variables → Actions**.

| Variable name | Value |
|---------------|-------|
| `AZURE_RESOURCE_GROUP` | `pfi-rg` |
| `AZURE_CONTAINERAPP_NAME` | `pfi-platform` |

---

## Step 11 — Trigger the first pipeline run

```bash
git push origin main
```

Watch the pipeline at **GitHub → Actions → CI/CD → Docker Hub → Azure Container Apps**.

---

## Ongoing operations

### View live logs

```bash
az containerapp logs show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --follow
```

### View a specific revision's logs

```bash
az containerapp revision list \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[].name" -o table

az containerapp logs show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --revision "<revision-name>"
```

### Check health manually

```bash
curl -s "https://$APP_FQDN/health" | python -m json.tool
```

Expected response:

```json
{
  "status": "ok",
  "database": "ok",
  "latency_ms": 2.1,
  "service": "PFI Platform"
}
```

### Roll back to a previous revision

```bash
# List revisions
az containerapp revision list \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[].{Name:name, Active:properties.active, Created:properties.createdTime}" \
  --output table

# Activate a previous revision (instant rollback — no redeployment)
az containerapp revision activate \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --revision "<previous-revision-name>"
```

### Reset admin password

```bash
az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars ALLOW_ADMIN_SEED="true"

# Wait ~30 seconds for the new revision to start, then disable again:
az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars ALLOW_ADMIN_SEED="false"
```

### Backup the DuckDB database

```bash
# Download the database file from the Azure File Share
az storage file download \
  --account-name "$STORAGE_ACCOUNT" \
  --account-key "$STORAGE_KEY" \
  --share-name "$FILE_SHARE_NAME" \
  --path "pfi.db" \
  --dest "./backup-$(date +%Y%m%d).db"
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Container keeps restarting | `az containerapp logs show` — look for Python tracebacks |
| `/health` returns 503 | Database file missing or corrupt — check Azure Files mount |
| Login returns 401 | `ALLOW_ADMIN_SEED` not set, or wrong `SECRET_KEY` env var |
| CORS error in browser | `CORS_ORIGINS` env var doesn't match your actual URL |
| Pipeline deploy fails | Check `AZURE_CREDENTIALS` secret hasn't expired (90-day default) |
| DuckDB IO error on startup | Another process (old revision) has the file locked — wait for it to stop |

---

## Architecture summary

```
GitHub (main push)
    │
    ▼
GitHub Actions
    ├── 1. Test (lint + type-check + pytest)
    ├── 2. Build Docker image → push to Docker Hub
    └── 3. az containerapp update ──────────────────────────────┐
                                                                 │
Azure Container Apps Environment (pfi-env)                       │
    └── Container App: pfi-platform  ◄───────────────────────────┘
            │   port 8000 (uvicorn, 1 worker, 1 replica)
            │   /health → liveness + readiness probes
            │
            ├── /data  ← Azure Files mount (pfi-data share)
            │       └── pfi.db  (DuckDB database)
            │
            └── HTTPS ingress (Azure-managed TLS)
                    └── https://<app>.azurecontainerapps.io
                            ├── /ui      → Admin app
                            ├── /portal  → Member portal
                            ├── /api/*   → REST API
                            └── /health  → Health probe
```
