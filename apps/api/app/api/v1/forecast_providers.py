from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.repositories import forecast as repository
from app.schemas.forecast import ForecastProviderCreate, ForecastProviderRead

router = APIRouter(prefix="/forecast-providers", tags=["Forecast MVP"])


@router.post("", response_model=ForecastProviderRead, status_code=status.HTTP_201_CREATED)
async def create_forecast_provider(
    payload: ForecastProviderCreate,
    session: AsyncSession = Depends(get_db_session),
):
    try:
        return await repository.create_forecast_provider(session, payload)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Forecast provider already exists") from exc


@router.get("", response_model=list[ForecastProviderRead])
async def list_forecast_providers(session: AsyncSession = Depends(get_db_session)):
    return await repository.list_forecast_providers(session)
