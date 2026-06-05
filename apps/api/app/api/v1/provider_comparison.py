import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.repositories.forecast import get_solar_plant
from app.schemas.provider_comparison import BestProviderResponse, ProviderComparisonResponse
from app.services.provider_comparison import (
    choose_best_provider,
    get_provider_accuracy_summaries,
    sort_provider_summaries,
)

router = APIRouter(
    prefix="/solar-plants/{plant_id}/forecast-providers",
    tags=["Forecast Provider Comparison"],
)


async def _ensure_plant_exists(session: AsyncSession, plant_id: uuid.UUID) -> None:
    plant = await get_solar_plant(session, plant_id)
    if plant is None:
        raise HTTPException(status_code=404, detail="Solar plant not found")


@router.get("/accuracy", response_model=ProviderComparisonResponse)
async def get_provider_accuracy(
    plant_id: uuid.UUID,
    period_from: datetime | None = Query(default=None, alias="from"),
    period_to: datetime | None = Query(default=None, alias="to"),
    session: AsyncSession = Depends(get_db_session),
):
    await _ensure_plant_exists(session, plant_id)
    summaries = await get_provider_accuracy_summaries(
        session,
        solar_plant_id=plant_id,
        period_from=period_from,
        period_to=period_to,
    )
    return ProviderComparisonResponse(
        solar_plant_id=plant_id,
        period_from=period_from,
        period_to=period_to,
        providers=sort_provider_summaries(summaries),
    )


@router.get("/compare", response_model=ProviderComparisonResponse)
async def compare_providers(
    plant_id: uuid.UUID,
    period_from: datetime | None = Query(default=None, alias="from"),
    period_to: datetime | None = Query(default=None, alias="to"),
    session: AsyncSession = Depends(get_db_session),
):
    return await get_provider_accuracy(
        plant_id=plant_id,
        period_from=period_from,
        period_to=period_to,
        session=session,
    )


@router.get("/best", response_model=BestProviderResponse)
async def get_best_provider(
    plant_id: uuid.UUID,
    period_from: datetime | None = Query(default=None, alias="from"),
    period_to: datetime | None = Query(default=None, alias="to"),
    session: AsyncSession = Depends(get_db_session),
):
    await _ensure_plant_exists(session, plant_id)
    summaries = await get_provider_accuracy_summaries(
        session,
        solar_plant_id=plant_id,
        period_from=period_from,
        period_to=period_to,
    )
    best_provider, metric_used = choose_best_provider(summaries)

    return BestProviderResponse(
        solar_plant_id=plant_id,
        period_from=period_from,
        period_to=period_to,
        metric_used=metric_used,
        provider=best_provider,
    )
