import uuid
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
    select_forecast_rows,
)

router = APIRouter(prefix="/forecast-runs", tags=["Forecast MVP"])

MANUAL_CSV_FORECAST_PROVIDER_CODE = "manual_csv_forecast"
MANUAL_EXCEL_FORECAST_PROVIDER_CODE = "manual_excel_forecast"
MANUAL_CSV_FORECAST_PROVIDER_NAME = "Manual CSV / Forecast provider"
# Both manual CSV and manual Excel uploads are accepted; an empty provider_code
# defaults to the CSV code. Storage stays under the single manual provider.
SUPPORTED_MANUAL_FORECAST_CODES = frozenset(
    {MANUAL_CSV_FORECAST_PROVIDER_CODE, MANUAL_EXCEL_FORECAST_PROVIDER_CODE}
)

TIMESTAMP_ALIASES = ("timestamp", "datetime", "date_time", "time", "date")
FORECAST_POWER_ALIASES = (
    "forecast_power_kw",
    "forecast",
    "forecast_kw",
    "power_kw",
    "forecast_power",
)
FORECAST_ENERGY_ALIASES = ("forecast_energy_kwh", "energy", "energy_kwh")


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
    if timestamp.tzinfo is None:
        # Forecast values are bulk-inserted into a timestamptz column; naive
        # datetimes break SQLAlchemy insertmany sentinel matching, so default
        # tz-naive inputs to UTC. Adapter (+01:00) / CSV offsets are untouched.
        timestamp = timestamp.replace(tzinfo=timezone.utc)
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


def _adapter_forecast_rows(filename: str | None, raw_content: bytes) -> list[AdaptedRow] | None:
    """Return Varvarinskaya forecast rows for Excel files, else None.

    None means the file is not a recognized Varvarinskaya daily export. An empty
    list means it is recognized but contains no forecast column (e.g. only a
    15-minute generation sheet) -> the import succeeds with 0 forecast rows.
    """
    if not is_supported_extension(filename):
        return None
    try:
        result = adapt_workbook(filename or "", raw_content)
    except VarvarinskayaAdapterError:
        return None
    if not result.supported:
        return None
    return select_forecast_rows(result)


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
        fieldnames, data_rows = read_tabular_upload(file.filename, raw_content)
    except TabularImportError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    fieldname_set = set(fieldnames)
    has_timestamp = has_any_column(fieldname_set, TIMESTAMP_ALIASES)
    has_power = has_any_column(fieldname_set, FORECAST_POWER_ALIASES)

    imported_values: list[ForecastValueItem] = []
    errors: list[TelemetryCsvImportError] = []
    has_data_rows = False

    adapter_rows = None
    if not (has_timestamp and has_power):
        adapter_rows = _adapter_forecast_rows(file.filename, raw_content)
        if adapter_rows is None:
            if not has_timestamp:
                raise HTTPException(status_code=400, detail="File must include a timestamp column")
            raise HTTPException(
                status_code=400,
                detail="File must include a forecast_power_kw column",
            )

    if adapter_rows is not None:
        # Varvarinskaya Excel fallback: forecast lives on the hourly sheet only;
        # an empty list means the file has no forecast (e.g. 15-min only) -> 0 imported.
        has_data_rows = True
        for row_number, row in enumerate(adapter_rows, start=2):
            if row.forecast_power_kw is None:
                continue
            try:
                imported_values.append(
                    ForecastValueItem(
                        timestamp=_parse_csv_timestamp(row.timestamp),
                        predicted_power_kw=_parse_csv_float(
                            str(row.forecast_power_kw), "forecast_power_kw"
                        ),
                        predicted_energy_kwh=row.forecast_energy_kwh,
                    )
                )
            except ValueError as exc:
                errors.append(TelemetryCsvImportError(row_number=row_number, message=str(exc)))
                continue
    else:
        for row_number, row in enumerate(data_rows, start=2):
            has_data_rows = True
            timestamp_text = first_value(row, TIMESTAMP_ALIASES)
            # provider_code is optional: missing means manual Excel/CSV forecast.
            provider_code = first_value(row, ("provider_code",)) or MANUAL_CSV_FORECAST_PROVIDER_CODE
            power_text = first_value(row, FORECAST_POWER_ALIASES)
            energy_text = first_value(row, FORECAST_ENERGY_ALIASES)

            if not timestamp_text:
                errors.append(TelemetryCsvImportError(row_number=row_number, message="timestamp_required"))
                continue
            if provider_code not in SUPPORTED_MANUAL_FORECAST_CODES:
                errors.append(TelemetryCsvImportError(row_number=row_number, message="provider_code_unsupported"))
                continue
            if not power_text:
                errors.append(TelemetryCsvImportError(row_number=row_number, message="forecast_power_kw_required"))
                continue

            try:
                imported_values.append(
                    ForecastValueItem(
                        timestamp=_parse_csv_timestamp(timestamp_text),
                        predicted_power_kw=_parse_csv_float(power_text, "forecast_power_kw"),
                        predicted_energy_kwh=(
                            _parse_csv_float(energy_text, "forecast_energy_kwh")
                            if energy_text
                            else None
                        ),
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

    await repository.delete_forecast_runs_in_range(
        session,
        solar_plant_id=plant_id,
        provider_id=provider.id,
        period_from=period_from,
        period_to=period_to,
    )

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

    imported_count = 0
    duplicate_count = 0
    try:
        for value in imported_values:
            action = await repository.upsert_forecast_value_point(
                session,
                forecast_run_id=forecast_run.id,
                solar_plant_id=plant_id,
                provider_id=provider.id,
                timestamp=value.timestamp,
                predicted_power_kw=value.predicted_power_kw,
                predicted_energy_kwh=value.predicted_energy_kwh,
            )
            if action == "inserted":
                imported_count += 1
            else:
                duplicate_count += 1
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
        imported_rows=imported_count,
        rejected_rows=len(errors) + duplicate_count,
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
