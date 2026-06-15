# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build the React frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS frontend-build

WORKDIR /build/frontend

# Install deps separately so Docker layer cache survives source-only changes
COPY frontend/package*.json ./
RUN npm ci --prefer-offline

COPY frontend/ ./
RUN npm run build
# Output lands in /build/app/static (vite.config.js outDir: ../app/static)


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Production API image
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS api

LABEL org.opencontainers.image.title="PFI Platform" \
      org.opencontainers.image.description="Personalised Fitness Intelligence Platform" \
      org.opencontainers.image.vendor="PFI" \
      org.opencontainers.image.licenses="Proprietary"

# ── System deps ────────────────────────────────────────────────────────────
# curl  → Docker/Azure health-check probe
# ca-certificates → HTTPS requests from the API (e.g. future webhook calls)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python deps ────────────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── Application source ─────────────────────────────────────────────────────
COPY . .

# ── Frontend assets (from Stage 1) ─────────────────────────────────────────
COPY --from=frontend-build /build/app/static ./app/static

# ── DuckDB data directory ───────────────────────────────────────────────────
# In production this path is replaced by an Azure Files volume mount.
# The directory is created here as a fallback for local Docker Compose usage.
RUN mkdir -p /data

# ── Environment defaults ────────────────────────────────────────────────────
# All of these can be overridden by container environment variables.
ENV PORT=8000 \
    LOG_LEVEL=info \
    DATABASE_URL=duckdb:////data/pfi.db \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# ── Health check ────────────────────────────────────────────────────────────
# Docker-level probe; Azure Container Apps also configures its own HTTP probe
# against /health (see azure/containerapp.yaml).
HEALTHCHECK \
    --interval=30s \
    --timeout=10s \
    --start-period=60s \
    --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health" | grep -q '"status":"ok"' || exit 1

# ── Startup ─────────────────────────────────────────────────────────────────
# Single worker is intentional: DuckDB is a single-writer database.
# Horizontal scaling is handled at the Azure Container Apps level by keeping
# min/max replicas both at 1 (see azure/containerapp.yaml).
CMD ["sh", "-c", \
     "uvicorn app.main:app \
        --host 0.0.0.0 \
        --port ${PORT} \
        --workers 1 \
        --log-level $(echo ${LOG_LEVEL} | tr '[:upper:]' '[:lower:]') \
        --access-log \
        --no-use-colors"]
