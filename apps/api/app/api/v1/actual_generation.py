import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.repositories import forecast as repository
from app.schemas.forecast import ActualGenerationCreate, ActualGenerationRead

router = APIRouter(prefix="/actual-generation", tags=["Forecast MVP"])


@router.post("", response_model=list[ActualGenerationRead], status_code=status.HTTP_201_CREATED)
async def create_actual_generation(
    payload: ActualGenerationCreate,
    session: AsyncSession = Depends(get_db_session),
):
    plant = await repository.get_solar_plant(session, payload.solar_plant_id)
    if plant is None:
        raise HTTPException(status_code=404, detail="Solar plant not found")

    try:
        return await repository.create_actual_generation(session, payload)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Could not create actual generation") from exc


@router.get("", response_model=list[ActualGenerationRead])
async def list_actual_generation(
    plant_id: uuid.UUID,
    period_from: datetime = Query(alias="from"),
    period_to: datetime = Query(alias="to"),
    session: AsyncSession = Depends(get_db_session),
):
    return await repository.list_actual_generation(
        session,
        plant_id=plant_id,
        period_from=period_from,
        period_to=period_to,
    )
