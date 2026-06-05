import uuid
from datetime import datetime

from pydantic import BaseModel


class ProviderAccuracySummary(BaseModel):
    provider_id: uuid.UUID
    provider_code: str
    provider_name: str
    provider_type: str
    forecast_runs_count: int
    samples_count: int
    avg_mape: float | None
    avg_rmse: float | None
    avg_mae: float | None
    avg_bias: float | None


class ProviderComparisonResponse(BaseModel):
    solar_plant_id: uuid.UUID
    period_from: datetime | None
    period_to: datetime | None
    providers: list[ProviderAccuracySummary]


class BestProviderResponse(BaseModel):
    solar_plant_id: uuid.UUID
    period_from: datetime | None
    period_to: datetime | None
    metric_used: str | None
    provider: ProviderAccuracySummary | None
