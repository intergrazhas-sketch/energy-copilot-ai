"""add solar plant onboarding fields

Revision ID: 20260618_003
Revises: 20260606_002
Create Date: 2026-06-18
"""

from alembic import op
import sqlalchemy as sa

revision = "20260618_003"
down_revision = "20260606_002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("solar_plants", sa.Column("region", sa.String(length=120), nullable=True))
    op.add_column("solar_plants", sa.Column("country", sa.String(length=120), nullable=True))
    op.add_column("solar_plants", sa.Column("scada_system", sa.String(length=120), nullable=True))
    op.add_column("solar_plants", sa.Column("inverter_vendor", sa.String(length=120), nullable=True))
    op.add_column("solar_plants", sa.Column("inverter_count", sa.Integer(), nullable=True))
    op.add_column(
        "solar_plants",
        sa.Column("telemetry_interval_minutes", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("solar_plants", "telemetry_interval_minutes")
    op.drop_column("solar_plants", "inverter_count")
    op.drop_column("solar_plants", "inverter_vendor")
    op.drop_column("solar_plants", "scada_system")
    op.drop_column("solar_plants", "country")
    op.drop_column("solar_plants", "region")
