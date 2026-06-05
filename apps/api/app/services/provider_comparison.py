import uuid
from datetime import datetime

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.forecast import ForecastAccuracy, ForecastProvider, ForecastRun
from app.schemas.provider_comparison import ProviderAccuracySummary


def _apply_period_filters(
    statement: Select[tuple],
    period_from: datetime | None,
    period_to: datetime | None,
) -> Select[tuple]:
    if period_from is not None:
        statement = statement.where(ForecastAccuracy.period_start >= period_from)
    if period_to is not None:
        statement = statement.where(ForecastAccuracy.period_end <= period_to)
    return statement


async def get_provider_accuracy_summaries(
    session: AsyncSession,
    *,
    solar_plant_id: uuid.UUID,
    period_from: datetime | None = None,
    period_to: datetime | None = None,
) -> list[ProviderAccuracySummary]:
    statement = (
        select(
            ForecastProvider.id.label("provider_id"),
            ForecastProvider.code.label("provider_code"),
            ForecastProvider.name.label("provider_name"),
            ForecastProvider.provider_type.label("provider_type"),
            func.count(ForecastAccuracy.id).label("forecast_runs_count"),
            func.coalesce(func.sum(ForecastAccuracy.samples_count), 0).label("samples_count"),
            func.avg(ForecastAccuracy.mape).label("avg_mape"),
            func.avg(ForecastAccuracy.rmse).label("avg_rmse"),
            func.avg(ForecastAccuracy.mae).label("avg_mae"),
            func.avg(ForecastAccuracy.bias).label("avg_bias"),
        )
        .join(ForecastRun, ForecastRun.provider_id == ForecastProvider.id)
        .join(ForecastAccuracy, ForecastAccuracy.forecast_run_id == ForecastRun.id)
        .where(ForecastRun.solar_plant_id == solar_plant_id)
        .group_by(
            ForecastProvider.id,
            ForecastProvider.code,
            ForecastProvider.name,
            ForecastProvider.provider_type,
        )
    )
    statement = _apply_period_filters(statement, period_from, period_to)
    result = await session.execute(statement)

    return [
        ProviderAccuracySummary(
            provider_id=row.provider_id,
            provider_code=row.provider_code,
            provider_name=row.provider_name,
            provider_type=row.provider_type,
            forecast_runs_count=row.forecast_runs_count,
            samples_count=row.samples_count,
            avg_mape=row.avg_mape,
            avg_rmse=row.avg_rmse,
            avg_mae=row.avg_mae,
            avg_bias=row.avg_bias,
        )
        for row in result
    ]


def choose_best_provider(
    summaries: list[ProviderAccuracySummary],
) -> tuple[ProviderAccuracySummary | None, str | None]:
    candidates = [summary for summary in summaries if summary.avg_mape is not None]
    if candidates:
        return min(candidates, key=lambda summary: summary.avg_mape or float("inf")), "avg_mape"

    candidates = [summary for summary in summaries if summary.avg_mae is not None]
    if candidates:
        return min(candidates, key=lambda summary: summary.avg_mae or float("inf")), "avg_mae"

    candidates = [summary for summary in summaries if summary.avg_rmse is not None]
    if candidates:
        return min(candidates, key=lambda summary: summary.avg_rmse or float("inf")), "avg_rmse"

    return None, None


def sort_provider_summaries(
    summaries: list[ProviderAccuracySummary],
) -> list[ProviderAccuracySummary]:
    return sorted(
        summaries,
        key=lambda summary: (
            summary.avg_mape is None,
            summary.avg_mape if summary.avg_mape is not None else float("inf"),
            summary.avg_mae if summary.avg_mae is not None else float("inf"),
            summary.avg_rmse if summary.avg_rmse is not None else float("inf"),
        ),
    )
