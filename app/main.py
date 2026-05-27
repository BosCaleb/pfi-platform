"""
CyberFit Backend — FastAPI application factory.

Responsibilities:
- Configure structured logging before anything else.
- Create database tables on startup.
- Apply CORS middleware with environment-controlled origins.
- Register all domain routers.
- Serve the compiled React frontend as a static SPA.
"""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.database import Base, engine
from app.limiter import limiter
from app.routers import (
    assessments,
    auth,
    dashboard,
    members,
    nutrition_plans,
    progress,
    settings,
    supplement_plans,
    workout_plans,
    # Phase 2 — Workout Intelligence
    workout_groups,
    exercise_library,
    plan_builder,
    member_groups,
    workout_sessions,
    reassessment_alerts,
    safety,
    # Phase 3.1 — Check-Ins and Coaching Intelligence
    check_ins,
    weekly_check_ins,
    readiness,
    coach_tasks,
    pain_flags,
    nutrition_logs,
    member_portal,
)

# ------------------------------------------------------------------ #
# Logging                                                              #
# ------------------------------------------------------------------ #

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ #
# Database bootstrap                                                   #
# ------------------------------------------------------------------ #


def _ensure_member_consent_columns() -> None:
    """Add consent columns to the members table if they do not yet exist.

    Uses DuckDB's ``information_schema`` directly instead of SQLAlchemy's
    ``inspect()`` / dialect reflection.  The SQLAlchemy reflection path
    routes through the Postgres dialect, which tries to query
    ``pg_catalog.pg_collation`` — a table DuckDB does not implement —
    and also emits a flood of ``SAWarning`` messages for every column
    whose type alias (``int4``, ``varchar``, ``bool``) it cannot map.

    Querying ``information_schema.columns`` is plain SQL that DuckDB
    supports natively and produces no warnings.
    """
    pending: dict[str, str] = {
        "privacy_consent": (
            "ALTER TABLE members ADD COLUMN privacy_consent BOOLEAN DEFAULT false"
        ),
        "medical_disclaimer_accepted": (
            "ALTER TABLE members ADD COLUMN medical_disclaimer_accepted BOOLEAN DEFAULT false"
        ),
        "marketing_consent": (
            "ALTER TABLE members ADD COLUMN marketing_consent BOOLEAN DEFAULT false"
        ),
        "consent_signed_at": (
            "ALTER TABLE members ADD COLUMN consent_signed_at TIMESTAMP"
        ),
        # Extended consent pack
        "consent_info_accuracy": (
            "ALTER TABLE members ADD COLUMN consent_info_accuracy BOOLEAN DEFAULT false"
        ),
        "consent_no_medical_advice": (
            "ALTER TABLE members ADD COLUMN consent_no_medical_advice BOOLEAN DEFAULT false"
        ),
        "consent_nutrition_disclaimer": (
            "ALTER TABLE members ADD COLUMN consent_nutrition_disclaimer BOOLEAN DEFAULT false"
        ),
        "consent_medical_clearance": (
            "ALTER TABLE members ADD COLUMN consent_medical_clearance BOOLEAN DEFAULT false"
        ),
        "consent_ai_recommendations": (
            "ALTER TABLE members ADD COLUMN consent_ai_recommendations BOOLEAN DEFAULT false"
        ),
        "consent_terms_accepted": (
            "ALTER TABLE members ADD COLUMN consent_terms_accepted BOOLEAN DEFAULT false"
        ),
    }

    # Use a read-only connection to inspect schema — avoids transaction conflicts.
    with engine.connect() as probe:
        tables = {
            row[0]
            for row in probe.execute(
                text("SELECT table_name FROM information_schema.tables "
                     "WHERE table_schema = 'main'")
            )
        }
        if "members" not in tables:
            return

        existing_columns = {
            row[0]
            for row in probe.execute(
                text("SELECT column_name FROM information_schema.columns "
                     "WHERE table_name = 'members' AND table_schema = 'main'")
            )
        }

    # Each ALTER TABLE runs in its own transaction — DuckDB cannot commit
    # multiple DDL changes on the same table within a single transaction.
    for column, statement in pending.items():
        if column not in existing_columns:
            logger.info("Adding missing column: members.%s", column)
            with engine.begin() as conn:
                conn.execute(text(statement))


