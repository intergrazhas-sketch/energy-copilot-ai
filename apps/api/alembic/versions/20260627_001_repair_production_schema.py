"""repair production database schema (idempotent merge of heads)

Revision ID: 20260627_001
Revises: 20260606_003, 20260618_003
Create Date: 2026-06-27

This migration merges the two open heads (rejected_telemetry and the solar
plant onboarding fields) into a single head AND repairs production databases
whose schema drifted (e.g. only `solar_plants` exists while `alembic_version`
is empty, so a normal `upgrade` would replay `CREATE TABLE solar_plants` and
fail with "already exists").

Everything here is idempotent: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT
EXISTS / CREATE INDEX IF NOT EXISTS. It never drops data and preserves all
existing rows. Running it twice is safe. Downgrade is intentionally a no-op so
an accidental downgrade can never drop production tables.
"""

from alembic import op

revision = "20260627_001"
down_revision = ("20260606_003", "20260618_003")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- solar_plants (incl. onboarding columns) -------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS solar_plants (
            id uuid PRIMARY KEY,
            name varchar(255) NOT NULL,
            capacity_kw double precision NOT NULL,
            latitude double precision,
            longitude double precision,
            timezone varchar(64) NOT NULL DEFAULT 'Asia/Almaty',
            status varchar(32) NOT NULL DEFAULT 'active',
            region varchar(120),
            country varchar(120),
            scada_system varchar(120),
            inverter_vendor varchar(120),
            inverter_count integer,
            telemetry_interval_minutes integer,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        """
    )
    # Repair onboarding columns when solar_plants already existed.
    op.execute("ALTER TABLE solar_plants ADD COLUMN IF NOT EXISTS region varchar(120);")
    op.execute("ALTER TABLE solar_plants ADD COLUMN IF NOT EXISTS country varchar(120);")
    op.execute("ALTER TABLE solar_plants ADD COLUMN IF NOT EXISTS scada_system varchar(120);")
    op.execute("ALTER TABLE solar_plants ADD COLUMN IF NOT EXISTS inverter_vendor varchar(120);")
    op.execute("ALTER TABLE solar_plants ADD COLUMN IF NOT EXISTS inverter_count integer;")
    op.execute(
        "ALTER TABLE solar_plants ADD COLUMN IF NOT EXISTS telemetry_interval_minutes integer;"
    )
    # Repair the created_at default/NULLs that caused 500s on /solar-plants.
    op.execute("ALTER TABLE solar_plants ADD COLUMN IF NOT EXISTS created_at timestamptz;")
    op.execute("ALTER TABLE solar_plants ALTER COLUMN created_at SET DEFAULT now();")
    op.execute("UPDATE solar_plants SET created_at = now() WHERE created_at IS NULL;")
    op.execute("ALTER TABLE solar_plants ALTER COLUMN created_at SET NOT NULL;")

    # --- forecast_providers ---------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS forecast_providers (
            id uuid PRIMARY KEY,
            code varchar(64) NOT NULL,
            name varchar(255) NOT NULL,
            provider_type varchar(32) NOT NULL,
            is_active boolean NOT NULL DEFAULT true,
            config jsonb NOT NULL DEFAULT '{}'::jsonb,
            created_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_forecast_providers_code UNIQUE (code)
        );
        """
    )

    # --- forecast_runs ---------------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS forecast_runs (
            id uuid PRIMARY KEY,
            solar_plant_id uuid NOT NULL REFERENCES solar_plants(id) ON DELETE CASCADE,
            provider_id uuid NOT NULL REFERENCES forecast_providers(id) ON DELETE RESTRICT,
            run_at timestamptz NOT NULL,
            horizon_hours integer NOT NULL,
            interval_minutes integer NOT NULL DEFAULT 15,
            status varchar(32) NOT NULL DEFAULT 'created',
            created_at timestamptz NOT NULL DEFAULT now()
        );
        """
    )

    # --- forecast_values (hypertable) -----------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS forecast_values (
            id uuid NOT NULL,
            timestamp timestamptz NOT NULL,
            forecast_run_id uuid NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
            solar_plant_id uuid NOT NULL REFERENCES solar_plants(id) ON DELETE CASCADE,
            predicted_power_kw double precision NOT NULL,
            predicted_energy_kwh double precision,
            created_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT pk_forecast_values PRIMARY KEY (id, timestamp),
            CONSTRAINT uq_forecast_values_run_timestamp UNIQUE (forecast_run_id, timestamp)
        );
        """
    )

    # --- actual_generation (hypertable) ---------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS actual_generation (
            id uuid NOT NULL,
            timestamp timestamptz NOT NULL,
            solar_plant_id uuid NOT NULL REFERENCES solar_plants(id) ON DELETE CASCADE,
            actual_power_kw double precision NOT NULL,
            actual_energy_kwh double precision,
            source varchar(64) NOT NULL DEFAULT 'manual',
            quality varchar(32) NOT NULL DEFAULT 'measured',
            created_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT pk_actual_generation PRIMARY KEY (id, timestamp),
            CONSTRAINT uq_actual_generation_plant_timestamp UNIQUE (solar_plant_id, timestamp)
        );
        """
    )

    # --- forecast_accuracy ----------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS forecast_accuracy (
            id uuid PRIMARY KEY,
            forecast_run_id uuid NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
            solar_plant_id uuid NOT NULL REFERENCES solar_plants(id) ON DELETE CASCADE,
            period_start timestamptz NOT NULL,
            period_end timestamptz NOT NULL,
            mape double precision,
            rmse double precision NOT NULL,
            mae double precision NOT NULL,
            bias double precision NOT NULL,
            samples_count integer NOT NULL,
            calculated_at timestamptz NOT NULL DEFAULT now(),
            notes text,
            CONSTRAINT uq_forecast_accuracy_run UNIQUE (forecast_run_id)
        );
        """
    )

    # --- forecast_accuracy_aggregates -----------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS forecast_accuracy_aggregates (
            id uuid PRIMARY KEY,
            solar_plant_id uuid NOT NULL REFERENCES solar_plants(id) ON DELETE CASCADE,
            provider_id uuid NOT NULL REFERENCES forecast_providers(id) ON DELETE CASCADE,
            bucket_type varchar(16) NOT NULL,
            period_start timestamptz NOT NULL,
            period_end timestamptz NOT NULL,
            avg_mape double precision,
            avg_rmse double precision,
            avg_mae double precision,
            avg_bias double precision,
            forecast_runs_count integer NOT NULL,
            samples_count integer NOT NULL,
            calculated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_forecast_accuracy_aggregates_bucket
                UNIQUE (solar_plant_id, provider_id, bucket_type, period_start)
        );
        """
    )

    # --- rejected_telemetry ---------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS rejected_telemetry (
            id uuid PRIMARY KEY,
            source varchar(32) NOT NULL,
            topic varchar(512) NOT NULL,
            plant_id uuid,
            reason varchar(64) NOT NULL,
            error_message text NOT NULL,
            raw_payload_text text NOT NULL,
            raw_payload_json jsonb,
            received_at timestamptz NOT NULL DEFAULT now(),
            resolved_at timestamptz,
            resolution_status varchar(32) NOT NULL DEFAULT 'open',
            metadata jsonb
        );
        """
    )

    # --- indexes ---------------------------------------------------------
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_forecast_runs_solar_plant_id "
        "ON forecast_runs (solar_plant_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_forecast_values_solar_plant_timestamp "
        "ON forecast_values (solar_plant_id, timestamp);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_actual_generation_solar_plant_timestamp "
        "ON actual_generation (solar_plant_id, timestamp);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_accuracy_aggregates_plant_bucket_period "
        "ON forecast_accuracy_aggregates (solar_plant_id, bucket_type, period_start);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_accuracy_aggregates_provider_bucket_period "
        "ON forecast_accuracy_aggregates (provider_id, bucket_type, period_start);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_accuracy_aggregates_bucket_period "
        "ON forecast_accuracy_aggregates (bucket_type, period_start, period_end);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rejected_telemetry_received_at "
        "ON rejected_telemetry (received_at);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rejected_telemetry_reason_received_at "
        "ON rejected_telemetry (reason, received_at);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rejected_telemetry_plant_received_at "
        "ON rejected_telemetry (plant_id, received_at);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rejected_telemetry_resolution_received_at "
        "ON rejected_telemetry (resolution_status, received_at);"
    )

    # --- TimescaleDB hypertables (only if the extension is installed) ----
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
                PERFORM create_hypertable(
                    'forecast_values', 'timestamp',
                    if_not_exists => TRUE, migrate_data => TRUE
                );
                PERFORM create_hypertable(
                    'actual_generation', 'timestamp',
                    if_not_exists => TRUE, migrate_data => TRUE
                );
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    # No-op: this is a merge/repair revision. We never drop production tables
    # on downgrade. The original per-table migrations own their own downgrades.
    pass
