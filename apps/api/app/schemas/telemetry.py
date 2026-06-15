import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ActualGenerationTelemetryPayload(BaseModel):
    timestamp: datetime
    actual_power_kw: float
    actual_energy_kwh: float | None = None
    source: str = "mqtt"
    quality: str = "measured"


class TelemetryDataFreshnessStatus(StrEnum):
    fresh = "fresh"
    stale = "stale"
    offline = "offline"
    no_data = "no_data"


class TelemetryPointRead(BaseModel):
    id: uuid.UUID
    asset_id: uuid.UUID
    timestamp: datetime
    actual_power_kw: float
    actual_energy_kwh: float | None
    source: str
    quality: str
    created_at: datetime


class TelemetrySummaryRead(BaseModel):
    asset_id: uuid.UUID
    period_from: datetime
    period_to: datetime
    current_power_kw: float | None
    energy_today_kwh: float | None
    avg_power_kw: float | None
    max_power_kw: float | None
    telemetry_points_count: int
    last_telemetry_time: datetime | None
    data_freshness_status: TelemetryDataFreshnessStatus
    estimated_revenue_today: float | None
    possible_data_gap_minutes: int | None


class TelemetryCsvImportError(BaseModel):
    row_number: int | None
    message: str


class TelemetryCsvImportSummary(BaseModel):
    imported_rows: int
    rejected_rows: int
    errors: list[TelemetryCsvImportError]


class RejectedTelemetryReason(StrEnum):
    invalid_topic = "invalid_topic"
    invalid_plant_id = "invalid_plant_id"
    plant_not_found = "plant_not_found"
    invalid_json = "invalid_json"
    invalid_timestamp = "invalid_timestamp"
    future_timestamp = "future_timestamp"
    stale_timestamp = "stale_timestamp"
    negative_power = "negative_power"
    negative_energy = "negative_energy"
    power_exceeds_capacity = "power_exceeds_capacity"
    db_error = "db_error"
    unknown_error = "unknown_error"


class RejectedTelemetryResolutionStatus(StrEnum):
    open = "open"
    ignored = "ignored"
    fixed = "fixed"


class RejectedTelemetryRead(BaseModel):
    id: uuid.UUID
    source: str
    topic: str
    plant_id: uuid.UUID | None
    reason: RejectedTelemetryReason
    error_message: str
    raw_payload_text: str
    raw_payload_json: dict[str, Any] | list[Any] | None
    received_at: datetime
    resolved_at: datetime | None
    resolution_status: RejectedTelemetryResolutionStatus
    metadata: dict[str, Any] | None = Field(default=None, validation_alias="metadata_json")

    model_config = ConfigDict(from_attributes=True)


class RejectedTelemetryResolutionUpdate(BaseModel):
    resolution_status: RejectedTelemetryResolutionStatus


class RejectedTelemetrySummaryItem(BaseModel):
    reason: RejectedTelemetryReason
    count: int


class RejectedTelemetrySummary(BaseModel):
    total: int
    items: list[RejectedTelemetrySummaryItem]
