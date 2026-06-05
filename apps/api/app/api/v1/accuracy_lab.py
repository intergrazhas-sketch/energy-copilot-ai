import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.schemas.accuracy_lab import (
    AccuracyBucketType,
    AccuracyLabRecalculateRequest,
    AccuracyLabRecalculateResponse,
    AccuracyLabSummaryResponse,
    AccuracyProviderRankingResponse,
)
from app.services.accuracy_lab import (
    get_accuracy_lab_summary,
    get_provider_ranking,
    recalculate_accuracy_lab,
)

router = APIRouter(prefix="/accuracy-lab", tags=["Forecast Accuracy Lab"])


@router.post("/recalculate", response_model=AccuracyLabRecalculateResponse)
async def recalculate(
    payload: AccuracyLabRecalculateRequest,
    session: AsyncSession = Depends(get_db_session),
):
    return await recalculate_accuracy_lab(session, payload)


@router.get("/providers/ranking", response_model=AccuracyProviderRankingResponse)
async def provider_ranking(
    period_from: datetime = Query(alias="from"),
    period_to: datetime = Query(alias="to"),
    bucket: AccuracyBucketType = AccuracyBucketType.day,
    session: AsyncSession = Depends(get_db_session),
):
    return await get_provider_ranking(
        session,
        bucket_type=bucket,
        period_from=period_from,
        period_to=period_to,
    )


@router.get(
    "/solar-plants/{plant_id}/providers/ranking",
    response_model=AccuracyProviderRankingResponse,
)
async def plant_provider_ranking(
    plant_id: uuid.UUID,
    period_from: datetime = Query(alias="from"),
    period_to: datetime = Query(alias="to"),
    bucket: AccuracyBucketType = AccuracyBucketType.day,
    session: AsyncSession = Depends(get_db_session),
):
    return await get_provider_ranking(
        session,
        bucket_type=bucket,
        period_from=period_from,
        period_to=period_to,
        solar_plant_id=plant_id,
    )


@router.get("/summary", response_model=AccuracyLabSummaryResponse)
async def summary(
    period_from: datetime = Query(alias="from"),
    period_to: datetime = Query(alias="to"),
    bucket: AccuracyBucketType = AccuracyBucketType.day,
    session: AsyncSession = Depends(get_db_session),
):
    return await get_accuracy_lab_summary(
        session,
        bucket_type=bucket,
        period_from=period_from,
        period_to=period_to,
    )
