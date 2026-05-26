# CyberFit Backend

**Personalised Fitness Intelligence (PFI) Platform** — FastAPI backend with DuckDB storage, React frontend, and Docker-based deployment.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Testing](#testing)
- [API Reference](#api-reference)
- [Docker Deployment](#docker-deployment)
- [Security Notes](#security-notes)
- [Contributing](#contributing)

---

## Overview

CyberFit provides coaches and gym administrators with tools to manage member profiles, fitness assessments, progress tracking, and personalised workout, nutrition, and supplement plans.

**Tech stack:**

| Layer      | Technology                          |
|------------|-------------------------------------|
| Backend    | Python 3.11, FastAPI, SQLAlchemy 2  |
| Database   | DuckDB (embedded, file-based)       |
| Auth       | JWT (HS256) via `python-jose`       |
| Frontend   | React 18, Vite 5                    |
| Container  | Docker + Docker Compose             |

---

## Architecture

```
cyberfit-backend/
├── app/                    # FastAPI application
│   ├── main.py             # App factory, middleware, router registration
│   ├── auth.py             # JWT helpers, password hashing
│   ├── config.py           # Feature flags from environment
│   ├── database.py         # SQLAlchemy engine and session factory
│   ├── models.py           # ORM models (Admin, Member, plans, etc.)
│   ├── schemas.py          # Pydantic v2 request/response schemas
│   ├── computed.py         # Business logic: BMI, risk scores, strength index
│   ├── routers/            # One file per API domain
│   │   ├── auth.py         # POST /api/auth/login, /api/auth/seed
│   │   ├── members.py      # CRUD /api/members
│   │   ├── assessments.py  # /api/assessments
│   │   ├── progress.py     # /api/progress
│   │   ├── workout_plans.py
│   │   ├── nutrition_plans.py
│   │   ├── supplement_plans.py
│   │   ├── dashboard.py    # /api/dashboard/stats
│   │   └── settings.py     # /api/settings
│   └── static/             # Compiled frontend (served at /ui)
├── frontend/               # React + Vite SPA
│   ├── src/
│   │   ├── App.jsx         # Main application component
│   │   ├── main.jsx        # React entry point
│   │   └── styles.css      # Design system (CSS variables, dark theme)
│   ├── package.json
│   └── vite.config.js
├── tests/                  # Pytest test suite
│   ├── conftest.py         # Shared fixtures
│   ├── test_auth.py        # Auth unit tests
│   └── test_computed.py    # Business logic unit tests
├── data/                   # DuckDB database files (git-ignored)
├── .env.example            # Environment variable template
├── docker-compose.yml      # Container orchestration
├── Dockerfile              # Multi-stage build
├── pyproject.toml          # Python tooling config (ruff, black, pytest)
└── requirements.txt        # Python runtime dependencies
```

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- Docker & Docker Compose (for containerised dev/prod)

---

## Quick Start

### 1. Clone and configure

```bash
git clone <repo-url>
cd cyberfit-backend

cp .env.example .env
# Edit .env — set SECRET_KEY and DEFAULT_ADMIN_PASSWORD before starting
```

### 2. Run with Docker (recommended)

```bash
docker compose up --build
```

The API is available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`  
Frontend UI: `http://localhost:8000/ui`

### 3. Run locally (development)

**Backend:**

```bash
python -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # macOS / Linux

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

### 4. Seed the first admin

Enable seeding in `.env`:

```env
ALLOW_ADMIN_SEED=true
DEFAULT_ADMIN_EMAIL=admin@yourorg.com
DEFAULT_ADMIN_PASSWORD=YourStrongPassword!
```

Then call:

```bash
curl -X POST http://localhost:8000/api/auth/seed
```

**Disable `ALLOW_ADMIN_SEED` immediately after the first login.**

---

## Environment Variables

All variables are documented in [.env.example](.env.example).

| Variable                      | Required | Default                  | Description                               |
|-------------------------------|----------|--------------------------|-------------------------------------------|
| `DATABASE_URL`                | Yes      | —                        | DuckDB connection string                  |
| `SECRET_KEY`                  | Yes      | —                        | JWT signing secret (min 32 chars)         |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No       | `480`                    | JWT lifetime in minutes                   |
| `ALLOW_ADMIN_SEED`            | No       | `false`                  | Enable default admin creation endpoint    |
| `DEFAULT_ADMIN_EMAIL`         | No       | `admin@pfi-platform.local` | Seed admin email                        |
| `DEFAULT_ADMIN_PASSWORD`      | No       | `admin123`               | Seed admin password — **change this**     |
| `CORS_ORIGINS`                | No       | `*`                      | Comma-separated allowed frontend origins  |
| `LOG_LEVEL`                   | No       | `INFO`                   | Python logging level                      |

---

## Development

### Python linting and formatting

```bash
pip install ruff black

ruff check .          # lint
ruff check . --fix    # auto-fix safe issues
black .               # format
```

### Frontend linting and formatting

```bash
cd frontend
npm install
npm run lint          # ESLint
npm run format        # Prettier
```

### Pre-commit (optional but recommended)

```bash
pip install pre-commit
pre-commit install
```

---

## Testing

```bash
pip install pytest pytest-cov httpx

# Run all tests
pytest

# With coverage report
pytest --cov=app --cov-report=term-missing

# Run a specific module
pytest tests/test_auth.py -v
```

---

## API Reference

Full interactive documentation is auto-generated by FastAPI:

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **OpenAPI JSON:** `http://localhost:8000/openapi.json`

### Authentication

All protected endpoints require:

```
Authorization: Bearer <access_token>
```

Obtain a token via `POST /api/auth/login`:

```json
{
  "email": "admin@example.com",
  "password": "your-password"
}
```

---

## Docker Deployment

Build and run the production image:

```bash
docker compose up --build -d
```

Data is persisted in `./data/` via a Docker volume mount.

To update:

```bash
git pull
docker compose up --build -d
```

---

## Security Notes

- Always set a strong, unique `SECRET_KEY` in production.
- Disable `ALLOW_ADMIN_SEED` after initial setup.
- Restrict `CORS_ORIGINS` to your actual frontend origin(s).
- The API serves sensitive health data — enable HTTPS via a reverse proxy (nginx, Caddy, Traefik) in production.
- Review [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, commit message format, and code standards.
