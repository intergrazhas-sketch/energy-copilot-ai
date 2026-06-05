import uuid
from datetime import datetime

from sqlalchemy import select
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
