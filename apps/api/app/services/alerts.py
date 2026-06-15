import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.models.forecast import ForecastAccuracyAggregate, ForecastRun, SolarPlant
from app.repositories import forecast as forecast_repository
from app.repositories import telemetry as telemetry_repository
from app.schemas.alerts import AlertRead, AlertSeverity, AlertsSummary
from app.services.readiness import check_dependencies

FORECAST_TARGET_MAPE = 10.0
DEFAULT_ALERT_PERIOD_DAYS = 7
CRITICAL_REJECTION_REASONS = {
    "invalid_topic",
    "plant_not_found",
    "invalid_json",
    "negative_power",
    "power_exceeds_capacity",
}


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _default_period() -> tuple[datetime, datetime]:
    period_to = datetime.now(timezone.utc)
    period_from = period_to - timedelta(days=DEFAULT_ALERT_PERIOD_DAYS)
    return period_from, period_to


def _alert(
    *,
    alert_id: str,
    alert_type: str,
    severity: AlertSeverity,
    title: str,
    message: str,
    source: str,
    detected_at: datetime,
    plant_id: uuid.UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> AlertRead:
    return AlertRead(
        id=alert_id,
        type=alert_type,
        severity=severity,
        title=title,
        message=message,
        source=source,
        plant_id=plant_id,
        detected_at=detected_at,
        metadata=metadata or {},
    )


async def _get_plants(session: AsyncSession, plant_id: uuid.UUID | None) -> list[SolarPlant]:
    if plant_id is not None:
        plant = await forecast_repository.get_solar_plant(session, plant_id)
        return [plant] if plant else []
    return await forecast_repository.list_solar_plants(session)


async def _build_telemetry_alerts(
    session: AsyncSession,
    *,
    plants: list[SolarPlant],
    detected_at: datetime,
    settings: Settings,
) -> list[AlertRead]:
    if not plants:
        return [
            _alert(
                alert_id="telemetry-freshness-no-plant",
                alert_type="telemetry_freshness",
                severity=AlertSeverity.unknown,
                title="Telemetry freshness unknown",
                message="No solar plants are available for telemetry freshness checks.",
                source="/api/v1/telemetry/latest",
                detected_at=detected_at,
            )
        ]

    alerts: list[AlertRead] = []
    threshold_minutes = settings.alert_telemetry_critical_minutes
    for plant in plants:
        latest = await telemetry_repository.get_latest_actual_generation(session, asset_id=plant.id)
        if latest is None:
            alerts.append(
                _alert(
                    alert_id=f"telemetry-freshness-{plant.id}",
                    alert_type="telemetry_freshness",
                    severity=AlertSeverity.critical,
                    title="Telemetry missing",
                    message="No accepted telemetry exists for this solar plant.",
                    source="/api/v1/telemetry/latest",
                    plant_id=plant.id,
                    detected_at=detected_at,
                    metadata={"plant_name": plant.name, "threshold_minutes": threshold_minutes},
                )
            )
            continue

        age_minutes = max(0, int((detected_at - _as_utc(latest.timestamp)).total_seconds() // 60))
        severity = (
            AlertSeverity.critical
            if age_minutes > threshold_minutes
            else AlertSeverity.healthy
        )
        alerts.append(
            _alert(
                alert_id=f"telemetry-freshness-{plant.id}",
                alert_type="telemetry_freshness",
                severity=severity,
                title="Telemetry freshness",
                message="Latest accepted telemetry was evaluated against the configured freshness threshold.",
                source="/api/v1/telemetry/latest",
                plant_id=plant.id,
                detected_at=detected_at,
                metadata={
                    "plant_name": plant.name,
                    "age_minutes": age_minutes,
                    "threshold_minutes": threshold_minutes,
                    "latest_timestamp": latest.timestamp.isoformat(),
                },
            )
        )
    return alerts


async def _build_rejected_telemetry_alert(
    session: AsyncSession,
    *,
    plant_id: uuid.UUID | None,
    period_from: datetime,
    period_to: datetime,
    detected_at: datetime,
) -> AlertRead:
    rows = await telemetry_repository.summarize_rejected_telemetry(
        session,
        plant_id=plant_id,
        period_from=period_from,
        period_to=period_to,
        resolution_status="open",
    )
    total = sum(count for _, count in rows)
    top_reason = rows[0][0] if rows else None
    has_critical_reason = any(reason in CRITICAL_REJECTION_REASONS for reason, _ in rows)
    severity = (
        AlertSeverity.healthy
        if total == 0
        else AlertSeverity.critical
        if has_critical_reason
        else AlertSeverity.warning
    )
    return _alert(
        alert_id="rejected-telemetry",
        alert_type="rejected_telemetry",
        severity=severity,
        title="Rejected telemetry",
        message="Open rejected telemetry rows were counted for the selected period.",
        source="/api/v1/telemetry/rejected/summary",
        plant_id=plant_id,
        detected_at=detected_at,
        metadata={"count": total, "top_reason": top_reason},
    )


async def _build_system_health_alert(*, detected_at: datetime, settings: Settings) -> AlertRead:
    readiness = await check_dependencies(settings)
    dependencies = readiness.get("dependencies", {})
    failed = [
        name
        for name, dependency in dependencies.items()
        if dependency.get("status") != "ok"
    ]
    severity = AlertSeverity.healthy if not failed else AlertSeverity.critical
    return _alert(
        alert_id="system-health",
        alert_type="system_health",
        severity=severity,
        title="System health",
        message="Platform dependency readiness was checked.",
        source="/api/v1/system/status",
        detected_at=detected_at,
        metadata={
            "status": readiness.get("status", "unknown"),
            "failed_dependencies": failed,
            "dependencies_count": len(dependencies),
        },
    )


async def _build_forecast_accuracy_alert(
    session: AsyncSession,
    *,
    plant_id: uuid.UUID | None,
    period_from: datetime,
    period_to: datetime,
    detected_at: datetime,
) -> AlertRead:
    statement = (
        select(
            func.count(ForecastAccuracyAggregate.id).label("aggregates_count"),
            func.avg(ForecastAccuracyAggregate.avg_mape).label("avg_mape"),
        )
        .where(ForecastAccuracyAggregate.bucket_type == "day")
        .where(ForecastAccuracyAggregate.period_start >= period_from)
        .where(ForecastAccuracyAggregate.period_start <= period_to)
    )
    if plant_id is not None:
        statement = statement.where(ForecastAccuracyAggregate.solar_plant_id == plant_id)

    row = (await session.execute(statement)).one()
    avg_mape = row.avg_mape
    if row.aggregates_count == 0 or avg_mape is None:
        severity = AlertSeverity.unknown
    elif avg_mape > FORECAST_TARGET_MAPE:
        severity = AlertSeverity.warning
    else:
        severity = AlertSeverity.healthy

    return _alert(
        alert_id="forecast-accuracy",
        alert_type="forecast_accuracy",
        severity=severity,
        title="Forecast accuracy",
        message="Current MAPE was compared with the MVP target.",
        source="/api/v1/accuracy-lab/summary",
        plant_id=plant_id,
        detected_at=detected_at,
        metadata={
            "avg_mape": avg_mape,
            "target_mape": FORECAST_TARGET_MAPE,
            "aggregates_count": row.aggregates_count,
        },
    )


async def _build_forecast_runs_alert(
    session: AsyncSession,
    *,
    plant_id: uuid.UUID | None,
    period_from: datetime,
    period_to: datetime,
    detected_at: datetime,
) -> AlertRead:
    statement = (
        select(func.count(ForecastRun.id))
        .where(ForecastRun.created_at >= period_from)
        .where(ForecastRun.created_at <= period_to)
    )
    if plant_id is not None:
        statement = statement.where(ForecastRun.solar_plant_id == plant_id)

    runs_count = (await session.execute(statement)).scalar_one()
    severity = AlertSeverity.healthy if runs_count > 0 else AlertSeverity.warning
    return _alert(
        alert_id="forecast-runs",
        alert_type="forecast_runs",
        severity=severity,
        title="Forecast runs",
        message="Recent forecast runs were counted for the selected period.",
        source="/api/v1/forecast-runs",
        plant_id=plant_id,
        detected_at=detected_at,
        metadata={"recent_runs_count": runs_count},
    )


async def _build_provider_performance_alert(
    session: AsyncSession,
    *,
    plant_id: uuid.UUID | None,
    period_from: datetime,
    period_to: datetime,
    detected_at: datetime,
) -> AlertRead:
    statement = (
        select(
            func.count(ForecastAccuracyAggregate.id).label("aggregates_count"),
            func.min(ForecastAccuracyAggregate.avg_mape).label("best_mape"),
        )
        .where(ForecastAccuracyAggregate.bucket_type == "day")
        .where(ForecastAccuracyAggregate.period_start >= period_from)
        .where(ForecastAccuracyAggregate.period_start <= period_to)
        .where(ForecastAccuracyAggregate.samples_count > 0)
    )
    if plant_id is not None:
        statement = statement.where(ForecastAccuracyAggregate.solar_plant_id == plant_id)

    row = (await session.execute(statement)).one()
    best_mape = row.best_mape
    if row.aggregates_count == 0 or best_mape is None:
        severity = AlertSeverity.unknown
    elif best_mape > FORECAST_TARGET_MAPE:
        severity = AlertSeverity.warning
    else:
        severity = AlertSeverity.healthy

    return _alert(
        alert_id="provider-performance",
        alert_type="provider_performance",
        severity=severity,
        title="Provider performance",
        message="Provider ranking was evaluated where real provider accuracy data exists.",
        source="/api/v1/accuracy-lab/providers/ranking",
        plant_id=plant_id,
        detected_at=detected_at,
        metadata={
            "best_mape": best_mape,
            "target_mape": FORECAST_TARGET_MAPE,
            "aggregates_count": row.aggregates_count,
        },
    )


def _summarize(alerts: list[AlertRead], generated_at: datetime) -> AlertsSummary:
    healthy = sum(1 for alert in alerts if alert.severity == AlertSeverity.healthy)
    warning = sum(1 for alert in alerts if alert.severity == AlertSeverity.warning)
    critical = sum(1 for alert in alerts if alert.severity == AlertSeverity.critical)
    unknown = sum(1 for alert in alerts if alert.severity == AlertSeverity.unknown)
    return AlertsSummary(
        generated_at=generated_at,
        total=len(alerts),
        active_alerts=warning + critical,
        healthy=healthy,
        warning=warning,
        critical=critical,
        unknown=unknown,
        alerts=alerts,
    )


async def get_alerts_summary(
    session: AsyncSession,
    *,
    plant_id: uuid.UUID | None = None,
    period_from: datetime | None = None,
    period_to: datetime | None = None,
    settings: Settings | None = None,
) -> AlertsSummary:
    current_settings = settings or get_settings()
    default_from, default_to = _default_period()
    period_from = _as_utc(period_from or default_from)
    period_to = _as_utc(period_to or default_to)
    detected_at = datetime.now(timezone.utc)

    plants = await _get_plants(session, plant_id)
    alerts: list[AlertRead] = []
    alerts.extend(
        await _build_telemetry_alerts(
            session,
            plants=plants,
            detected_at=detected_at,
            settings=current_settings,
        )
    )
    alerts.append(
        await _build_rejected_telemetry_alert(
            session,
            plant_id=plant_id,
            period_from=period_from,
            period_to=period_to,
            detected_at=detected_at,
        )
    )
    alerts.append(await _build_system_health_alert(detected_at=detected_at, settings=current_settings))
    alerts.append(
        await _build_forecast_accuracy_alert(
            session,
            plant_id=plant_id,
            period_from=period_from,
            period_to=period_to,
            detected_at=detected_at,
        )
    )
    alerts.append(
        await _build_forecast_runs_alert(
            session,
            plant_id=plant_id,
            period_from=period_from,
            period_to=period_to,
            detected_at=detected_at,
        )
    )
    alerts.append(
        await _build_provider_performance_alert(
            session,
            plant_id=plant_id,
            period_from=period_from,
            period_to=period_to,
            detected_at=detected_at,
        )
    )
    return _summarize(alerts, detected_at)
