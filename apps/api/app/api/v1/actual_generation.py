import csv
import io
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.repositories import forecast as repository
from app.schemas.forecast import ActualGenerationCreate, ActualGenerationRead
from app.schemas.telemetry import TelemetryCsvImportError, TelemetryCsvImportSummary

router = APIRouter(prefix="/actual-generation", tags=["Forecast MVP"])


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


def _get_first_value(row: dict[str, str], field_names: tuple[str, ...]) -> str:
    for field_name in field_names:
        value = row.get(field_name)
        if value is not None and value.strip():
            return value.strip()
    return ""


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


@router.post("/import-csv", response_model=TelemetryCsvImportSummary)
async def import_actual_generation_csv(
    solar_plant_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
):
    plant = await repository.get_solar_plant(session, solar_plant_id)
    if plant is None:
        raise HTTPException(status_code=404, detail="Solar plant not found")

    raw_content = await file.read()
    try:
        csv_text = raw_content.decode("utf-8-sig").strip()
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV file must be UTF-8 encoded") from exc

    if not csv_text:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    reader = csv.DictReader(io.StringIO(csv_text))
    fieldnames = {field.strip() for field in reader.fieldnames or []}
    if "timestamp" not in fieldnames:
        raise HTTPException(status_code=400, detail="CSV must include timestamp column")
    if not ({"actual_power_kw", "power_kw"} & fieldnames):
        raise HTTPException(
            status_code=400,
            detail="CSV must include actual_power_kw or power_kw column",
        )

    imported_rows = 0
    errors: list[TelemetryCsvImportError] = []
    has_data_rows = False

    for row_number, row in enumerate(reader, start=2):
        has_data_rows = True
        timestamp_text = (row.get("timestamp") or "").strip()
        power_text = _get_first_value(row, ("actual_power_kw", "power_kw"))
        energy_text = _get_first_value(row, ("actual_energy_kwh", "energy_kwh"))

        if not timestamp_text:
            errors.append(TelemetryCsvImportError(row_number=row_number, message="timestamp is required"))
            continue
        if not power_text:
            errors.append(
                TelemetryCsvImportError(
                    row_number=row_number,
                    message="actual_power_kw or power_kw is required",
                )
            )
            continue

        try:
            timestamp = _parse_csv_timestamp(timestamp_text)
            actual_power_kw = _parse_csv_float(power_text, "actual_power_kw")
            actual_energy_kwh = (
                _parse_csv_float(energy_text, "actual_energy_kwh")
                if energy_text
                else None
            )
        except ValueError as exc:
            errors.append(TelemetryCsvImportError(row_number=row_number, message=str(exc)))
            continue

        try:
            await repository.upsert_actual_generation_point(
                session,
                solar_plant_id=solar_plant_id,
                timestamp=timestamp,
                actual_power_kw=actual_power_kw,
                actual_energy_kwh=actual_energy_kwh,
                source="csv",
                quality="valid",
            )
        except IntegrityError as exc:
            await session.rollback()
            errors.append(TelemetryCsvImportError(row_number=row_number, message=str(exc)))
            continue

        imported_rows += 1

    if not has_data_rows:
        raise HTTPException(status_code=400, detail="CSV file has no data rows")

    return TelemetryCsvImportSummary(
        imported_rows=imported_rows,
        rejected_rows=len(errors),
        errors=errors,
    )
