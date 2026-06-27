import uuid
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.forecast import (
    ActualGeneration,
    ForecastAccuracy,
    ForecastProvider,
    ForecastRun,
    ForecastValue,
    SolarPlant,
)
from app.schemas.forecast import (
    ActualGenerationCreate,
    ForecastProviderCreate,
    ForecastRunCreate,
    ForecastValuesCreate,
    SolarPlantCreate,
)


async def create_solar_plant(session: AsyncSession, payload: SolarPlantCreate) -> SolarPlant:
    plant = SolarPlant(**payload.model_dump())
    session.add(plant)
    await session.commit()
    await session.refresh(plant)
    return plant


async def list_solar_plants(session: AsyncSession) -> list[SolarPlant]:
    result = await session.execute(select(SolarPlant).order_by(SolarPlant.created_at.desc()))
    return list(result.scalars().all())


async def get_solar_plant(session: AsyncSession, plant_id: uuid.UUID) -> SolarPlant | None:
    return await session.get(SolarPlant, plant_id)


async def create_forecast_provider(
    session: AsyncSession,
    payload: ForecastProviderCreate,
) -> ForecastProvider:
    provider = ForecastProvider(**payload.model_dump())
    session.add(provider)
    await session.commit()
    await session.refresh(provider)
    return provider


async def list_forecast_providers(session: AsyncSession) -> list[ForecastProvider]:
    result = await session.execute(
        select(ForecastProvider).order_by(ForecastProvider.created_at.desc())
    )
    return list(result.scalars().all())


async def get_forecast_provider(
    session: AsyncSession,
    provider_id: uuid.UUID,
) -> ForecastProvider | None:
    return await session.get(ForecastProvider, provider_id)


async def get_forecast_provider_by_code(
    session: AsyncSession,
    provider_code: str,
) -> ForecastProvider | None:
    result = await session.execute(
        select(ForecastProvider).where(ForecastProvider.code == provider_code)
    )
    return result.scalar_one_or_none()


async def ensure_forecast_provider(
    session: AsyncSession,
    *,
    code: str,
    name: str,
    provider_type: str,
    config: dict | None = None,
) -> ForecastProvider:
    provider = await get_forecast_provider_by_code(session, code)
    if provider is not None:
        return provider

    provider = ForecastProvider(
        code=code,
        name=name,
        provider_type=provider_type,
        is_active=True,
        config=config or {},
    )
    session.add(provider)
    await session.commit()
    await session.refresh(provider)
    return provider


async def create_forecast_run(session: AsyncSession, payload: ForecastRunCreate) -> ForecastRun:
    forecast_run = ForecastRun(**payload.model_dump())
    session.add(forecast_run)
    await session.commit()
    await session.refresh(forecast_run)
    return forecast_run


async def list_forecast_runs(session: AsyncSession) -> list[ForecastRun]:
    result = await session.execute(select(ForecastRun).order_by(ForecastRun.created_at.desc()))
    return list(result.scalars().all())


async def get_forecast_run(session: AsyncSession, run_id: uuid.UUID) -> ForecastRun | None:
    return await session.get(ForecastRun, run_id)


async def create_forecast_values(
    session: AsyncSession,
    forecast_run: ForecastRun,
    payload: ForecastValuesCreate,
) -> list[ForecastValue]:
    values = [
        ForecastValue(
            forecast_run_id=forecast_run.id,
            solar_plant_id=forecast_run.solar_plant_id,
            **item.model_dump(),
        )
        for item in payload.values
    ]
    session.add_all(values)
    await session.commit()

    for value in values:
        await session.refresh(value)
    return values


async def list_forecast_values(
    session: AsyncSession,
    forecast_run_id: uuid.UUID,
) -> list[ForecastValue]:
    result = await session.execute(
        select(ForecastValue)
        .where(ForecastValue.forecast_run_id == forecast_run_id)
        .order_by(ForecastValue.timestamp)
    )
    return list(result.scalars().all())


