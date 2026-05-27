"""
Database engine, session factory, and declarative base for CyberFit backend.

The DATABASE_URL is read from the environment. It defaults to a local DuckDB
file path suitable for development. In production, set DATABASE_URL via the
.env file or container environment.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    """Declarative base for all SQLAlchemy ORM models."""


SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "duckdb:///./data/pfi.db")

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"read_only": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency that yields a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
