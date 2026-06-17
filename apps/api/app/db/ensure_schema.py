"""Idempotent startup schema guard.

Ensures the Solar Plant onboarding columns exist regardless of the alembic
revision currently stamped in the database. This runs on container start and
never aborts startup: if anything fails it logs and exits 0 so the API still
serves /health and existing endpoints.
"""

import sys

from sqlalchemy import create_engine, text

from app.core.config import get_settings

# (column_name, column_type) — added only if missing.
SOLAR_PLANT_COLUMNS: list[tuple[str, str]] = [
    ("region", "VARCHAR(120)"),
    ("country", "VARCHAR(120)"),
    ("scada_system", "VARCHAR(120)"),
    ("inverter_vendor", "VARCHAR(120)"),
    ("inverter_count", "INTEGER"),
    ("telemetry_interval_minutes", "INTEGER"),
]


def main() -> int:
    settings = get_settings()
    sync_url = settings.database_url.replace("+asyncpg", "")
    try:
        engine = create_engine(sync_url, pool_pre_ping=True)
        with engine.begin() as conn:
            for name, column_type in SOLAR_PLANT_COLUMNS:
                conn.execute(
                    text(
                        f"ALTER TABLE solar_plants "
                        f"ADD COLUMN IF NOT EXISTS {name} {column_type}"
                    )
                )
        engine.dispose()
        print("[ensure_schema] solar_plants onboarding columns ensured.")
    except Exception as exc:  # noqa: BLE001 - never block startup
        print(f"[ensure_schema] WARNING: could not ensure schema: {exc}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
