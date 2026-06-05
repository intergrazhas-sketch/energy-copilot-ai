import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.repositories import forecast as repository
from app.schemas.forecast import SolarPlantCreate, SolarPlantRead

router = APIRouter(prefix="/solar-plants", tags=["Forecast MVP"])


@router.post("", response_model=SolarPlantRead, status_code=status.HTTP_201_CREATED)
async def create_solar_plant(
    payload: SolarPlantCreate,
    session: AsyncSession = Depends(get_db_session),
):
    try:
        return await repository.create_solar_plant(session, payload)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Could not create solar plant") from exc


@router.get("", response_model=list[SolarPlantRead])
async def list_solar_plants(session: AsyncSession = Depends(get_db_session)):
    return await repository.list_solar_plants(session)


@router.get("/{plant_id}", response_model=SolarPlantRead)
async def get_solar_plant(
    plant_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
):
    plant = await repository.get_solar_plant(session, plant_id)
    if plant is None:
        raise HTTPException(status_code=404, detail="Solar plant not found")
    return plant