async def create_actual_generation(
    session: AsyncSession,
    payload: ActualGenerationCreate,
) -> list[ActualGeneration]:
    values = [
        ActualGeneration(
            solar_plant_id=payload.solar_plant_id,
            **item.model_dump(),
        )
        for item in payload.values
    ]
    session.add_all(values)
    await session.commit()

    for value in values:
        await session.refresh(value)
    return values


async def upsert_actual_generation_point(
    session: AsyncSession,
    *,
    solar_plant_id: uuid.UUID,
    timestamp: datetime,
    actual_power_kw: float,
    actual_energy_kwh: float | None,
    source: str,
    quality: str,
) -> ActualGeneration:
    statement = (
        insert(ActualGeneration)
        .values(
            solar_plant_id=solar_plant_id,
            timestamp=timestamp,
            actual_power_kw=actual_power_kw,
            actual_energy_kwh=actual_energy_kwh,
            source=source,
            quality=quality,
        )
        .on_conflict_do_update(
            constraint="uq_actual_generation_plant_timestamp",
            set_={
                "actual_power_kw": actual_power_kw,
                "actual_energy_kwh": actual_energy_kwh,
                "source": source,
                "quality": quality,
            },
        )
        .returning(ActualGeneration)
    )
    result = await session.execute(statement)
    await session.commit()
    return result.scalar_one()


async def list_actual_generation(
    session: AsyncSession,
    plant_id: uuid.UUID,
    period_from: datetime,
    period_to: datetime,
) -> list[ActualGeneration]:
    result = await session.execute(
        select(ActualGeneration)
        .where(ActualGeneration.solar_plant_id == plant_id)
        .where(ActualGeneration.timestamp >= period_from)
        .where(ActualGeneration.timestamp <= period_to)
        .order_by(ActualGeneration.timestamp)
    )
    return list(result.scalars().all())


async def get_accuracy_by_run(
    session: AsyncSession,
    forecast_run_id: uuid.UUID,
) -> ForecastAccuracy | None:
    result = await session.execute(
        select(ForecastAccuracy).where(ForecastAccuracy.forecast_run_id == forecast_run_id)
    )
    return result.scalar_one_or_none()


async def delete_forecast_runs_in_range(
    session: AsyncSession,
    *,
    solar_plant_id: uuid.UUID,
    provider_id: uuid.UUID,
    period_from: datetime,
    period_to: datetime,
) -> int:
    """Delete forecast runs (of one provider) that have any value in the range.

    Used by batch import to make re-importing the same day idempotent: the old
    run + its values + its accuracy row are removed (ON DELETE CASCADE) before
    the fresh run is inserted, so repeated uploads never double-count accuracy.
    """
    run_id_rows = await session.execute(
        select(ForecastValue.forecast_run_id)
        .join(ForecastRun, ForecastRun.id == ForecastValue.forecast_run_id)
        .where(ForecastRun.solar_plant_id == solar_plant_id)
        .where(ForecastRun.provider_id == provider_id)
        .where(ForecastValue.timestamp >= period_from)
        .where(ForecastValue.timestamp <= period_to)
        .distinct()
    )
    run_ids = [row[0] for row in run_id_rows.all()]
    if not run_ids:
        return 0

    await session.execute(delete(ForecastRun).where(ForecastRun.id.in_(run_ids)))
    await session.commit()
    return len(run_ids)


async def list_forecast_runs_for_actual_point(
    session: AsyncSession,
    *,
    solar_plant_id: uuid.UUID,
    timestamp: datetime,
) -> list[ForecastRun]:
    result = await session.execute(
        select(ForecastRun)
        .join(ForecastValue, ForecastValue.forecast_run_id == ForecastRun.id)
        .where(ForecastRun.solar_plant_id == solar_plant_id)
        .where(ForecastValue.timestamp == timestamp)
        .order_by(ForecastRun.created_at.desc())
    )
    return list(result.scalars().unique().all())
