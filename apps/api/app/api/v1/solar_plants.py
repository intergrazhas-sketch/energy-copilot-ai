import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.repositories import forecast as repository
from app.schemas.forecast import SolarPlantCreate, SolarPlantRead
from app.schemas.telemetry import TelemetryCsvImportError, TelemetryCsvImportSummary
from app.services.tabular_import import (
    TabularImportError,
    first_value,
    has_any_column,
    read_tabular_upload,
)

router = APIRouter(prefix="/solar-plants", tags=["Forecast MVP"])

TIMESTAMP_ALIASES = ("timestamp", "datetime", "date_time", "time", "date")
POWER_ALIASES = ("power_kw", "actual_power_kw", "power", "actual_kw", "generation_kw")
ENERGY_ALIASES = ("energy_kwh", "actual_energy_kwh", "energy", "generation_kwh")


def _parse_csv_float(value: str, field_name: str) -> float:
    try:
        return float(value)
    except ValueError as exc:
        raise ValueError(f"{field_name} must be a number") from exc


def _parse_csv_timestamp(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("timestamp must be a valid ISO 8601 datetime") from exc


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


@router.post("/{plant_id}/telemetry/import-csv", response_model=TelemetryCsvImportSummary)
async def import_solar_plant_telemetry_csv(
    plant_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
):
    plant = await repository.get_solar_plant(session, plant_id)
    if plant is None:
        raise HTTPException(status_code=404, detail="Solar plant not found")

    raw_content = await file.read()
    try:
        fieldnames, data_rows = read_tabular_upload(file.filename, raw_content)
    except TabularImportError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    fieldname_set = set(fieldnames)
    if not has_any_column(fieldname_set, TIMESTAMP_ALIASES):
        raise HTTPException(status_code=400, detail="File must include a timestamp column")
    if not has_any_column(fieldname_set, POWER_ALIASES):
        raise HTTPException(status_code=400, detail="File must include a power_kw column")

    imported_rows = 0
    errors: list[TelemetryCsvImportError] = []
    has_data_rows = False

    for row_number, row in enumerate(data_rows, start=2):
        has_data_rows = True
        timestamp_text = first_value(row, TIMESTAMP_ALIASES)
        power_text = first_value(row, POWER_ALIASES)
        energy_text = first_value(row, ENERGY_ALIASES)
        source = first_value(row, ("source",)) or "csv"
        quality = first_value(row, ("quality",)) or "imported"

        if not timestamp_text:
            errors.append(TelemetryCsvImportError(row_number=row_number, message="timestamp is required"))
            continue
        if not power_text:
            errors.append(TelemetryCsvImportError(row_number=row_number, message="power_kw is required"))
            continue

        try:
            timestamp = _parse_csv_timestamp(timestamp_text)
            actual_power_kw = _parse_csv_float(power_text, "power_kw")
            actual_energy_kwh = (
                _parse_csv_float(energy_text, "energy_kwh")
                if energy_text
                else None
            )
        except ValueError as exc:
            errors.append(TelemetryCsvImportError(row_number=row_number, message=str(exc)))
            continue

        await repository.upsert_actual_generation_point(
            session,
            solar_plant_id=plant_id,
            timestamp=timestamp,
            actual_power_kw=actual_power_kw,
            actual_energy_kwh=actual_energy_kwh,
            source=source,
            quality=quality,
        )
        imported_rows += 1

    if not has_data_rows:
        raise HTTPException(status_code=400, detail="CSV file has no data rows")

    return TelemetryCsvImportSummary(
        imported_rows=imported_rows,
        rejected_rows=len(errors),
        errors=errors,
    )
