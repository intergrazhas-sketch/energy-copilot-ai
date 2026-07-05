"""Import dedup: forecast unique key + duplicate counters on audit tables.

Revision ID: 20260706_001
Revises: 20260627_002
Create Date: 2026-07-06

Adds:
- forecast_values.provider_id (denormalized from forecast_runs)
- UNIQUE (solar_plant_id, provider_id, timestamp) on forecast_values
- duplicate_rows_skipped on import_batches / import_files

Production note:
  Databases created via repair migration (20260627_001) may already have
  uq_actual_generation_plant_timestamp and other objects. PostgreSQL then
  raises DuplicateTable (not duplicate_object) when ADD CONSTRAINT runs again.
  Every DDL step below checks pg_catalog first so upgrade is safe to re-run.

WARNING — production:
  1. Take a DB backup first.
  2. Dedupe step removes duplicate forecast rows (keeps newest run per key).
  3. Do NOT run without explicit operator confirmation on production.
"""

from alembic import op

revision = "20260706_001"
down_revision = "20260627_002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. forecast_values.provider_id ───────────────────────────────────────
    op.execute(
        """
        ALTER TABLE forecast_values
        ADD COLUMN IF NOT EXISTS provider_id uuid
            REFERENCES forecast_providers(id) ON DELETE RESTRICT;
        """
    )

    op.execute(
        """
        UPDATE forecast_values fv
        SET provider_id = fr.provider_id
        FROM forecast_runs fr
        WHERE fr.id = fv.forecast_run_id
          AND fv.provider_id IS NULL;
        """
    )

    # ── 2. Remove duplicate forecast points (keep newest run) ─────────────────
    op.execute(
        """
        DELETE FROM forecast_values fv
        WHERE fv.id IN (
            SELECT id FROM (
                SELECT fv2.id,
                       ROW_NUMBER() OVER (
                           PARTITION BY fv2.solar_plant_id, fv2.provider_id, fv2.timestamp
                           ORDER BY fr.created_at DESC, fv2.created_at DESC
                       ) AS rn
                FROM forecast_values fv2
                JOIN forecast_runs fr ON fr.id = fv2.forecast_run_id
                WHERE fv2.provider_id IS NOT NULL
            ) ranked
            WHERE rn > 1
        );
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'forecast_values'
                  AND column_name = 'provider_id'
            ) AND NOT EXISTS (
                SELECT 1 FROM forecast_values WHERE provider_id IS NULL
            ) THEN
                ALTER TABLE forecast_values
                ALTER COLUMN provider_id SET NOT NULL;
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            -- Check pg_constraint AND pg_indexes: unique constraints create an
            -- index relation; re-adding raises DuplicateTable on production.
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uq_forecast_values_plant_provider_timestamp'
            ) AND NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE indexname = 'uq_forecast_values_plant_provider_timestamp'
            ) THEN
                ALTER TABLE forecast_values
                ADD CONSTRAINT uq_forecast_values_plant_provider_timestamp
                UNIQUE (solar_plant_id, provider_id, timestamp);
            END IF;
        END $$;
        """
    )

    # ── 3. actual_generation plant+timestamp unique (may already exist) ───────
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uq_actual_generation_plant_timestamp'
            ) AND NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE indexname = 'uq_actual_generation_plant_timestamp'
            ) THEN
                ALTER TABLE actual_generation
                ADD CONSTRAINT uq_actual_generation_plant_timestamp
                UNIQUE (solar_plant_id, timestamp);
            END IF;
        END $$;
        """
    )

    # ── 4. Batch audit duplicate counter ──────────────────────────────────────
    op.execute(
        """
        ALTER TABLE import_batches
        ADD COLUMN IF NOT EXISTS duplicate_rows_skipped integer NOT NULL DEFAULT 0;
        """
    )
    op.execute(
        """
        ALTER TABLE import_files
        ADD COLUMN IF NOT EXISTS duplicate_rows_skipped integer NOT NULL DEFAULT 0;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE import_files
        DROP COLUMN IF EXISTS duplicate_rows_skipped;
        """
    )
    op.execute(
        """
        ALTER TABLE import_batches
        DROP COLUMN IF EXISTS duplicate_rows_skipped;
        """
    )
    op.execute(
        """
        ALTER TABLE forecast_values
        DROP CONSTRAINT IF EXISTS uq_forecast_values_plant_provider_timestamp;
        """
    )
    op.execute(
        """
        ALTER TABLE forecast_values
        DROP COLUMN IF EXISTS provider_id;
        """
    )
