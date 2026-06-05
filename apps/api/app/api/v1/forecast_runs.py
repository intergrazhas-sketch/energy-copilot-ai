import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.repositories import forecast as repository
from app.schemas.forecast import (
    ForecastRunCreate,
    ForecastRunRead,
    ForecastValueRead,
    ForecastValuesCreate,
)

router = APIRouter(prefix="/forecast-runs", tags=["Forecast MVP"])


@router.post("", response_model=ForecastRunRead, status_code=status.HTTP_201_CREATED)
async def create_forecast_run(
    payload: ForecastRunCreate,
    session: AsyncSession = Depends(get_db_session),
):
    plant = await repository.get_solar_plant(session, payload.solar_plant_id)
    if plant is None:
        raise HTTPException(status_code=404, detail="Solar plant not found")

    provider = await repository.get_forecast_provider(session, payload.provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="Forecast provider not found")

    try:
        return await repository.create_forecast_run(session, payload)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Could not create forecast run") from exc


@router.get("", response_model=list[ForecastRunRead])
async def list_forecast_runs(session: AsyncSession = Depends(get_db_session)):
    return await repository.list_forecast_runs(session)


@router.get("/{run_id}", response_model=ForecastRunRead)
async def get_forecast_run(
    run_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
):
    forecast_run = await repository.get_forecast_run(session, run_id)
    if forecast_run is None:
        raise HTTPException(status_code=404, detail="Forecast run not found")
    return forecast_run


@router.post(
    "/{run_id}/values",
    response_model=list[ForecastValueRead],
    status_code=status.HTTP_201_CREATED,
)
async def create_forecast_values(
    run_id: uuid.UUID,
    payload: ForecastValuesCreate,
    session: AsyncSession = Depends(get_db_session),
):
    forecast_run = await repository.get_forecast_run(session, run_id)
    if forecast_run is None:
        raise HTTPException(status_code=404, detail="Forecast run not found")

    try:
        return await repository.create_forecast_values(session, forecast_run, payload)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Could not create forecast values") from exc


@router.get("/{run_id}/values", response_model=list[ForecastValueRead])
async def list_forecast_values(
    run_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
):
    forecast_run = await repository.get_forecast_run(session, run_id)
    if forecast_run is None:
        raise HTTPException(status_code=404, detail="Forecast run not found")
    return await repository.list_forecast_values(session, run_id)
