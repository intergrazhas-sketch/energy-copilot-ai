import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.repositories import forecast as repository
from app.schemas.forecast import ActualGenerationCreate, ActualGenerationRead
from app.schemas.telemetry import TelemetryCsvImportError, TelemetryCsvImportSummary
from app.services.tabular_import import (
    TabularImportError,
    first_value,
    has_any_column,
    read_tabular_upload,
)
from app.services.varvarinskaya_excel_adapter import (
    AdaptedRow,
    VarvarinskayaAdapterError,
    adapt_workbook,
    is_supported_extension,
    select_actual_rows,
)

router = APIRouter(prefix="/actual-generation", tags=["Forecast MVP"])

TIMESTAMP_ALIASES = ("timestamp", "datetime", "date_time", "time", "date")
POWER_ALIASES = ("actual_power_kw", "power_kw", "actual", "actual_kw", "generation_kw")
ENERGY_ALIASES = ("actual_energy_kwh", "energy_kwh", "energy", "generation_kwh")


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
        fieldnames, data_rows = read_tabular_upload(file.filename, raw_content)
    except TabularImportError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    fieldname_set = set(fieldnames)
    has_timestamp = has_any_column(fieldname_set, TIMESTAMP_ALIASES)
    has_power = has_any_column(fieldname_set, POWER_ALIASES)

    if not (has_timestamp and has_power):
        adapter_rows = _adapter_actual_rows(file.filename, raw_content)
        if adapter_rows is not None:
            return await _import_actual_adapter_rows(session, solar_plant_id, adapter_rows)
        if not has_timestamp:
            raise HTTPException(status_code=400, detail="File must include a timestamp column")
        raise HTTPException(
            status_code=400,
            detail="File must include actual_power_kw or power_kw column",
        )

    imported_rows = 0
    errors: list[TelemetryCsvImportError] = []
    has_data_rows = False

    for row_number, row in enumerate(data_rows, start=2):
        has_data_rows = True
        timestamp_text = first_value(row, TIMESTAMP_ALIASES)
        power_text = first_value(row, POWER_ALIASES)
        energy_text = first_value(row, ENERGY_ALIASES)

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


def _adapter_actual_rows(filename: str | None, raw_content: bytes) -> list[AdaptedRow] | None:
    """Return Varvarinskaya actual rows for Excel files, else None.

    None means the file is not a recognized Varvarinskaya daily export, so the
    caller falls back to the standard 400 column-validation messages.
    """
    if not is_supported_extension(filename):
        return None
    try:
        result = adapt_workbook(filename or "", raw_content)
    except VarvarinskayaAdapterError:
        return None
    if not result.supported:
        return None
    rows = select_actual_rows(result)
    return rows or None


async def _import_actual_adapter_rows(
    session: AsyncSession,
    solar_plant_id: uuid.UUID,
    rows: list[AdaptedRow],
) -> TelemetryCsvImportSummary:
    imported_rows = 0
    errors: list[TelemetryCsvImportError] = []

    for row_number, row in enumerate(rows, start=2):
        if row.actual_power_kw is None:
            continue
        try:
            timestamp = _parse_csv_timestamp(row.timestamp)
        except ValueError as exc:
            errors.append(TelemetryCsvImportError(row_number=row_number, message=str(exc)))
            continue

        try:
            await repository.upsert_actual_generation_point(
                session,
                solar_plant_id=solar_plant_id,
                timestamp=timestamp,
                actual_power_kw=row.actual_power_kw,
                actual_energy_kwh=row.actual_energy_kwh,
                source="excel",
                quality="valid",
            )
        except IntegrityError as exc:
            await session.rollback()
            errors.append(TelemetryCsvImportError(row_number=row_number, message=str(exc)))
            continue

        imported_rows += 1

    return TelemetryCsvImportSummary(
        imported_rows=imported_rows,
        rejected_rows=len(errors),
        errors=errors,
    )
