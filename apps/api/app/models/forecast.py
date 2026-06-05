import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SolarPlant(Base):
    __tablename__ = "solar_plants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    capacity_kw: Mapped[float] = mapped_column(Float, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Almaty")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    forecast_runs: Mapped[list["ForecastRun"]] = relationship(back_populates="solar_plant")


class ForecastProvider(Base):
    __tablename__ = "forecast_providers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_type: Mapped[str] = mapped_column(String(32), nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    forecast_runs: Mapped[list["ForecastRun"]] = relationship(back_populates="provider")


class ForecastRun(Base):
    __tablename__ = "forecast_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    solar_plant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("solar_plants.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("forecast_providers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    horizon_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    interval_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="created")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    solar_plant: Mapped[SolarPlant] = relationship(back_populates="forecast_runs")
    provider: Mapped[ForecastProvider] = relationship(back_populates="forecast_runs")
    values: Mapped[list["ForecastValue"]] = relationship(back_populates="forecast_run")
    accuracy: Mapped["ForecastAccuracy | None"] = relationship(back_populates="forecast_run")


class ForecastValue(Base):
    __tablename__ = "forecast_values"
    __table_args__ = (
        UniqueConstraint("forecast_run_id", "timestamp", name="uq_forecast_values_run_timestamp"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    forecast_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("forecast_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    solar_plant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("solar_plants.id", ondelete="CASCADE"),
        nullable=False,
    )
    predicted_power_kw: Mapped[float] = mapped_column(Float, nullable=False)
    predicted_energy_kwh: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    forecast_run: Mapped[ForecastRun] = relationship(back_populates="values")


class ActualGeneration(Base):
    __tablename__ = "actual_generation"
    __table_args__ = (
        UniqueConstraint("solar_plant_id", "timestamp", name="uq_actual_generation_plant_timestamp"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    solar_plant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("solar_plants.id", ondelete="CASCADE"),
        nullable=False,
    )
    actual_power_kw: Mapped[float] = mapped_column(Float, nullable=False)
    actual_energy_kwh: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="manual")
    quality: Mapped[str] = mapped_column(String(32), nullable=False, default="measured")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ForecastAccuracy(Base):
    __tablename__ = "forecast_accuracy"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    forecast_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("forecast_runs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    solar_plant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("solar_plants.id", ondelete="CASCADE"),
        nullable=False,
    )
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    mape: Mapped[float | None] = mapped_column(Float)
    rmse: Mapped[float] = mapped_column(Float, nullable=False)
    mae: Mapped[float] = mapped_column(Float, nullable=False)
    bias: Mapped[float] = mapped_column(Float, nullable=False)
    samples_count: Mapped[int] = mapped_column(Integer, nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    forecast_run: Mapped[ForecastRun] = relationship(back_populates="accuracy")
