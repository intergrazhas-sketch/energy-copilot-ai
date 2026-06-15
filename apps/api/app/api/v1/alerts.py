import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.schemas.alerts import AlertRead, AlertsSummary
from app.services.alerts import get_alerts_summary

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("/summary", response_model=AlertsSummary)
async def alerts_summary(
    plant_id: uuid.UUID | None = None,
    period_from: datetime | None = Query(default=None, alias="from"),
    period_to: datetime | None = Query(default=None, alias="to"),
    session: AsyncSession = Depends(get_db_session),
):
    return await get_alerts_summary(
        session,
        plant_id=plant_id,
        period_from=period_from,
        period_to=period_to,
    )


@router.get("", response_model=list[AlertRead])
async def list_alerts(
    plant_id: uuid.UUID | None = None,
    period_from: datetime | None = Query(default=None, alias="from"),
    period_to: datetime | None = Query(default=None, alias="to"),
    session: AsyncSession = Depends(get_db_session),
):
    summary = await get_alerts_summary(
        session,
        plant_id=plant_id,
        period_from=period_from,
        period_to=period_to,
    )
    return summary.alerts
