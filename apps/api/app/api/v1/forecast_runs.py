import uuid
import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.repositories import accuracy_lab as accuracy_lab_repository
from app.repositories import forecast as repository
from app.schemas.forecast import (
    ForecastRunCreate,
    ForecastRunRead,
    ForecastValueItem,
    ForecastValueRead,
    ForecastValuesCreate,
    validate_15_minute_timestamp,
)
from app.schemas.telemetry import TelemetryCsvImportError, TelemetryCsvImportSummary
from app.services.forecast_accuracy import calculate_accuracy_for_run

router = APIRouter(prefix="/forecast-runs", tags=["Forecast MVP"])

MANUAL_CSV_FORECAST_PROVIDER_CODE = "manual_csv_forecast"
MANUAL_CSV_FORECAST_PROVIDER_NAME = "Manual CSV / Forecast provider"


def _parse_csv_float(value: str, field_name: str) -> float:
    try:
        parsed = float(value)
    except ValueError as exc:
        raise ValueError(f"{field_name}_invalid") from exc
    if parsed < 0:
        raise ValueError(f"{field_name}_negative")
    return parsed


def _parse_csv_timestamp(value: str) -> datetime:
    try:
        timestamp = datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("timestamp_invalid") from exc
    try:
        return validate_15_minute_timestamp(timestamp)
    except ValueError as exc:
        raise ValueError("timestamp_not_15_minute") from exc


async def _refresh_accuracy_for_run(
    session: AsyncSession,
    run_id: uuid.UUID,
    period_from: datetime,
    period_to: datetime,
    plant_id: uuid.UUID,
    provider_id: uuid.UUID,
) -> None:
    try:
        await calculate_accuracy_for_run(session, run_id)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_400_BAD_REQUEST:
            return
        raise

    await accuracy_lab_repository.recalculate_day_aggregates(
        session,
        period_from=period_from,
        period_to=period_to,
        solar_plant_id=plant_id,
        provider_id=provider_id,
    )


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


@router.post("/import-csv", response_model=TelemetryCsvImportSummary)
async def import_forecast_run_csv(
    plant_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
):
    plant = await repository.get_solar_plant(session, plant_id)
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
    required_columns = {
        "timestamp",
        "provider_code",
        "forecast_power_kw",
        "forecast_energy_kwh",
    }
    missing_columns = sorted(required_columns - fieldnames)
    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail=f"CSV must include columns: {', '.join(missing_columns)}",
        )

    imported_values: list[ForecastValueItem] = []
    errors: list[TelemetryCsvImportError] = []
    has_data_rows = False

    for row_number, raw_row in enumerate(reader, start=2):
        has_data_rows = True
        row = {key.strip(): (value or "").strip() for key, value in raw_row.items() if key}
        timestamp_text = row.get("timestamp", "")
        provider_code = row.get("provider_code", "")
        power_text = row.get("forecast_power_kw", "")
        energy_text = row.get("forecast_energy_kwh", "")

        if not timestamp_text:
            errors.append(TelemetryCsvImportError(row_number=row_number, message="timestamp_required"))
            continue
        if not provider_code:
            errors.append(TelemetryCsvImportError(row_number=row_number, message="provider_code_required"))
            continue
        if provider_code != MANUAL_CSV_FORECAST_PROVIDER_CODE:
            errors.append(TelemetryCsvImportError(row_number=row_number, message="provider_code_unsupported"))
            continue
        if not power_text:
            errors.append(TelemetryCsvImportError(row_number=row_number, message="forecast_power_kw_required"))
            continue
        if not energy_text:
            errors.append(TelemetryCsvImportError(row_number=row_number, message="forecast_energy_kwh_required"))
            continue

        try:
            imported_values.append(
                ForecastValueItem(
                    timestamp=_parse_csv_timestamp(timestamp_text),
                    predicted_power_kw=_parse_csv_float(power_text, "forecast_power_kw"),
                    predicted_energy_kwh=_parse_csv_float(energy_text, "forecast_energy_kwh"),
                )
            )
        except ValueError as exc:
            errors.append(TelemetryCsvImportError(row_number=row_number, message=str(exc)))
            continue

    if not has_data_rows:
        raise HTTPException(status_code=400, detail="CSV file has no data rows")

    if not imported_values:
        return TelemetryCsvImportSummary(
            imported_rows=0,
            rejected_rows=len(errors),
            errors=errors,
        )

    provider = await repository.ensure_forecast_provider(
        session,
        code=MANUAL_CSV_FORECAST_PROVIDER_CODE,
        name=MANUAL_CSV_FORECAST_PROVIDER_NAME,
        provider_type="manual",
        config={"source": "csv_import"},
    )

    period_from = min(value.timestamp for value in imported_values)
    period_to = max(value.timestamp for value in imported_values)
    horizon_hours = max(1, min(168, int((period_to - period_from).total_seconds() // 3600) + 1))
    forecast_run = await repository.create_forecast_run(
        session,
        ForecastRunCreate(
            solar_plant_id=plant_id,
            provider_id=provider.id,
            run_at=datetime.now(timezone.utc),
            horizon_hours=horizon_hours,
            interval_minutes=15,
            status="imported",
        ),
    )

    try:
        await repository.create_forecast_values(
            session,
            forecast_run,
            ForecastValuesCreate(values=imported_values),
        )
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Could not import forecast values") from exc

    await _refresh_accuracy_for_run(
        session,
        forecast_run.id,
        period_from,
        period_to,
        plant_id,
        provider.id,
    )

    return TelemetryCsvImportSummary(
        imported_rows=len(imported_values),
        rejected_rows=len(errors),
        errors=errors,
    )


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
