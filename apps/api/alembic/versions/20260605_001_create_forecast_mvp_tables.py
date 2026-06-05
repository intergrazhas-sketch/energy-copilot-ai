"""create forecast mvp tables

Revision ID: 20260605_001
Revises:
Create Date: 2026-06-05
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260605_001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "solar_plants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("capacity_kw", sa.Float(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="Asia/Almaty"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "forecast_providers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("provider_type", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("code", name="uq_forecast_providers_code"),
    )

    op.create_table(
        "forecast_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("solar_plant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("horizon_hours", sa.Integer(), nullable=False),
        sa.Column("interval_minutes", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="created"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["provider_id"], ["forecast_providers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["solar_plant_id"], ["solar_plants.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "forecast_values",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("forecast_run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("solar_plant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("predicted_power_kw", sa.Float(), nullable=False),
        sa.Column("predicted_energy_kwh", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["forecast_run_id"], ["forecast_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["solar_plant_id"], ["solar_plants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", "timestamp", name="pk_forecast_values"),
        sa.UniqueConstraint("forecast_run_id", "timestamp", name="uq_forecast_values_run_timestamp"),
    )

    op.create_table(
        "actual_generation",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("solar_plant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actual_power_kw", sa.Float(), nullable=False),
        sa.Column("actual_energy_kwh", sa.Float(), nullable=True),
        sa.Column("source", sa.String(length=64), nullable=False, server_default="manual"),
        sa.Column("quality", sa.String(length=32), nullable=False, server_default="measured"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["solar_plant_id"], ["solar_plants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", "timestamp", name="pk_actual_generation"),
        sa.UniqueConstraint("solar_plant_id", "timestamp", name="uq_actual_generation_plant_timestamp"),
    )

    op.create_table(
        "forecast_accuracy",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("forecast_run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("solar_plant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("mape", sa.Float(), nullable=True),
        sa.Column("rmse", sa.Float(), nullable=False),
        sa.Column("mae", sa.Float(), nullable=False),
        sa.Column("bias", sa.Float(), nullable=False),
        sa.Column("samples_count", sa.Integer(), nullable=False),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["forecast_run_id"], ["forecast_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["solar_plant_id"], ["solar_plants.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("forecast_run_id", name="uq_forecast_accuracy_run"),
    )

    op.create_index("ix_forecast_runs_solar_plant_id", "forecast_runs", ["solar_plant_id"])
    op.create_index("ix_forecast_values_solar_plant_timestamp", "forecast_values", ["solar_plant_id", "timestamp"])
    op.create_index("ix_actual_generation_solar_plant_timestamp", "actual_generation", ["solar_plant_id", "timestamp"])

    op.execute(
        "SELECT create_hypertable('forecast_values', 'timestamp', if_not_exists => TRUE);"
    )
    op.execute(
        "SELECT create_hypertable('actual_generation', 'timestamp', if_not_exists => TRUE);"
    )


def downgrade() -> None:
    op.drop_table("forecast_accuracy")
    op.drop_table("actual_generation")
    op.drop_table("forecast_values")
    op.drop_table("forecast_runs")
    op.drop_table("forecast_providers")
    op.drop_table("solar_plants")
