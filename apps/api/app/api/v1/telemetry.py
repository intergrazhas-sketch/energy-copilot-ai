import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.repositories.telemetry import (
    get_rejected_telemetry,
    list_rejected_telemetry,
    summarize_rejected_telemetry,
    update_rejected_resolution,
)
from app.schemas.telemetry import (
    RejectedTelemetryRead,
    RejectedTelemetryReason,
    RejectedTelemetryResolutionStatus,
    RejectedTelemetryResolutionUpdate,
    RejectedTelemetrySummary,
    RejectedTelemetrySummaryItem,
)

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])


@router.get("/rejected/summary", response_model=RejectedTelemetrySummary)
async def get_rejected_summary(
    plant_id: uuid.UUID | None = None,
    period_from: datetime | None = Query(default=None, alias="from"),
    period_to: datetime | None = Query(default=None, alias="to"),
    resolution_status: RejectedTelemetryResolutionStatus | None = None,
    session: AsyncSession = Depends(get_db_session),
):
    rows = await summarize_rejected_telemetry(
        session,
        plant_id=plant_id,
        period_from=period_from,
        period_to=period_to,
        resolution_status=resolution_status.value if resolution_status else None,
    )
    items = [
        RejectedTelemetrySummaryItem(reason=RejectedTelemetryReason(reason), count=count)
        for reason, count in rows
    ]
    return RejectedTelemetrySummary(
        total=sum(item.count for item in items),
        items=items,
    )


@router.get("/rejected", response_model=list[RejectedTelemetryRead])
async def get_rejected_messages(
    plant_id: uuid.UUID | None = None,
    reason: RejectedTelemetryReason | None = None,
    period_from: datetime | None = Query(default=None, alias="from"),
    period_to: datetime | None = Query(default=None, alias="to"),
    resolution_status: RejectedTelemetryResolutionStatus | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
):
    return await list_rejected_telemetry(
        session,
        plant_id=plant_id,
        reason=reason.value if reason else None,
        period_from=period_from,
        period_to=period_to,
        resolution_status=resolution_status.value if resolution_status else None,
        limit=limit,
        offset=offset,
    )


@router.get("/rejected/{rejected_id}", response_model=RejectedTelemetryRead)
async def get_rejected_message(
    rejected_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
):
    rejected = await get_rejected_telemetry(session, rejected_id)
    if rejected is None:
        raise HTTPException(status_code=404, detail="Rejected telemetry not found")
    return rejected


@router.patch("/rejected/{rejected_id}/resolution", response_model=RejectedTelemetryRead)
async def patch_rejected_resolution(
    rejected_id: uuid.UUID,
    payload: RejectedTelemetryResolutionUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    rejected = await get_rejected_telemetry(session, rejected_id)
    if rejected is None:
        raise HTTPException(status_code=404, detail="Rejected telemetry not found")
    return await update_rejected_resolution(
        session,
        rejected,
        payload.resolution_status.value,
    )
