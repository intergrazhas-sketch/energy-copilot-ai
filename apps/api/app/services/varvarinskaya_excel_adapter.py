"""Pilot-only Excel adapter for the Varvarinskaya solar plant daily exports.

The operating company ships daily ``.xlsx`` files that the generic
``tabular_import`` reader cannot understand:

* Russian, multi-line column titles (the time column is *not* named
  ``timestamp``).
* Generation is reported as energy per interval in ``кВт*ч`` (not power).
* A single daily file contains several sheets, of which only the generation
  sheets are relevant here:

    - ``... ГЕНЕРАЦИЯ ПО 15 МИН`` (15-minute generation)
    - ``... ГЕНЕРАЦИЯ ПО ЧАСУ``  (hourly generation)

This module is intentionally small and isolated: it only knows about the
Varvarinskaya layout, never touches the generic importer, the API or the
frontend, and is safe to call on a single uploaded file.

Energy -> power conversion:
    * 15-minute interval -> average power = energy_kwh * 4
    * hourly interval     -> average power = energy_kwh * 1
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

# Substrings (already normalized: lower-case, spaces -> "_") used to locate the
# relevant columns inside a generation sheet. Matching is tolerant: any header
# that *contains* one of these markers wins.
TIME_MARKERS = ("utc", "[15_мин", "[1_час", "15_мин.", "1_час.")
ACTUAL_MARKERS = ("сумма_генерации_сэс", "сумма_генерации")
FORECAST_MARKERS = ("прогноз_генераций_сэс", "прогноз_генераци", "прогноз_генерации")

INTERVAL_15MIN = "15min"
INTERVAL_HOURLY = "60min"

# Average-power multiplier applied to interval energy (kWh) to get kW.
POWER_MULTIPLIER = {INTERVAL_15MIN: 4.0, INTERVAL_HOURLY: 1.0}

# Varvarinskaya exports state "UTC+1" in the time-column header. When the header
# offset cannot be parsed we fall back to this, since the timestamps are naive
# and the database stores timezone-aware values.
DEFAULT_TZ = timezone(timedelta(hours=1))
_UTC_OFFSET_RE = re.compile(r"utc[_\s]*([+-])[_\s]*(\d{1,2})(?::?(\d{2}))?")


class VarvarinskayaAdapterError(Exception):
    """Raised when the file cannot be opened as an Excel workbook at all."""


@dataclass
class AdaptedRow:
    timestamp: str
    actual_energy_kwh: float | None
    forecast_energy_kwh: float | None
    actual_power_kw: float | None
    forecast_power_kw: float | None


@dataclass
class SheetResult:
    sheet_name: str
    interval: str  # INTERVAL_15MIN | INTERVAL_HOURLY
    time_column: str | None
    actual_column: str | None
    forecast_column: str | None
    rows: list[AdaptedRow] = field(default_factory=list)

    @property
    def recognized(self) -> bool:
        return bool(self.time_column and self.actual_column)


@dataclass
class AdapterResult:
    filename: str
    supported: bool
    reason: str | None
    sheet_names: list[str]
    sheets: list[SheetResult] = field(default_factory=list)


def _normalize(name: object) -> str:
    return str(name).strip().lower().replace(" ", "_")


def _to_float(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    text = text.replace("\xa0", "").replace(" ", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


_TIMESTAMP_FORMATS = (
    "%d.%m.%Y %H:%M:%S",
    "%d.%m.%Y %H:%M",
    "%d.%m.%Y",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
)


def _tz_from_header(header: str | None) -> timezone:
    """Derive the timezone from a time-column header such as '... utc+1'."""
    if header:
        match = _UTC_OFFSET_RE.search(header)
        if match:
            sign = 1 if match.group(1) == "+" else -1
            hours = int(match.group(2))
            minutes = int(match.group(3) or 0)
            return timezone(sign * timedelta(hours=hours, minutes=minutes))
    return DEFAULT_TZ


def _to_timestamp(value: object, tz: timezone) -> str:
    """Return an ISO 8601 timestamp with offset.

    Naive Excel datetimes are made timezone-aware using ``tz`` (the offset from
    the Excel header). Already-aware values keep their offset. Unparseable
    values are returned as-is so the caller can reject the row.
    """
    if value is None:
        return ""
    parsed: datetime | None = None
    if isinstance(value, datetime):
        parsed = value
    else:
        text = str(value).strip()
        if not text:
            return ""
        for fmt in _TIMESTAMP_FORMATS:
            try:
                parsed = datetime.strptime(text, fmt)
                break
            except ValueError:
                continue
        if parsed is None:
            try:
                parsed = datetime.fromisoformat(text)
            except ValueError:
                return text
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=tz)
    return parsed.isoformat()


def _find_column(headers: list[str | None], markers: tuple[str, ...]) -> str | None:
    for header in headers:
        if not header:
            continue
        for marker in markers:
            if marker in header:
                return header
    return None


def _interval_for_sheet(sheet_name: str) -> str | None:
    low = _normalize(sheet_name)
    if "генераци" not in low:
        return None
    if "15" in low and "мин" in low:
        return INTERVAL_15MIN
    if "час" in low:
        return INTERVAL_HOURLY
    return None


def _adapt_sheet(worksheet, sheet_name: str, interval: str) -> SheetResult:
    rows_iter = worksheet.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration:
        return SheetResult(sheet_name, interval, None, None, None)

    norm_headers: list[str | None] = []
    for cell in header_row:
        if cell is None or str(cell).strip() == "":
            norm_headers.append(None)
        else:
            norm_headers.append(_normalize(cell))

    time_col = _find_column(norm_headers, TIME_MARKERS)
    actual_col = _find_column(norm_headers, ACTUAL_MARKERS)
    forecast_col = _find_column(norm_headers, FORECAST_MARKERS)

    result = SheetResult(sheet_name, interval, time_col, actual_col, forecast_col)
    if not (time_col and actual_col):
        return result

    index_by_header: dict[str, int] = {}
    for index, header in enumerate(norm_headers):
        if header and header not in index_by_header:
            index_by_header[header] = index

    time_idx = index_by_header.get(time_col)
    actual_idx = index_by_header.get(actual_col)
    forecast_idx = index_by_header.get(forecast_col) if forecast_col else None
    multiplier = POWER_MULTIPLIER[interval]
    tz = _tz_from_header(time_col)

    for raw in rows_iter:
        if raw is None or all(cell is None for cell in raw):
            continue
        ts_value = raw[time_idx] if time_idx is not None and time_idx < len(raw) else None
        timestamp = _to_timestamp(ts_value, tz)
        if not timestamp:
            continue

        actual_energy = (
            _to_float(raw[actual_idx]) if actual_idx is not None and actual_idx < len(raw) else None
        )
        forecast_energy = (
            _to_float(raw[forecast_idx])
            if forecast_idx is not None and forecast_idx < len(raw)
            else None
        )
        if actual_energy is None and forecast_energy is None:
            continue

        result.rows.append(
            AdaptedRow(
                timestamp=timestamp,
                actual_energy_kwh=actual_energy,
                forecast_energy_kwh=forecast_energy,
                actual_power_kw=(actual_energy * multiplier) if actual_energy is not None else None,
                forecast_power_kw=(forecast_energy * multiplier)
                if forecast_energy is not None
                else None,
            )
        )

    return result


def is_supported_extension(filename: str | None) -> bool:
    return bool(filename) and filename.lower().endswith((".xlsx", ".xls"))


def select_actual_rows(result: AdapterResult) -> list[AdaptedRow]:
    """Pick actual-generation rows, preferring the finer 15-minute sheet.

    The 15-minute and hourly sheets share on-the-hour timestamps, so we use a
    single sheet (15-minute when available) to avoid conflicting points.
    """
    sheets = [sheet for sheet in result.sheets if sheet.recognized]
    sheets.sort(key=lambda sheet: 0 if sheet.interval == INTERVAL_15MIN else 1)
    for sheet in sheets:
        rows = [row for row in sheet.rows if row.actual_power_kw is not None]
        if rows:
            return rows
    return []


def select_forecast_rows(result: AdapterResult) -> list[AdaptedRow]:
    """Pick forecast rows; forecast usually lives only on the hourly sheet."""
    sheets = [sheet for sheet in result.sheets if sheet.recognized and sheet.forecast_column]
    sheets.sort(key=lambda sheet: 0 if sheet.interval == INTERVAL_HOURLY else 1)
    for sheet in sheets:
        rows = [row for row in sheet.rows if row.forecast_power_kw is not None]
        if rows:
            return rows
    return []


def adapt_workbook(filename: str, raw_content: bytes) -> AdapterResult:
    """Adapt a single Varvarinskaya daily ``.xlsx`` into normalized rows.

    For non-daily single-sheet exports (``... by 15 мин`` / ``... by 60``) the
    generation sheets are absent; the file is reported as unsupported with a
    clear reason instead of raising, so callers never break.
    """
    try:
        from openpyxl import load_workbook
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise VarvarinskayaAdapterError(
            "Excel (.xlsx) support is not installed on the server"
        ) from exc

    try:
        workbook = load_workbook(io.BytesIO(raw_content), read_only=True, data_only=True)
    except Exception as exc:  # noqa: BLE001 - openpyxl raises various errors
        raise VarvarinskayaAdapterError("Could not read the Excel (.xlsx) file") from exc

    try:
        sheet_names = list(workbook.sheetnames)
        generation_sheets = [
            (name, _interval_for_sheet(name))
            for name in sheet_names
            if _interval_for_sheet(name) is not None
        ]

        if not generation_sheets:
            return AdapterResult(
                filename=filename,
                supported=False,
                reason=(
                    "No generation sheet found. Single-interval exports "
                    "('... by 15 мин' / '... by 60') need a separate mapping "
                    "and are not imported by this adapter yet."
                ),
                sheet_names=sheet_names,
            )

        sheets: list[SheetResult] = []
        for name, interval in generation_sheets:
            sheets.append(_adapt_sheet(workbook[name], name, interval))
    finally:
        workbook.close()

    any_recognized = any(sheet.recognized for sheet in sheets)
    reason = None
    if not any_recognized:
        reason = (
            "Generation sheet(s) found but the time / actual columns could not "
            "be located by the known Varvarinskaya markers."
        )

    return AdapterResult(
        filename=filename,
        supported=any_recognized,
        reason=reason,
        sheet_names=sheet_names,
        sheets=sheets,
    )
