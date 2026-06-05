import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.forecast import ForecastAccuracy, ForecastAccuracyAggregate, ForecastProvider, ForecastRun


async def recalculate_day_aggregates(
    session: AsyncSession,
    *,
    period_from: datetime,
    period_to: datetime,
    solar_plant_id: uuid.UUID | None = None,
    provider_id: uuid.UUID | None = None,
) -> list[ForecastAccuracyAggregate]:
    day_bucket = func.date_trunc("day", ForecastAccuracy.period_start).label("period_start")
    statement = (
        select(
            ForecastAccuracy.solar_plant_id.label("solar_plant_id"),
            ForecastRun.provider_id.label("provider_id"),
            day_bucket,
            func.avg(ForecastAccuracy.mape).label("avg_mape"),
            func.avg(ForecastAccuracy.rmse).label("avg_rmse"),
            func.avg(ForecastAccuracy.mae).label("avg_mae"),
            func.avg(ForecastAccuracy.bias).label("avg_bias"),
            func.count(ForecastAccuracy.id).label("forecast_runs_count"),
            func.coalesce(func.sum(ForecastAccuracy.samples_count), 0).label("samples_count"),
        )
        .join(ForecastRun, ForecastRun.id == ForecastAccuracy.forecast_run_id)
        .where(ForecastAccuracy.period_start >= period_from)
        .where(ForecastAccuracy.period_end <= period_to)
    )

    if solar_plant_id is not None:
        statement = statement.where(ForecastAccuracy.solar_plant_id == solar_plant_id)
    if provider_id is not None:
        statement = statement.where(ForecastRun.provider_id == provider_id)

    statement = statement.group_by(
        ForecastAccuracy.solar_plant_id,
        ForecastRun.provider_id,
        day_bucket,
    )
    result = await session.execute(statement)
    rows = result.all()

    aggregate_ids: list[uuid.UUID] = []
    for row in rows:
        aggregate_id = uuid.uuid4()
        period_start = row.period_start
        period_end = period_start.replace(hour=23, minute=59, second=59, microsecond=999999)
        upsert_statement = (
            insert(ForecastAccuracyAggregate)
            .values(
                id=aggregate_id,
                solar_plant_id=row.solar_plant_id,
                provider_id=row.provider_id,
                bucket_type="day",
                period_start=period_start,
                period_end=period_end,
                avg_mape=row.avg_mape,
                avg_rmse=row.avg_rmse,
                avg_mae=row.avg_mae,
                avg_bias=row.avg_bias,
                forecast_runs_count=row.forecast_runs_count,
                samples_count=row.samples_count,
            )
            .on_conflict_do_update(
                constraint="uq_forecast_accuracy_aggregates_bucket",
                set_={
                    "period_end": period_end,
                    "avg_mape": row.avg_mape,
                    "avg_rmse": row.avg_rmse,
                    "avg_mae": row.avg_mae,
                    "avg_bias": row.avg_bias,
                    "forecast_runs_count": row.forecast_runs_count,
                    "samples_count": row.samples_count,
                    "calculated_at": func.now(),
                },
            )
            .returning(ForecastAccuracyAggregate.id)
        )
        inserted = await session.execute(upsert_statement)
        aggregate_ids.append(inserted.scalar_one())

    await session.commit()

    if not aggregate_ids:
        return []

    aggregates_result = await session.execute(
        select(ForecastAccuracyAggregate)
        .where(ForecastAccuracyAggregate.id.in_(aggregate_ids))
        .order_by(ForecastAccuracyAggregate.period_start, ForecastAccuracyAggregate.provider_id)
    )
    return list(aggregates_result.scalars().all())


async def list_aggregates(
    session: AsyncSession,
    *,
    bucket_type: str,
    period_from: datetime,
    period_to: datetime,
    solar_plant_id: uuid.UUID | None = None,
) -> list[tuple[ForecastAccuracyAggregate, ForecastProvider]]:
    statement = (
        select(ForecastAccuracyAggregate, ForecastProvider)
        .join(ForecastProvider, ForecastProvider.id == ForecastAccuracyAggregate.provider_id)
        .where(ForecastAccuracyAggregate.bucket_type == bucket_type)
        .where(ForecastAccuracyAggregate.period_start >= period_from)
        .where(ForecastAccuracyAggregate.period_start <= period_to)
    )

    if solar_plant_id is not None:
        statement = statement.where(ForecastAccuracyAggregate.solar_plant_id == solar_plant_id)

    result = await session.execute(
        statement.order_by(ForecastAccuracyAggregate.period_start, ForecastProvider.code)
    )
    return list(result.all())


async def get_provider_ranking(
    session: AsyncSession,
    *,
    bucket_type: str,
    period_from: datetime,
    period_to: datetime,
    solar_plant_id: uuid.UUID | None = None,
):
    statement = (
        select(
            ForecastProvider.id.label("provider_id"),
            ForecastProvider.code.label("provider_code"),
            ForecastProvider.name.label("provider_name"),
            func.avg(ForecastAccuracyAggregate.avg_mape).label("avg_mape"),
            func.avg(ForecastAccuracyAggregate.avg_rmse).label("avg_rmse"),
            func.avg(ForecastAccuracyAggregate.avg_mae).label("avg_mae"),
            func.avg(ForecastAccuracyAggregate.avg_bias).label("avg_bias"),
            func.coalesce(func.sum(ForecastAccuracyAggregate.forecast_runs_count), 0).label("forecast_runs_count"),
            func.coalesce(func.sum(ForecastAccuracyAggregate.samples_count), 0).label("samples_count"),
        )
        .join(ForecastProvider, ForecastProvider.id == ForecastAccuracyAggregate.provider_id)
        .where(ForecastAccuracyAggregate.bucket_type == bucket_type)
        .where(ForecastAccuracyAggregate.period_start >= period_from)
        .where(ForecastAccuracyAggregate.period_start <= period_to)
        .group_by(ForecastProvider.id, ForecastProvider.code, ForecastProvider.name)
    )

    if solar_plant_id is not None:
        statement = statement.where(ForecastAccuracyAggregate.solar_plant_id == solar_plant_id)

    result = await session.execute(statement)
    return list(result.all())


async def get_summary(
    session: AsyncSession,
    *,
    bucket_type: str,
    period_from: datetime,
    period_to: datetime,
):
    statement = (
        select(
            func.count(ForecastAccuracyAggregate.id).label("aggregates_count"),
            func.count(func.distinct(ForecastAccuracyAggregate.provider_id)).label("providers_count"),
            func.count(func.distinct(ForecastAccuracyAggregate.solar_plant_id)).label("solar_plants_count"),
            func.coalesce(func.sum(ForecastAccuracyAggregate.forecast_runs_count), 0).label("forecast_runs_count"),
            func.coalesce(func.sum(ForecastAccuracyAggregate.samples_count), 0).label("samples_count"),
            func.avg(ForecastAccuracyAggregate.avg_mape).label("avg_mape"),
            func.avg(ForecastAccuracyAggregate.avg_rmse).label("avg_rmse"),
            func.avg(ForecastAccuracyAggregate.avg_mae).label("avg_mae"),
            func.avg(ForecastAccuracyAggregate.avg_bias).label("avg_bias"),
        )
        .where(ForecastAccuracyAggregate.bucket_type == bucket_type)
        .where(ForecastAccuracyAggregate.period_start >= period_from)
        .where(ForecastAccuracyAggregate.period_start <= period_to)
    )
    result = await session.execute(statement)
    return result.one()
