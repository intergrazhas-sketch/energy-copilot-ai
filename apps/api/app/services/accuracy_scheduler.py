import logging
import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.forecast import list_forecast_runs_for_actual_point
from app.services.forecast_accuracy import calculate_accuracy_for_run

logger = logging.getLogger(__name__)


async def recalculate_accuracy_for_actual_point(
    session: AsyncSession,
    *,
    solar_plant_id: uuid.UUID,
    timestamp: datetime,
) -> list[uuid.UUID]:
    forecast_runs = await list_forecast_runs_for_actual_point(
        session,
        solar_plant_id=solar_plant_id,
        timestamp=timestamp,
    )

    recalculated_run_ids: list[uuid.UUID] = []
    for forecast_run in forecast_runs:
        try:
            await calculate_accuracy_for_run(session, forecast_run.id)
            recalculated_run_ids.append(forecast_run.id)
        except Exception:
            logger.exception("Failed to recalculate forecast accuracy", extra={"run_id": str(forecast_run.id)})

    return recalculated_run_ids