Base.metadata.create_all(bind=engine)
_ensure_member_consent_columns()
logger.info("Database tables ready.")

# Phase 2 seed data (idempotent — skips if data already exists)
from app.database import SessionLocal as _SessionLocal
from app.seed_phase2 import seed_phase2 as _seed_phase2
try:
    with _SessionLocal() as _seed_db:
        _seed_phase2(_seed_db)
except Exception as _e:
    logger.warning("Phase 2 seed skipped: %s", _e)

# Auto-seed / reset admin credentials on startup when ALLOW_ADMIN_SEED=true.
# If the admin already exists, its password is updated to match the env var.
# If it does not exist, it is created.  This ensures credentials always
# match the environment without requiring a manual button click.
from app.config import admin_seed_enabled as _admin_seed_enabled
from app import auth as _auth
from app import models as _models

if _admin_seed_enabled():
    _admin_email    = os.getenv("DEFAULT_ADMIN_EMAIL",    "admin@pfi-platform.local")
    _admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")
    try:
        with _SessionLocal() as _db:
            _existing = _db.query(_models.Admin).filter(
                _models.Admin.email == _admin_email
            ).first()
            if _existing:
                setattr(_existing, "password", _auth.get_password_hash(_admin_password))
                _db.commit()
                logger.info("Admin password reset on startup: %s", _admin_email)
            else:
                _db.add(_models.Admin(
                    email=_admin_email,
                    password=_auth.get_password_hash(_admin_password),
                    name="Platform Admin",
                ))
                _db.commit()
                logger.info("Admin created on startup: %s", _admin_email)
    except Exception as _admin_e:
        logger.warning("Admin auto-seed failed: %s", _admin_e)


# ------------------------------------------------------------------ #
# CORS                                                                 #
# ------------------------------------------------------------------ #

_raw_origins = os.getenv("CORS_ORIGINS", "*")
if _raw_origins.strip() == "*":
    CORS_ORIGINS: list[str] | str = ["*"]
    if os.getenv("ENV", "development").lower() == "production":
        logger.warning(
            "CORS_ORIGINS is set to '*' in production — "
            "restrict this to your frontend origin(s)."
        )
else:
    CORS_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

logger.info("CORS allowed origins: %s", CORS_ORIGINS)


# ------------------------------------------------------------------ #
# FastAPI app                                                          #
# ------------------------------------------------------------------ #

app = FastAPI(
    title="Personalised Fitness Intelligence Platform API",
    description=(
        "Backend for the PFI Platform — fitness intelligence, "
        "member management, and personalised plan generation."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
logger.info("Rate limiter ready.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------ #
# Routers                                                              #
# ------------------------------------------------------------------ #

app.include_router(auth.router)
app.include_router(members.router)
app.include_router(assessments.router)
app.include_router(progress.router)
app.include_router(workout_plans.router)
app.include_router(nutrition_plans.router)
app.include_router(supplement_plans.router)
app.include_router(dashboard.router)
app.include_router(settings.router)

# Phase 2 — Workout Intelligence
app.include_router(workout_groups.router)
app.include_router(exercise_library.router)
app.include_router(plan_builder.router)
app.include_router(member_groups.router)
app.include_router(workout_sessions.router)
app.include_router(reassessment_alerts.router)
app.include_router(safety.router)

# Phase 3.1 — Check-Ins and Coaching Intelligence
app.include_router(check_ins.router)
app.include_router(weekly_check_ins.router)
app.include_router(readiness.router)
app.include_router(coach_tasks.router)
app.include_router(pain_flags.router)
app.include_router(nutrition_logs.router)
app.include_router(member_portal.router)


# ------------------------------------------------------------------ #
# Static SPA                                                           #
# ------------------------------------------------------------------ #

app.mount("/ui", StaticFiles(directory="app/static", html=True), name="ui")


# ------------------------------------------------------------------ #
# Health / root                                                        #
# ------------------------------------------------------------------ #


@app.get("/", tags=["health"])
def root() -> dict:
    """API root — returns basic metadata and links."""
    return {
        "service": "Personalised Fitness Intelligence Platform API",
        "short_name": "PFI Platform",
        "docs": "/docs",
        "redoc": "/redoc",
        "ui": "/ui",
    }
