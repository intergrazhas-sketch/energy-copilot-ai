"""create import audit tables (batch import logging)

Revision ID: 20260627_002
Revises: 20260627_001
Create Date: 2026-06-27

Adds lightweight import audit tables (import_batches, import_files,
import_errors) so batch uploads are logged and never disappear silently.

Idempotent: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS. Never
drops data. Safe to run twice.
"""

from alembic import op

revision = "20260627_002"
down_revision = "20260627_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS import_batches (
            id uuid PRIMARY KEY,
            plant_id uuid NOT NULL REFERENCES solar_plants(id) ON DELETE CASCADE,
            started_at timestamptz,
            finished_at timestamptz,
            status varchar(32) NOT NULL DEFAULT 'pending',
            source varchar(64) NOT NULL DEFAULT 'ui_batch_upload',
            import_mode varchar(32) NOT NULL DEFAULT 'actual_and_forecast',
            original_filename varchar(512),
            total_files integer NOT NULL DEFAULT 0,
            processed_files integer NOT NULL DEFAULT 0,
            skipped_files integer NOT NULL DEFAULT 0,
            failed_files integer NOT NULL DEFAULT 0,
            actual_rows_imported integer NOT NULL DEFAULT 0,
            forecast_rows_imported integer NOT NULL DEFAULT 0,
            rejected_rows integer NOT NULL DEFAULT 0,
            data_start_at timestamptz,
            data_end_at timestamptz,
            message text,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS import_files (
            id uuid PRIMARY KEY,
            batch_id uuid NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
            filename varchar(512) NOT NULL,
            file_type varchar(32) NOT NULL DEFAULT 'unknown',
            status varchar(32) NOT NULL DEFAULT 'pending',
            actual_rows_imported integer NOT NULL DEFAULT 0,
            forecast_rows_imported integer NOT NULL DEFAULT 0,
            rejected_rows integer NOT NULL DEFAULT 0,
            data_start_at timestamptz,
            data_end_at timestamptz,
            error_message text,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS import_errors (
            id uuid PRIMARY KEY,
            batch_id uuid NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
            filename varchar(512),
            row_number integer,
            error_type varchar(64) NOT NULL DEFAULT 'error',
            error_message text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_import_batches_plant_created "
        "ON import_batches (plant_id, created_at);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_import_files_batch "
        "ON import_files (batch_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_import_errors_batch "
        "ON import_errors (batch_id);"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS import_errors;")
    op.execute("DROP TABLE IF EXISTS import_files;")
    op.execute("DROP TABLE IF EXISTS import_batches;")
