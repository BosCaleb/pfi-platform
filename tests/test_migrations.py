"""
Database migration / schema validation tests.

These tests verify that ``Base.metadata.create_all()`` and
``_ensure_member_consent_columns()`` produce the expected schema.
They run against the same in-memory DuckDB engine as all other tests
(configured in conftest.py) so they are fast and have no side effects.

What is checked:
  - A representative set of core tables exist
  - Key columns added by the runtime migration helper are present
  - No column that would break the member portal is missing
"""

import pytest
from sqlalchemy import text


# ── Helpers ────────────────────────────────────────────────────────────────

def _tables(db_session) -> set[str]:
    """Return the set of table names visible in the in-memory schema."""
    rows = db_session.execute(
        text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'")
    ).fetchall()
    return {r[0] for r in rows}


def _columns(db_session, table: str) -> set[str]:
    """Return the set of column names for *table*."""
    rows = db_session.execute(
        text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = :t AND table_schema = 'main'"
        ),
        {"t": table},
    ).fetchall()
    return {r[0] for r in rows}


# ── Core tables ────────────────────────────────────────────────────────────

REQUIRED_TABLES = [
    # Phase 1
    "admins",
    "members",
    "assessments",
    "progress_entries",
    "workout_plans",
    "nutrition_plans",
    "supplement_plans",
    # Phase 2
    "workout_groups",
    "exercise_library",
    "workout_sessions",
    "reassessment_alerts",
    # Phase 3
    "member_check_ins",
    "weekly_member_check_ins",
    "readiness_scores",
    "coach_tasks",
    "pain_risk_flags",
    # Phase 4.1
    "membership_packages",
    "member_memberships",
    "invoices",
    "payments",
    "communication_messages",
    # Phase 4.2
    "member_milestones",
    "integration_settings",
    "member_data_requests",
    # Member portal columns live on members table (checked separately)
]


@pytest.mark.unit
class TestSchemaTablesExist:
    @pytest.mark.parametrize("table", REQUIRED_TABLES)
    def test_table_exists(self, db_session, table):
        assert table in _tables(db_session), f"Table '{table}' is missing from schema"


# ── Members table columns ──────────────────────────────────────────────────

REQUIRED_MEMBER_COLUMNS = [
    # Core fields
    "id", "first_name", "last_name", "email",
    "primary_goal", "fitness_level", "status",
    # Consent fields (added by _ensure_member_consent_columns)
    "privacy_consent",
    "medical_disclaimer_accepted",
    "marketing_consent",
    "consent_signed_at",
    "consent_info_accuracy",
    "consent_no_medical_advice",
    "consent_nutrition_disclaimer",
    "consent_medical_clearance",
    "consent_ai_recommendations",
    "consent_terms_accepted",
    # Member portal fields (added by _ensure_member_consent_columns)
    "portal_password",
    "portal_enabled",
    "portal_last_login",
]


@pytest.mark.unit
class TestMembersTableColumns:
    @pytest.mark.parametrize("column", REQUIRED_MEMBER_COLUMNS)
    def test_column_exists(self, db_session, column):
        cols = _columns(db_session, "members")
        assert column in cols, (
            f"Column 'members.{column}' is missing — "
            "check _ensure_member_consent_columns() in app/main.py"
        )


# ── Admins table ───────────────────────────────────────────────────────────

@pytest.mark.unit
class TestAdminsTable:
    def test_admins_has_email_column(self, db_session):
        assert "email" in _columns(db_session, "admins")

    def test_admins_has_password_column(self, db_session):
        assert "password" in _columns(db_session, "admins")


# ── Invoices / payments linkage ────────────────────────────────────────────

@pytest.mark.unit
class TestBillingSchema:
    def test_invoices_has_member_id(self, db_session):
        assert "member_id" in _columns(db_session, "invoices")

    def test_invoices_has_status(self, db_session):
        assert "invoice_status" in _columns(db_session, "invoices")

    def test_payments_has_member_id(self, db_session):
        assert "member_id" in _columns(db_session, "payments")

    def test_payments_has_invoice_id(self, db_session):
        assert "invoice_id" in _columns(db_session, "payments")


# ── Milestones visibility flag ─────────────────────────────────────────────

@pytest.mark.unit
class TestMilestonesSchema:
    def test_milestones_has_visible_to_member(self, db_session):
        assert "visible_to_member" in _columns(db_session, "member_milestones")


# ── Communications portal visibility ──────────────────────────────────────

@pytest.mark.unit
class TestCommunicationsSchema:
    def test_messages_has_portal_visibility_flag(self, db_session):
        cols = _columns(db_session, "communication_messages")
        assert "visible_in_member_portal" in cols
