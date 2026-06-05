import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def validate_15_minute_timestamp(value: datetime) -> datetime:
    if value.minute % 15 != 0 or value.second != 0 or value.microsecond != 0:
        raise ValueError("timestamp must be aligned to a 15-minute interval")
    return value


class SolarPlantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    capacity_kw: float = Field(gt=0)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    timezone: str = "Asia/Almaty"
    status: str = "active"


class SolarPlantRead(SolarPlantCreate):
    id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ForecastProviderCreate(BaseModel):
    code: Literal["manual", "mock"]
    name: str = Field(min_length=1, max_length=255)
    provider_type: Literal["manual", "mock"]
    is_active: bool = True
    config: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_provider_type_matches_code(self) -> "ForecastProviderCreate":
        if self.provider_type != self.code:
            raise ValueError("provider_type must match code for Forecast MVP")
        return self


class ForecastProviderRead(ForecastProviderCreate):
    id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ForecastRunCreate(BaseModel):
    solar_plant_id: uuid.UUID
    provider_id: uuid.UUID
    run_at: datetime
    horizon_hours: int = Field(gt=0, le=168)
    interval_minutes: int = 15
    status: str = "created"

    @field_validator("interval_minutes")
    @classmethod
    def validate_interval_minutes(cls, value: int) -> int:
        if value != 15:
            raise ValueError("Forecast MVP supports only 15-minute intervals")
        return value


class ForecastRunRead(ForecastRunCreate):
    id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ForecastValueItem(BaseModel):
    timestamp: datetime
    predicted_power_kw: float = Field(ge=0)
    predicted_energy_kwh: float | None = Field(default=None, ge=0)

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, value: datetime) -> datetime:
        return validate_15_minute_timestamp(value)


class ForecastValuesCreate(BaseModel):
    values: list[ForecastValueItem] = Field(min_length=1)


class ForecastValueRead(ForecastValueItem):
    id: uuid.UUID
    forecast_run_id: uuid.UUID
    solar_plant_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActualGenerationItem(BaseModel):
    timestamp: datetime
    actual_power_kw: float = Field(ge=0)
    actual_energy_kwh: float | None = Field(default=None, ge=0)
    source: str = "manual"
    quality: str = "measured"

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, value: datetime) -> datetime:
        return validate_15_minute_timestamp(value)


class ActualGenerationCreate(BaseModel):
    solar_plant_id: uuid.UUID
    values: list[ActualGenerationItem] = Field(min_length=1)


class ActualGenerationRead(ActualGenerationItem):
    id: uuid.UUID
    solar_plant_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ForecastAccuracyRead(BaseModel):
    id: uuid.UUID
    forecast_run_id: uuid.UUID
    solar_plant_id: uuid.UUID
    period_start: datetime
    period_end: datetime
    mape: float | None
    rmse: float
    mae: float
    bias: float
    samples_count: int
    calculated_at: datetime
    notes: str | None = None

    model_config = ConfigDict(from_attributes=True)
