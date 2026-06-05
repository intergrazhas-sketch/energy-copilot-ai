import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.forecast import ForecastAccuracyAggregate, ForecastProvider
from app.repositories import accuracy_lab as repository
from app.schemas.accuracy_lab import (
    AccuracyAggregateRead,
    AccuracyBucketType,
    AccuracyLabRecalculateRequest,
    AccuracyLabRecalculateResponse,
    AccuracyLabSummaryResponse,
    AccuracyProviderRankingItem,
    AccuracyProviderRankingResponse,
)


def _ensure_day_bucket(bucket_type: AccuracyBucketType) -> None:
    if bucket_type != AccuracyBucketType.day:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Accuracy Lab MVP currently supports only day aggregation",
        )


def _aggregate_to_schema(
    aggregate: ForecastAccuracyAggregate,
    provider: ForecastProvider | None = None,
) -> AccuracyAggregateRead:
    return AccuracyAggregateRead(
        solar_plant_id=aggregate.solar_plant_id,
        provider_id=aggregate.provider_id,
        provider_code=provider.code if provider else None,
        provider_name=provider.name if provider else None,
        bucket_type=AccuracyBucketType(aggregate.bucket_type),
        period_start=aggregate.period_start,
        period_end=aggregate.period_end,
        avg_mape=aggregate.avg_mape,
        avg_rmse=aggregate.avg_rmse,
        avg_mae=aggregate.avg_mae,
        avg_bias=aggregate.avg_bias,
        forecast_runs_count=aggregate.forecast_runs_count,
        samples_count=aggregate.samples_count,
        calculated_at=aggregate.calculated_at,
    )


def _ranking_sort_key(item: AccuracyProviderRankingItem) -> tuple[bool, float, float, float]:
    return (
        item.avg_mape is None,
        item.avg_mape if item.avg_mape is not None else float("inf"),
        item.avg_mae if item.avg_mae is not None else float("inf"),
        item.avg_rmse if item.avg_rmse is not None else float("inf"),
    )


def _rank_rows(rows) -> list[AccuracyProviderRankingItem]:
    items = [
        AccuracyProviderRankingItem(
            provider_id=row.provider_id,
            provider_code=row.provider_code,
            provider_name=row.provider_name,
            avg_mape=row.avg_mape,
            avg_rmse=row.avg_rmse,
            avg_mae=row.avg_mae,
            avg_bias=row.avg_bias,
            forecast_runs_count=row.forecast_runs_count,
            samples_count=row.samples_count,
            rank=0,
        )
        for row in rows
    ]
    sorted_items = sorted(items, key=_ranking_sort_key)

    for index, item in enumerate(sorted_items, start=1):
        item.rank = index

    return sorted_items


async def recalculate_accuracy_lab(
    session: AsyncSession,
    payload: AccuracyLabRecalculateRequest,
) -> AccuracyLabRecalculateResponse:
    _ensure_day_bucket(payload.bucket_type)
    if payload.period_from > payload.period_to:
        raise HTTPException(status_code=400, detail="period_from must be before period_to")

    aggregates = await repository.recalculate_day_aggregates(
        session,
        period_from=payload.period_from,
        period_to=payload.period_to,
        solar_plant_id=payload.solar_plant_id,
        provider_id=payload.provider_id,
    )

    return AccuracyLabRecalculateResponse(
        status="ok",
        bucket_type=payload.bucket_type,
        period_from=payload.period_from,
        period_to=payload.period_to,
        aggregates_count=len(aggregates),
        aggregates=[_aggregate_to_schema(aggregate) for aggregate in aggregates],
    )


async def get_provider_ranking(
    session: AsyncSession,
    *,
    bucket_type: AccuracyBucketType,
    period_from: datetime,
    period_to: datetime,
    solar_plant_id: uuid.UUID | None = None,
) -> AccuracyProviderRankingResponse:
    _ensure_day_bucket(bucket_type)
    rows = await repository.get_provider_ranking(
        session,
        bucket_type=bucket_type.value,
        period_from=period_from,
        period_to=period_to,
        solar_plant_id=solar_plant_id,
    )

    return AccuracyProviderRankingResponse(
        bucket_type=bucket_type,
        period_from=period_from,
        period_to=period_to,
        solar_plant_id=solar_plant_id,
        providers=_rank_rows(rows),
    )


async def get_accuracy_lab_summary(
    session: AsyncSession,
    *,
    bucket_type: AccuracyBucketType,
    period_from: datetime,
    period_to: datetime,
) -> AccuracyLabSummaryResponse:
    _ensure_day_bucket(bucket_type)
    row = await repository.get_summary(
        session,
        bucket_type=bucket_type.value,
        period_from=period_from,
        period_to=period_to,
    )

    return AccuracyLabSummaryResponse(
        bucket_type=bucket_type,
        period_from=period_from,
        period_to=period_to,
        providers_count=row.providers_count,
        solar_plants_count=row.solar_plants_count,
        aggregates_count=row.aggregates_count,
        forecast_runs_count=row.forecast_runs_count,
        samples_count=row.samples_count,
        avg_mape=row.avg_mape,
        avg_rmse=row.avg_rmse,
        avg_mae=row.avg_mae,
        avg_bias=row.avg_bias,
    )
