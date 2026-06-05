from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.forecast import validate_15_minute_timestamp


class ActualGenerationTelemetryPayload(BaseModel):
    timestamp: datetime
    actual_power_kw: float = Field(ge=0)
    actual_energy_kwh: float | None = Field(default=None, ge=0)
    source: str = "mqtt"
    quality: str = "measured"

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, value: datetime) -> datetime:
        return validate_15_minute_timestamp(value)
