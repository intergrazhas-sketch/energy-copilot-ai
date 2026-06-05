import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.repositories import forecast as repository
from app.schemas.forecast import ForecastAccuracyRead
from app.services.forecast_accuracy import calculate_accuracy_for_run

router = APIRouter(prefix="/forecast-runs", tags=["Forecast MVP"])


@router.post(
    "/{run_id}/accuracy",
    response_model=ForecastAccuracyRead,
    status_code=status.HTTP_201_CREATED,
)
async def calculate_forecast_accuracy(
    run_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
):
    return await calculate_accuracy_for_run(session, run_id)


@router.get("/{run_id}/accuracy", response_model=ForecastAccuracyRead)
async def get_forecast_accuracy(
    run_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
):
    accuracy = await repository.get_accuracy_by_run(session, run_id)
    if accuracy is None:
        raise HTTPException(status_code=404, detail="Forecast accuracy not found")
    return accuracy
