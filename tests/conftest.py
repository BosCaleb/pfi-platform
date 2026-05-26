"""
Shared test fixtures for the CyberFit backend test suite.

Uses an in-memory DuckDB database so tests are isolated and fast —
no file system side effects, no leftover state between runs.

Install dev dependencies first:
    pip install -r requirements-dev.txt
"""

import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ------------------------------------------------------------------ #
# Force an in-memory database before any app module is imported.      #
# ------------------------------------------------------------------ #
os.environ.setdefault("DATABASE_URL", "duckdb:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-do-not-use-in-production")
os.environ.setdefault("ALLOW_ADMIN_SEED", "true")

from app.database import Base  # noqa: E402


# ------------------------------------------------------------------ #
# In-memory engine / session factory                                   #
# ------------------------------------------------------------------ #
TEST_DATABASE_URL = "duckdb:///:memory:"

_engine = create_engine(TEST_DATABASE_URL, connect_args={"read_only": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Create all ORM tables once for the whole test session."""
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)


@pytest.fixture()
def db_session():
    """Yield a transactional DB session that rolls back after each test."""
    connection = _engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client():
    """FastAPI test client using the in-memory database.

    Requires httpx: pip install httpx
    """
    # Lazy import so unit tests that don't need the HTTP client
    # can run without httpx installed.
    from fastapi.testclient import TestClient

    from app import database
    from app.main import app

    def override_get_db():
        connection = _engine.connect()
        session = TestingSessionLocal(bind=connection)
        try:
            yield session
        finally:
            session.close()
            connection.close()

    app.dependency_overrides[database.get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
