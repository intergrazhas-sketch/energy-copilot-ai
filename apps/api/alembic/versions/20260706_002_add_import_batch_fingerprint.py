"""Add upload_fingerprint to import_batches for audit deduplication.

Revision ID: 20260706_002
Revises: 20260706_001
Create Date: 2026-07-06

Idempotent: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
"""

from alembic import op

revision = "20260706_002"
down_revision = "20260706_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE import_batches
        ADD COLUMN IF NOT EXISTS upload_fingerprint varchar(64);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_import_batches_plant_fingerprint
        ON import_batches (plant_id, upload_fingerprint);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_import_batches_plant_fingerprint;")
    op.execute(
        """
        ALTER TABLE import_batches
        DROP COLUMN IF EXISTS upload_fingerprint;
        """
    )
