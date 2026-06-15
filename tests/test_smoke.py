"""
Smoke tests — verify the FastAPI application boots and responds correctly.

These tests spin up a real in-memory instance of the app (no mocks) via the
``client`` fixture in conftest.py and exercise the most critical paths:

  - /health          → must return 200 {"status": "ok"}
  - /                → must return 200 with service metadata
  - /docs            → Swagger UI must be reachable
  - /api/auth/login  → wrong credentials must return 401, not 500
  - /api/members     → protected; must reject unauthenticated requests

These tests are intentionally narrow.  They catch startup failures,
misconfigured routers, and broken auth middleware — not business logic.
Business logic is covered by test_auth.py and test_computed.py.
"""

import pytest


@pytest.mark.integration
class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        r = client.get("/health")
        assert r.status_code == 200

    def test_health_body_has_status_ok(self, client):
        data = client.get("/health").json()
        assert data["status"] == "ok"

    def test_health_body_has_database_field(self, client):
        data = client.get("/health").json()
        assert "database" in data

    def test_health_body_has_latency(self, client):
        data = client.get("/health").json()
        assert "latency_ms" in data
        assert isinstance(data["latency_ms"], (int, float))


@pytest.mark.integration
class TestRootEndpoint:
    def test_root_returns_200(self, client):
        r = client.get("/")
        assert r.status_code == 200

    def test_root_body_has_service(self, client):
        data = client.get("/").json()
        assert "service" in data
        assert "PFI" in data["service"]

    def test_root_body_has_health_link(self, client):
        data = client.get("/").json()
        assert data.get("health") == "/health"


@pytest.mark.integration
class TestOpenAPIDocs:
    def test_swagger_ui_reachable(self, client):
        r = client.get("/docs")
        assert r.status_code == 200

    def test_openapi_json_reachable(self, client):
        r = client.get("/openapi.json")
        assert r.status_code == 200

    def test_openapi_json_has_paths(self, client):
        data = client.get("/openapi.json").json()
        assert "paths" in data
        assert len(data["paths"]) > 10  # we have many routes


@pytest.mark.integration
class TestAdminAuth:
    def test_login_wrong_credentials_returns_401(self, client):
        r = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "wrongpassword"},
        )
        assert r.status_code in (401, 403)

    def test_login_missing_body_returns_422(self, client):
        r = client.post("/api/auth/login", json={})
        assert r.status_code == 422

    def test_login_with_seeded_admin(self, client):
        """The conftest seeds an admin on startup (ALLOW_ADMIN_SEED=true).
        Logging in with the seeded credentials should return a token."""
        import os

        email = os.environ.get("DEFAULT_ADMIN_EMAIL", "admin@pfi-platform.local")
        password = os.environ.get("DEFAULT_ADMIN_PASSWORD", "admin123")

        r = client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"


@pytest.mark.integration
class TestProtectedEndpoints:
    def test_members_list_requires_auth(self, client):
        r = client.get("/api/members")
        assert r.status_code == 401

    def test_dashboard_requires_auth(self, client):
        r = client.get("/api/dashboard/stats")
        assert r.status_code == 401

    def test_member_portal_requires_auth(self, client):
        r = client.get("/api/member/portal")
        assert r.status_code == 401

    def test_bearer_token_format_enforced(self, client):
        """A badly-formed token should be rejected, not crash."""
        r = client.get(
            "/api/members",
            headers={"Authorization": "Bearer this.is.not.a.valid.jwt"},
        )
        assert r.status_code == 401


@pytest.mark.integration
class TestMemberPortalAuth:
    def test_member_login_wrong_credentials_returns_401(self, client):
        r = client.post(
            "/api/member/login",
            json={"email": "ghost@example.com", "password": "badpassword"},
        )
        assert r.status_code in (401, 403)

    def test_member_register_unknown_email_returns_error(self, client):
        r = client.post(
            "/api/member/register",
            json={
                "email": "notindb@example.com",
                "password": "ValidPass1!",
                "confirm_password": "ValidPass1!",
            },
        )
        # 404 (email not found) or 403 (portal not enabled)
        assert r.status_code in (403, 404)
