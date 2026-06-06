"""create rejected telemetry

Revision ID: 20260606_003
Revises: 20260606_002
Create Date: 2026-06-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260606_003"
down_revision = "20260606_002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rejected_telemetry",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("topic", sa.String(length=512), nullable=False),
        sa.Column("plant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reason", sa.String(length=64), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=False),
        sa.Column("raw_payload_text", sa.Text(), nullable=False),
        sa.Column("raw_payload_json", postgresql.JSONB(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_status", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
    )
    op.create_index("ix_rejected_telemetry_received_at", "rejected_telemetry", ["received_at"])
    op.create_index("ix_rejected_telemetry_reason_received_at", "rejected_telemetry", ["reason", "received_at"])
    op.create_index("ix_rejected_telemetry_plant_received_at", "rejected_telemetry", ["plant_id", "received_at"])
    op.create_index(
        "ix_rejected_telemetry_resolution_received_at",
        "rejected_telemetry",
        ["resolution_status", "received_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_rejected_telemetry_resolution_received_at", table_name="rejected_telemetry")
    op.drop_index("ix_rejected_telemetry_plant_received_at", table_name="rejected_telemetry")
    op.drop_index("ix_rejected_telemetry_reason_received_at", table_name="rejected_telemetry")
    op.drop_index("ix_rejected_telemetry_received_at", table_name="rejected_telemetry")
    op.drop_table("rejected_telemetry")
