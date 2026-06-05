"""create accuracy lab aggregates

Revision ID: 20260606_002
Revises: 20260605_001
Create Date: 2026-06-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260606_002"
down_revision = "20260605_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "forecast_accuracy_aggregates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("solar_plant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bucket_type", sa.String(length=16), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("avg_mape", sa.Float(), nullable=True),
        sa.Column("avg_rmse", sa.Float(), nullable=True),
        sa.Column("avg_mae", sa.Float(), nullable=True),
        sa.Column("avg_bias", sa.Float(), nullable=True),
        sa.Column("forecast_runs_count", sa.Integer(), nullable=False),
        sa.Column("samples_count", sa.Integer(), nullable=False),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["provider_id"], ["forecast_providers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["solar_plant_id"], ["solar_plants.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "solar_plant_id",
            "provider_id",
            "bucket_type",
            "period_start",
            name="uq_forecast_accuracy_aggregates_bucket",
        ),
    )
    op.create_index(
        "ix_accuracy_aggregates_plant_bucket_period",
        "forecast_accuracy_aggregates",
        ["solar_plant_id", "bucket_type", "period_start"],
    )
    op.create_index(
        "ix_accuracy_aggregates_provider_bucket_period",
        "forecast_accuracy_aggregates",
        ["provider_id", "bucket_type", "period_start"],
    )
    op.create_index(
        "ix_accuracy_aggregates_bucket_period",
        "forecast_accuracy_aggregates",
        ["bucket_type", "period_start", "period_end"],
    )


def downgrade() -> None:
    op.drop_index("ix_accuracy_aggregates_bucket_period", table_name="forecast_accuracy_aggregates")
    op.drop_index("ix_accuracy_aggregates_provider_bucket_period", table_name="forecast_accuracy_aggregates")
    op.drop_index("ix_accuracy_aggregates_plant_bucket_period", table_name="forecast_accuracy_aggregates")
    op.drop_table("forecast_accuracy_aggregates")
