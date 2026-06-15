import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.models.forecast import ActualGeneration, ForecastAccuracyAggregate, ForecastProvider, ForecastRun
from app.repositories import forecast as repository
from app.schemas.forecast import ForecastProviderCreate, ForecastProviderOverviewRead, ForecastProviderRead

router = APIRouter(prefix="/forecast-providers", tags=["Forecast MVP"])

FORECAST_PROVIDER_NAMESPACE = uuid.UUID("d41df9ae-d7d4-4b35-a7ed-65f0999d5f52")
FORECAST_BASELINE_MAPE = 14.0
FORECAST_TARGET_MAPE = 10.0


@router.post("", response_model=ForecastProviderRead, status_code=status.HTTP_201_CREATED)
async def create_forecast_provider(
    payload: ForecastProviderCreate,
    session: AsyncSession = Depends(get_db_session),
):
    try:
        return await repository.create_forecast_provider(session, payload)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Forecast provider already exists") from exc


async def _get_latest_forecast_at(
    session: AsyncSession,
    provider: ForecastProvider | None,
) -> datetime | None:
    if provider is None:
        return None

    return await session.scalar(
        select(func.max(ForecastRun.run_at)).where(ForecastRun.provider_id == provider.id)
    )


async def _get_forecast_runs_count(
    session: AsyncSession,
    provider: ForecastProvider | None,
) -> int:
    if provider is None:
        return 0

    return int(
        await session.scalar(
            select(func.count(ForecastRun.id)).where(ForecastRun.provider_id == provider.id)
        )
        or 0
    )


async def _get_latest_accuracy_mape(
    session: AsyncSession,
    provider: ForecastProvider | None,
) -> float | None:
    if provider is None:
        return None

    result = await session.execute(
        select(ForecastAccuracyAggregate.avg_mape)
        .where(ForecastAccuracyAggregate.provider_id == provider.id)
        .where(ForecastAccuracyAggregate.bucket_type == "day")
        .order_by(ForecastAccuracyAggregate.period_end.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _get_actuals_status(session: AsyncSession) -> tuple[datetime | None, int]:
    result = await session.execute(
        select(
            func.max(ActualGeneration.timestamp).label("latest_actual_at"),
            func.count(ActualGeneration.id).label("actuals_count"),
        )
    )
    row = result.one()
    return row.latest_actual_at, int(row.actuals_count or 0)


async def _build_provider_overview(
    session: AsyncSession,
    *,
    code: str,
    name: str,
    provider_type: str,
    db_provider: ForecastProvider | None = None,
    status: str = "unknown",
    data_status: str = "unknown",
    notes: str,
    recommended_action: str,
    baseline_mape: float | None = FORECAST_BASELINE_MAPE,
) -> ForecastProviderOverviewRead:
    latest_forecast_at = await _get_latest_forecast_at(session, db_provider)
    forecast_runs_count = await _get_forecast_runs_count(session, db_provider)
    latest_accuracy_mape = await _get_latest_accuracy_mape(session, db_provider)

    return ForecastProviderOverviewRead(
        id=db_provider.id if db_provider else uuid.uuid5(FORECAST_PROVIDER_NAMESPACE, code),
        code=code,
        name=name,
        provider_type=provider_type,
        status=status,
        data_status=data_status,
        latest_forecast_at=latest_forecast_at,
        latest_accuracy_mape=latest_accuracy_mape,
        baseline_mape=baseline_mape,
        target_mape=FORECAST_TARGET_MAPE,
        notes=notes,
        recommended_action=recommended_action,
        forecast_runs_count=forecast_runs_count,
    )


@router.get("", response_model=list[ForecastProviderOverviewRead])
async def list_forecast_providers(session: AsyncSession = Depends(get_db_session)):
    db_providers = await repository.list_forecast_providers(session)
    provider_by_code = {provider.code: provider for provider in db_providers}
    latest_actual_at, actuals_count = await _get_actuals_status(session)
    actuals_connected = actuals_count > 0

    providers = [
        await _build_provider_overview(
            session,
            code="solcast",
            name="Solcast",
            provider_type="external",
            status="inactive",
            data_status="not_connected",
            notes="external_not_configured",
            recommended_action="needs_configuration",
        ),
        await _build_provider_overview(
            session,
            code="meteologix",
            name="Meteologix",
            provider_type="external",
            status="inactive",
            data_status="not_connected",
            notes="external_not_configured",
            recommended_action="needs_configuration",
        ),
        await _build_provider_overview(
            session,
            code="internal_baseline",
            name="Internal Baseline",
            provider_type="baseline",
            db_provider=provider_by_code.get("mock"),
            status="active",
            data_status="simulated",
            notes="pilot_baseline",
            recommended_action="no_recent_forecast"
            if provider_by_code.get("mock") is None
            else "ready_for_connection",
        ),
        ForecastProviderOverviewRead(
            id=provider_by_code.get("manual").id
            if provider_by_code.get("manual")
            else uuid.uuid5(FORECAST_PROVIDER_NAMESPACE, "manual_csv_actuals"),
            code="manual_csv_actuals",
            name="Manual CSV / Actuals reference",
            provider_type="internal",
            status="active" if actuals_connected else "unknown",
            data_status="connected" if actuals_connected else "not_connected",
            latest_forecast_at=latest_actual_at,
            latest_accuracy_mape=None,
            baseline_mape=None,
            target_mape=FORECAST_TARGET_MAPE,
            notes="actuals_reference_connected" if actuals_connected else "actuals_reference_empty",
            recommended_action="ready_for_connection" if actuals_connected else "no_data",
            forecast_runs_count=actuals_count,
        ),
    ]

    return providers
