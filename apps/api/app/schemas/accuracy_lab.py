import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class AccuracyBucketType(StrEnum):
    day = "day"
    week = "week"
    month = "month"


class AccuracyLabRecalculateRequest(BaseModel):
    period_from: datetime
    period_to: datetime
    bucket_type: AccuracyBucketType = AccuracyBucketType.day
    solar_plant_id: uuid.UUID | None = None
    provider_id: uuid.UUID | None = None


class AccuracyAggregateRead(BaseModel):
    solar_plant_id: uuid.UUID
    provider_id: uuid.UUID
    provider_code: str | None = None
    provider_name: str | None = None
    bucket_type: AccuracyBucketType
    period_start: datetime
    period_end: datetime
    avg_mape: float | None
    avg_rmse: float | None
    avg_mae: float | None
    avg_bias: float | None
    forecast_runs_count: int
    samples_count: int
    calculated_at: datetime


class AccuracyLabRecalculateResponse(BaseModel):
    status: str
    bucket_type: AccuracyBucketType
    period_from: datetime
    period_to: datetime
    aggregates_count: int
    aggregates: list[AccuracyAggregateRead]


class AccuracyProviderRankingItem(BaseModel):
    provider_id: uuid.UUID
    provider_code: str
    provider_name: str
    avg_mape: float | None
    avg_rmse: float | None
    avg_mae: float | None
    avg_bias: float | None
    forecast_runs_count: int
    samples_count: int
    rank: int


class AccuracyProviderRankingResponse(BaseModel):
    bucket_type: AccuracyBucketType
    period_from: datetime
    period_to: datetime
    solar_plant_id: uuid.UUID | None = None
    providers: list[AccuracyProviderRankingItem]


class AccuracyLabSummaryResponse(BaseModel):
    bucket_type: AccuracyBucketType
    period_from: datetime
    period_to: datetime
    providers_count: int
    solar_plants_count: int
    aggregates_count: int
    forecast_runs_count: int
    samples_count: int
    avg_mape: float | None
    avg_rmse: float | None
    avg_mae: float | None
    avg_bias: float | None
