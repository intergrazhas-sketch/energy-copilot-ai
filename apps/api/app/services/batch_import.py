"""Batch import orchestration.

Reuses the existing single-file building blocks (Varvarinskaya adapter,
tabular_import reader, forecast/actual repositories and the accuracy service)
and loops them over many files / ZIP archives. Parsing logic is NOT duplicated:
this module only orchestrates the shared helpers.
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import accuracy_lab as accuracy_lab_repository
from app.repositories import forecast as repository
from app.schemas.forecast import (
    ForecastRunCreate,
    ForecastValueItem,
    validate_15_minute_timestamp,
)
from app.services.forecast_accuracy import calculate_accuracy_for_run
from app.services.tabular_import import (
    TabularImportError,
    first_value,
    has_any_column,
    read_tabular_upload,
)
from app.services.campbell_toa5 import is_campbell_toa5
from app.services.varvarinskaya_excel_adapter import (
    VarvarinskayaAdapterError,
    adapt_varvarinskaya_file,
    is_supported_extension,
    select_actual_rows,
    select_forecast_rows,
)

MANUAL_FORECAST_PROVIDER_CODE = "manual_csv_forecast"
MANUAL_FORECAST_PROVIDER_NAME = "Manual CSV / Forecast provider"

TIMESTAMP_ALIASES = ("timestamp", "datetime", "date_time", "time", "date")
ACTUAL_POWER_ALIASES = ("actual_power_kw", "power_kw", "actual", "actual_kw", "generation_kw")
ACTUAL_ENERGY_ALIASES = ("actual_energy_kwh", "energy_kwh", "energy", "generation_kwh")
FORECAST_POWER_ALIASES = ("forecast_power_kw", "forecast", "forecast_kw", "power_kw", "forecast_power")
FORECAST_ENERGY_ALIASES = ("forecast_energy_kwh", "energy", "energy_kwh")

SUPPORTED_EXTENSIONS = (".csv", ".xlsx", ".xls")

IMPORT_MODES = ("actual_only", "forecast_only", "actual_and_forecast", "auto_detect")


@dataclass
class PerFileResult:
    filename: str
    file_type: str = "unknown"
    status: str = "pending"
    actual_rows_imported: int = 0
    forecast_rows_imported: int = 0
    duplicate_rows_skipped: int = 0
    rejected_rows: int = 0
    data_start_at: datetime | None = None
    data_end_at: datetime | None = None
    error_message: str | None = None
    errors: list[tuple[int | None, str, str]] = field(default_factory=list)


@dataclass
class BatchResult:
    total_files: int = 0
    processed_files: int = 0
    skipped_files: int = 0
    failed_files: int = 0
    actual_rows_imported: int = 0
    forecast_rows_imported: int = 0
    duplicate_rows_skipped: int = 0
    rejected_rows: int = 0
    data_start_at: datetime | None = None
    data_end_at: datetime | None = None
    files: list[PerFileResult] = field(default_factory=list)


def _has_supported_extension(filename: str) -> bool:
    lowered = (filename or "").lower()
    return lowered.endswith(SUPPORTED_EXTENSIONS)


def _parse_float(value: str) -> float:
    parsed = float(value)
    if parsed < 0:
        raise ValueError("value_negative")
    return parsed


def _parse_actual_timestamp(value: str) -> datetime:
    timestamp = datetime.fromisoformat(value)
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return timestamp


def _parse_forecast_timestamp(value: str) -> datetime:
    timestamp = datetime.fromisoformat(value)
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return validate_15_minute_timestamp(timestamp)


def _track_period(
    current_start: datetime | None,
    current_end: datetime | None,
    timestamp: datetime,
) -> tuple[datetime, datetime]:
    start = timestamp if current_start is None or timestamp < current_start else current_start
    end = timestamp if current_end is None or timestamp > current_end else current_end
    return start, end


def _normalize_skip_reason(adapter_reason: str | None) -> str:
    if not adapter_reason:
        return "no_recognized_generation_columns"
    low = adapter_reason.lower()
    if adapter_reason == "unsupported_by_interval_format":
        return adapter_reason
    if "by-interval" in low or "by_interval" in low:
        return "unsupported_by_interval_format"
    if "no generation sheet" in low:
        return "no_recognized_generation_columns"
    if adapter_reason == "unsupported_extension":
        return adapter_reason
    if adapter_reason == "no_generation_rows_in_by_interval_file":
        return "no_rows_imported"
    return "no_recognized_generation_columns"


def _adapter_result(filename: str, raw: bytes):
    if not is_supported_extension(filename):
        return None, "unsupported_extension"
    try:
        result = adapt_varvarinskaya_file(filename or "", raw)
    except VarvarinskayaAdapterError:
        return None, "excel_read_error"
    if result.supported:
        return result, None
    return None, _normalize_skip_reason(result.reason)


async def _import_actual(
    session: AsyncSession,
    plant_id: uuid.UUID,
    filename: str,
    raw: bytes,
    result: PerFileResult,
) -> bool:
    """Import actual rows from one file. Returns True if the file was recognized."""
    recognized = False
    rows: list[tuple[datetime, float, float | None, str]] = []

    try:
        fieldnames, data_rows = read_tabular_upload(filename, raw)
    except TabularImportError:
        fieldnames, data_rows = [], []

    fieldname_set = set(fieldnames)
    if has_any_column(fieldname_set, TIMESTAMP_ALIASES) and has_any_column(
        fieldname_set, ACTUAL_POWER_ALIASES
    ):
        recognized = True
        for row_number, row in enumerate(data_rows, start=2):
            ts_text = first_value(row, TIMESTAMP_ALIASES)
            power_text = first_value(row, ACTUAL_POWER_ALIASES)
            energy_text = first_value(row, ACTUAL_ENERGY_ALIASES)
            if not ts_text or not power_text:
                result.errors.append((row_number, "validation", "timestamp_and_power_required"))
                continue
            try:
                timestamp = _parse_actual_timestamp(ts_text)
                power = _parse_float(power_text)
                energy = _parse_float(energy_text) if energy_text else None
            except ValueError as exc:
                result.errors.append((row_number, "parse", str(exc)))
                continue
            rows.append((timestamp, power, energy, "csv"))
    else:
        adapted, skip_reason = _adapter_result(filename, raw)
        if adapted is not None:
            recognized = True
            if any("свод" in (sheet.actual_column or "") for sheet in adapted.sheets):
                result.file_type = "generation_by_interval"
            else:
                result.file_type = "generation_daily"
            for row_number, row in enumerate(select_actual_rows(adapted), start=2):
                if row.actual_power_kw is None:
                    continue
                try:
                    timestamp = _parse_actual_timestamp(row.timestamp)
                except ValueError as exc:
                    result.errors.append((row_number, "parse", str(exc)))
                    continue
                rows.append((timestamp, row.actual_power_kw, row.actual_energy_kwh, "excel"))
        elif skip_reason:
            result.error_message = skip_reason
            result.errors.append((None, "unsupported", skip_reason))

    for timestamp, power, energy, source in rows:
        try:
            action = await repository.upsert_actual_generation_point(
                session,
                solar_plant_id=plant_id,
                timestamp=timestamp,
                actual_power_kw=power,
                actual_energy_kwh=energy,
                source=source,
                quality="valid",
            )
        except IntegrityError:
            await session.rollback()
            result.errors.append((None, "db", "actual_row_conflict"))
            continue
        if action == "inserted":
            result.actual_rows_imported += 1
        else:
            result.duplicate_rows_skipped += 1
        result.data_start_at, result.data_end_at = _track_period(
            result.data_start_at, result.data_end_at, timestamp
        )

    return recognized


async def _import_forecast(
    session: AsyncSession,
    plant_id: uuid.UUID,
    filename: str,
    raw: bytes,
    result: PerFileResult,
) -> bool:
    """Import forecast rows from one file. Returns True if the file was recognized.

    Re-importing the same day replaces the previous run (delete-on-overlap), so
    accuracy is never double-counted.
    """
    recognized = False
    values: list[ForecastValueItem] = []

    try:
        fieldnames, data_rows = read_tabular_upload(filename, raw)
    except TabularImportError:
        fieldnames, data_rows = [], []

    fieldname_set = set(fieldnames)
    if has_any_column(fieldname_set, TIMESTAMP_ALIASES) and has_any_column(
        fieldname_set, FORECAST_POWER_ALIASES
    ):
        recognized = True
        for row_number, row in enumerate(data_rows, start=2):
            ts_text = first_value(row, TIMESTAMP_ALIASES)
            power_text = first_value(row, FORECAST_POWER_ALIASES)
            energy_text = first_value(row, FORECAST_ENERGY_ALIASES)
            if not ts_text or not power_text:
                result.errors.append((row_number, "validation", "timestamp_and_forecast_required"))
                continue
            try:
                timestamp = _parse_forecast_timestamp(ts_text)
                power = _parse_float(power_text)
                energy = _parse_float(energy_text) if energy_text else None
            except ValueError as exc:
                result.errors.append((row_number, "parse", str(exc)))
                continue
            values.append(
                ForecastValueItem(timestamp=timestamp, predicted_power_kw=power, predicted_energy_kwh=energy)
            )
    else:
        adapted, skip_reason = _adapter_result(filename, raw)
        if adapted is not None:
            recognized = True
            for row_number, row in enumerate(select_forecast_rows(adapted), start=2):
                if row.forecast_power_kw is None:
                    continue
                try:
                    timestamp = _parse_forecast_timestamp(row.timestamp)
                    power = _parse_float(str(row.forecast_power_kw))
                except ValueError as exc:
                    result.errors.append((row_number, "parse", str(exc)))
                    continue
                values.append(
                    ForecastValueItem(
                        timestamp=timestamp,
                        predicted_power_kw=power,
                        predicted_energy_kwh=row.forecast_energy_kwh,
                    )
                )
        elif skip_reason and result.error_message is None:
            result.error_message = skip_reason
            result.errors.append((None, "unsupported", skip_reason))

    if not values:
        return recognized

    provider = await repository.ensure_forecast_provider(
        session,
        code=MANUAL_FORECAST_PROVIDER_CODE,
        name=MANUAL_FORECAST_PROVIDER_NAME,
        provider_type="manual",
        config={"source": "batch_import"},
    )

    period_from = min(value.timestamp for value in values)
    period_to = max(value.timestamp for value in values)

    # Idempotency: drop any prior run covering this day before re-inserting.
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
    try:
        for value in values:
            try:
                action = await repository.upsert_forecast_value_point(
                    session,
                    forecast_run_id=forecast_run.id,
                    solar_plant_id=plant_id,
                    provider_id=provider.id,
                    timestamp=value.timestamp,
                    predicted_power_kw=value.predicted_power_kw,
                    predicted_energy_kwh=value.predicted_energy_kwh,
                )
            except IntegrityError:
                await session.rollback()
                result.errors.append((None, "db", "forecast_values_conflict"))
                return recognized
            if action == "inserted":
                result.forecast_rows_imported += 1
            else:
                result.duplicate_rows_skipped += 1
    except SQLAlchemyError:
        await session.rollback()
        raise

    # Per-run accuracy now; day aggregates are recomputed once at batch end.
    try:
        await calculate_accuracy_for_run(session, forecast_run.id)
    except HTTPException as exc:
        if exc.status_code != status.HTTP_400_BAD_REQUEST:
            raise

    result.data_start_at, result.data_end_at = _track_period(
        result.data_start_at, result.data_end_at, period_from
    )
    result.data_start_at, result.data_end_at = _track_period(
        result.data_start_at, result.data_end_at, period_to
    )
    return recognized


async def import_single_file(
    session: AsyncSession,
    plant_id: uuid.UUID,
    filename: str,
    raw: bytes,
    mode: str,
) -> PerFileResult:
    result = PerFileResult(filename=filename, file_type=mode)

    if not _has_supported_extension(filename):
        result.status = "skipped"
        result.file_type = "unsupported"
        result.error_message = "unsupported_extension"
        result.errors.append((None, "unsupported", "unsupported_extension"))
        return result

    if is_campbell_toa5(filename, raw):
        result.status = "skipped"
        result.file_type = "weather"
        result.error_message = "weather_file_detected_not_imported_yet"
        result.errors.append((None, "weather", "weather_file_detected_not_imported_yet"))
        return result

    do_actual = mode in ("actual_only", "actual_and_forecast", "auto_detect")
    do_forecast = mode in ("forecast_only", "actual_and_forecast", "auto_detect")

    recognized = False
    try:
        if do_actual:
            recognized = await _import_actual(session, plant_id, filename, raw, result) or recognized
        if do_forecast:
            recognized = await _import_forecast(session, plant_id, filename, raw, result) or recognized
    except SQLAlchemyError as exc:
        await session.rollback()
        result.status = "failed"
        result.error_message = "db_error"
        result.errors.append((None, "db", str(exc)[:200]))
        return result

    result.rejected_rows = len(result.errors)

    if not recognized:
        result.status = "skipped"
        result.file_type = "unsupported"
        if result.error_message is None:
            result.error_message = "no_recognized_generation_columns"
            result.errors.append((None, "unsupported", "no_recognized_generation_columns"))
        return result

    if result.actual_rows_imported == 0 and result.forecast_rows_imported == 0:
        if result.duplicate_rows_skipped > 0:
            result.status = "partial" if result.errors else "success"
            return result
        result.status = "failed" if result.errors else "skipped"
        if result.error_message is None:
            if mode == "forecast_only" and result.file_type == "generation_by_interval":
                result.error_message = "generation_actual_only_no_forecast"
            elif result.errors:
                result.error_message = "no_rows_imported"
            else:
                result.error_message = "no_rows_imported"
        return result

    result.status = "partial" if result.errors else "success"
    return result


async def run_batch_import(
    session: AsyncSession,
    plant_id: uuid.UUID,
    mode: str,
    files: list[tuple[str, bytes]],
) -> BatchResult:
    batch = BatchResult(total_files=len(files))

    for filename, raw in files:
        per_file = await import_single_file(session, plant_id, filename, raw, mode)
        batch.files.append(per_file)

        batch.actual_rows_imported += per_file.actual_rows_imported
        batch.forecast_rows_imported += per_file.forecast_rows_imported
        batch.duplicate_rows_skipped += per_file.duplicate_rows_skipped
        batch.rejected_rows += per_file.rejected_rows

        if per_file.status in ("success", "partial"):
            batch.processed_files += 1
        elif per_file.status == "skipped":
            batch.skipped_files += 1
        else:
            batch.failed_files += 1

        if per_file.data_start_at is not None:
            batch.data_start_at, batch.data_end_at = _track_period(
                batch.data_start_at, batch.data_end_at, per_file.data_start_at
            )
        if per_file.data_end_at is not None:
            batch.data_start_at, batch.data_end_at = _track_period(
                batch.data_start_at, batch.data_end_at, per_file.data_end_at
            )

    # Recompute day aggregates ONCE for the whole imported range (fast path).
    if batch.forecast_rows_imported > 0 and batch.data_start_at and batch.data_end_at:
        provider = await repository.get_forecast_provider_by_code(
            session, MANUAL_FORECAST_PROVIDER_CODE
        )
        if provider is not None:
            await accuracy_lab_repository.recalculate_day_aggregates(
                session,
                period_from=batch.data_start_at,
                period_to=batch.data_end_at,
                solar_plant_id=plant_id,
                provider_id=provider.id,
            )

    return batch
