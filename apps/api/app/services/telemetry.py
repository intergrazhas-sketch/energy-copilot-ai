import uuid
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.forecast import ActualGeneration
from app.repositories import forecast as forecast_repository
from app.repositories import telemetry as telemetry_repository
from app.schemas.telemetry import (
    TelemetryDataFreshnessStatus,
    TelemetryPointRead,
    TelemetrySummaryRead,
)

FRESH_DATA_THRESHOLD_MINUTES = 30
STALE_DATA_THRESHOLD_MINUTES = 120


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _to_point(row: ActualGeneration) -> TelemetryPointRead:
    return TelemetryPointRead(
        id=row.id,
        asset_id=row.solar_plant_id,
        timestamp=row.timestamp,
        actual_power_kw=row.actual_power_kw,
        actual_energy_kwh=row.actual_energy_kwh,
        source=row.source,
        quality=row.quality,
        created_at=row.created_at,
    )


def _freshness_status(gap_minutes: int | None) -> TelemetryDataFreshnessStatus:
    if gap_minutes is None:
        return TelemetryDataFreshnessStatus.no_data
    if gap_minutes <= FRESH_DATA_THRESHOLD_MINUTES:
        return TelemetryDataFreshnessStatus.fresh
    if gap_minutes <= STALE_DATA_THRESHOLD_MINUTES:
        return TelemetryDataFreshnessStatus.stale
    return TelemetryDataFreshnessStatus.offline


def _today_bounds_utc(timezone_name: str) -> tuple[datetime, datetime]:
    try:
        plant_timezone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        plant_timezone = timezone.utc

    now_local = datetime.now(plant_timezone)
    start_local = datetime.combine(now_local.date(), time.min, tzinfo=plant_timezone)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def _possible_gap_minutes(
    *,
    latest: ActualGeneration | None,
    period_from: datetime,
    period_to: datetime,
) -> int | None:
    if latest is None:
        return max(0, int((period_to - period_from).total_seconds() // 60))

    reference_time = min(period_to, datetime.now(timezone.utc))
    return max(0, int((reference_time - _as_utc(latest.timestamp)).total_seconds() // 60))


async def _ensure_asset_exists(session: AsyncSession, asset_id: uuid.UUID):
    plant = await forecast_repository.get_solar_plant(session, asset_id)
    if plant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )
    return plant


async def get_latest_telemetry(
    session: AsyncSession,
    *,
    asset_id: uuid.UUID,
) -> TelemetryPointRead | None:
    await _ensure_asset_exists(session, asset_id)
    latest = await telemetry_repository.get_latest_actual_generation(
        session,
        asset_id=asset_id,
    )
    return _to_point(latest) if latest else None


async def get_telemetry_history(
    session: AsyncSession,
    *,
    asset_id: uuid.UUID,
    period_from: datetime,
    period_to: datetime,
    limit: int,
    offset: int,
) -> list[TelemetryPointRead]:
    period_from = _as_utc(period_from)
    period_to = _as_utc(period_to)
    if period_from > period_to:
        raise HTTPException(status_code=400, detail="period_from must be before period_to")

    await _ensure_asset_exists(session, asset_id)
    rows = await telemetry_repository.list_actual_generation_history(
        session,
        asset_id=asset_id,
        period_from=period_from,
        period_to=period_to,
        limit=limit,
        offset=offset,
    )
    return [_to_point(row) for row in rows]


async def get_telemetry_summary(
    session: AsyncSession,
    *,
    asset_id: uuid.UUID,
    period_from: datetime,
    period_to: datetime,
    revenue_per_kwh: float | None,
) -> TelemetrySummaryRead:
    period_from = _as_utc(period_from)
    period_to = _as_utc(period_to)
    if period_from > period_to:
        raise HTTPException(status_code=400, detail="period_from must be before period_to")

    plant = await _ensure_asset_exists(session, asset_id)
    latest = await telemetry_repository.get_latest_actual_generation(
        session,
        asset_id=asset_id,
        period_from=period_from,
        period_to=period_to,
    )
    stats = await telemetry_repository.get_actual_generation_summary_stats(
        session,
        asset_id=asset_id,
        period_from=period_from,
        period_to=period_to,
    )
    today_from, today_to = _today_bounds_utc(plant.timezone)
    energy_today_kwh = await telemetry_repository.sum_actual_energy(
        session,
        asset_id=asset_id,
        period_from=today_from,
        period_to=today_to,
    )
    possible_gap_minutes = _possible_gap_minutes(
        latest=latest,
        period_from=period_from,
        period_to=period_to,
    )
    estimated_revenue_today = (
        energy_today_kwh * revenue_per_kwh
        if energy_today_kwh is not None and revenue_per_kwh is not None
        else None
    )

    return TelemetrySummaryRead(
        asset_id=asset_id,
        period_from=period_from,
        period_to=period_to,
        current_power_kw=latest.actual_power_kw if latest else None,
        energy_today_kwh=energy_today_kwh,
        avg_power_kw=stats.avg_power_kw,
        max_power_kw=stats.max_power_kw,
        telemetry_points_count=stats.telemetry_points_count,
        last_telemetry_time=latest.timestamp if latest else None,
        data_freshness_status=_freshness_status(possible_gap_minutes if latest else None),
        estimated_revenue_today=estimated_revenue_today,
        possible_data_gap_minutes=possible_gap_minutes,
    )
