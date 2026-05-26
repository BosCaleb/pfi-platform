import os


def admin_seed_enabled() -> bool:
    return os.getenv("ALLOW_ADMIN_SEED", "false").lower() in {"1", "true", "yes", "on"}
