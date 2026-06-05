import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import forecast as repository
from app.schemas.telemetry import ActualGenerationTelemetryPayload
from app.services.accuracy_scheduler import recalculate_accuracy_for_actual_point


async def ingest_actual_generation_point(
    session: AsyncSession,
    *,
    solar_plant_id: uuid.UUID,
    payload: ActualGenerationTelemetryPayload,
) -> tuple[list[uuid.UUID], int]:
    plant = await repository.get_solar_plant(session, solar_plant_id)
    if plant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solar plant not found",
        )

    await repository.upsert_actual_generation_point(
        session,
        solar_plant_id=solar_plant_id,
        timestamp=payload.timestamp,
        actual_power_kw=payload.actual_power_kw,
        actual_energy_kwh=payload.actual_energy_kwh,
        source=payload.source or "mqtt",
        quality=payload.quality or "measured",
    )

    recalculated_run_ids = await recalculate_accuracy_for_actual_point(
        session,
        solar_plant_id=solar_plant_id,
        timestamp=payload.timestamp,
    )

    return recalculated_run_ids, len(recalculated_run_ids)
