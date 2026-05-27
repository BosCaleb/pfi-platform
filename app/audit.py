"""
POPIA-compliant audit logging for health and medical data access.

The Protection of Personal Information Act (POPIA) requires that access to
special personal information — including health data — is logged so that the
data controller can demonstrate accountability.

Each audit record is written as a single-line JSON entry to the
``cyberfit.audit`` logger.  In production, route this logger to a separate
file or a SIEM-compatible sink via the logging configuration.

Example log line::

    2024-01-15T10:32:05 | AUDIT    | cyberfit.audit |
    {"ts":"2024-01-15T10:32:05Z","action":"READ","actor":"admin@example.com",
     "resource":"member:42","data_types":["health_profile","physical_metrics"],
     "popia":true}
"""

import json
import logging
from datetime import datetime, timezone

audit_logger = logging.getLogger("cyberfit.audit")


def log_health_access(
    actor_email: str,
    member_id: int,
    data_types: list[str],
    action: str = "READ",
) -> None:
    """Write a POPIA audit record for access to special personal information.

    Args:
        actor_email: Email of the authenticated admin performing the action.
        member_id:   ID of the member whose data was accessed.
        data_types:  List of sensitive data categories accessed, e.g.
                     ``["health_profile", "physical_metrics"]``.
        action:      One of ``READ``, ``UPDATE``, ``DELETE``.  Defaults to ``READ``.
    """
    record = {
        "ts":         datetime.now(tz=timezone.utc).isoformat(),
        "action":     action,
        "actor":      actor_email,
        "resource":   f"member:{member_id}",
        "data_types": data_types,
        "popia":      True,
    }
    audit_logger.info(json.dumps(record))
