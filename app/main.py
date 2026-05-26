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
from sqlalchemy import inspect, text

from app.database import Base, engine
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

    This migration guard is required because DuckDB does not support
    ALTER TABLE … ADD COLUMN IF NOT EXISTS in older versions.
    """
    inspector = inspect(engine)
    if "members" not in inspector.get_table_names():
        return

    existing_columns = {col["name"] for col in inspector.get_columns("members")}
    pending: dict[str, str] = {
        "privacy_consent": "ALTER TABLE members ADD COLUMN privacy_consent BOOLEAN DEFAULT false",
        "medical_disclaimer_accepted": "ALTER TABLE members ADD COLUMN medical_disclaimer_accepted BOOLEAN DEFAULT false",
        "marketing_consent": "ALTER TABLE members ADD COLUMN marketing_consent BOOLEAN DEFAULT false",
        "consent_signed_at": "ALTER TABLE members ADD COLUMN consent_signed_at TIMESTAMP",
    }

    with engine.begin() as conn:
        for column, statement in pending.items():
            if column not in existing_columns:
                logger.info("Adding missing column: members.%s", column)
                conn.execute(text(statement))


Base.metadata.create_all(bind=engine)
_ensure_member_consent_columns()
logger.info("Database tables ready.")


# ------------------------------------------------------------------ #
# CORS                                                                 #
# ------------------------------------------------------------------ #

_raw_origins = os.getenv("CORS_ORIGINS", "*")
if _raw_origins.strip() == "*":
    CORS_ORIGINS: list[str] | str = ["*"]
    if os.getenv("ENV", "development").lower() == "production":
        logger.warning(
            "CORS_ORIGINS is set to '*' in production — restrict this to your frontend origin(s)."
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
